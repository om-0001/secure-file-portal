"""
Views for Ephemeral Link Creation, Verification, Streaming, Revocation, and Audit Telemetry.
"""

from datetime import timedelta
from django.utils import timezone
from django.http import HttpResponse
from django.conf import settings
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied

from files.models import File
from access_control.models import AccessPolicy, AccessToken, AccessLog, PolicyStatus, AccessType
from access_control.serializers import (
    AccessPolicySerializer,
    CreateShareLinkSerializer,
    AccessLogSerializer
)
from access_control.validator import validate_access_policy, get_client_ip, get_user_agent
from security.token_gen import generate_ephemeral_token


class CreateShareLinkView(APIView):
    """
    Sender creates an ephemeral access link with strict receiver binding and policy constraints.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CreateShareLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Verify sender owns the file
        try:
            file_record = File.objects.get(id=data['file_id'], uploaded_by=request.user)
        except File.DoesNotExist:
            raise NotFound("File not found or you do not have permission to share it.")

        # Prevent sharing with oneself
        if data['resolved_receiver'] == request.user:
            return Response(
                {"error": "You cannot share a file with yourself. Please specify another registered user's email."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calculate expiration timestamp
        expires_at = timezone.now() + timedelta(minutes=data['duration_minutes'])

        # File password protection
        file_password = data.get('file_password', '').strip()
        pwd_hash = make_password(file_password) if file_password else ''

        sharing_channel = data.get('sharing_method', 'DIRECT').upper()
        is_ext = sharing_channel in ['WHATSAPP', 'GMAIL', 'TELEGRAM', 'NATIVE']

        # 1. Create Access Policy
        policy = AccessPolicy.objects.create(
            file=file_record,
            sender=request.user,
            receiver=data['resolved_receiver'],
            access_type=data['access_type'],
            password_hash=pwd_hash,
            subject=data.get('subject', '').strip(),
            message=data.get('message', '').strip(),
            sharing_method=sharing_channel,
            is_external=is_ext,
            expires_at=expires_at,
            max_accesses=data['max_accesses'],
            access_count=0,
            status=PolicyStatus.ACTIVE
        )

        # 2. Generate CSPRNG Ephemeral Token (256-bit entropy)
        raw_token, token_hash = generate_ephemeral_token(length_bytes=32)

        # 3. Store the token and its hash in database
        AccessToken.objects.create(
            policy=policy,
            token_hash=token_hash,
            raw_token=raw_token,
            is_active=True
        )

        # 4. Audit Log link generation
        has_pwd_str = " (Password Protected)" if pwd_hash else ""
        AccessLog.objects.create(
            policy=policy,
            file=file_record,
            user=request.user,
            event_type='LINK_CREATED',
            status='SUCCESS',
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            details=f"Ephemeral link generated for {data['resolved_receiver'].email}{has_pwd_str}. Policy: {policy.access_type}, Expiry: {policy.expires_at}, Max: {policy.max_accesses}"
        )

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        share_url = f"{frontend_url}/access/{raw_token}"

        return Response({
            "message": "Ephemeral access link created successfully.",
            "raw_token": raw_token,
            "share_url": share_url,
            "policy": AccessPolicySerializer(policy).data
        }, status=status.HTTP_201_CREATED)


class ValidateTokenView(APIView):
    """
    Receiver landing page verification: validates link state without consuming access count.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, token):
        password = request.GET.get('password') or request.headers.get('X-File-Password')
        policy, _ = validate_access_policy(
            raw_token=token,
            user=request.user,
            requested_action='METADATA',
            provided_password=password,
            request=request
        )

        remaining_accesses = max(0, policy.max_accesses - policy.access_count)
        requires_password = bool(policy.password_hash)
        password_verified = not requires_password or (bool(password) and check_password(password, policy.password_hash))

        return Response({
            "valid": True,
            "policy_id": policy.id,
            "file_name": policy.file.original_name,
            "file_size": policy.file.file_size_bytes,
            "mime_type": policy.file.mime_type,
            "access_type": policy.access_type,
            "subject": policy.subject,
            "message": policy.message,
            "sender_email": policy.sender.email,
            "receiver_email": policy.receiver.email,
            "expires_at": policy.expires_at,
            "remaining_accesses": remaining_accesses,
            "max_accesses": policy.max_accesses,
            "status": policy.status,
            "requires_password": requires_password,
            "password_verified": password_verified
        }, status=status.HTTP_200_OK)


class ViewOnlyStreamView(APIView):
    """
    In-browser viewer stream. Strictly serves decrypted content with Content-Disposition: inline.
    Consumes 1 access count.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, token):
        password = request.GET.get('password') or request.headers.get('X-File-Password')
        policy, plaintext = validate_access_policy(
            raw_token=token,
            user=request.user,
            requested_action='VIEW',
            provided_password=password,
            request=request
        )

        response = HttpResponse(plaintext, content_type=policy.file.mime_type)
        response['Content-Disposition'] = f'inline; filename="{policy.file.original_name}"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class DownloadStreamView(APIView):
    """
    Attachment download stream. Consumes 1 access count.
    CRITICAL: Strictly blocked if policy.access_type == VIEW_ONLY.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, token):
        password = request.GET.get('password') or request.headers.get('X-File-Password')
        policy, plaintext = validate_access_policy(
            raw_token=token,
            user=request.user,
            requested_action='DOWNLOAD',
            provided_password=password,
            request=request
        )

        response = HttpResponse(plaintext, content_type='application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{policy.file.original_name}"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class RevokeAccessView(APIView):
    """
    Sender manually revokes an active ephemeral link.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            policy = AccessPolicy.objects.select_related('file', 'receiver').get(id=pk, sender=request.user)
        except AccessPolicy.DoesNotExist:
            raise NotFound("Policy not found or you are not authorized to revoke it.")

        policy.status = PolicyStatus.REVOKED
        policy.revoked_at = timezone.now()
        policy.save(update_fields=['status', 'revoked_at'])

        # Deactivate token
        try:
            policy.token.is_active = False
            policy.token.save(update_fields=['is_active'])
        except AccessToken.DoesNotExist:
            pass

        AccessLog.objects.create(
            policy=policy,
            file=policy.file,
            user=request.user,
            event_type='REVOKED',
            status='SUCCESS',
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            details=f"Access policy revoked manually by sender {request.user.email}."
        )

        return Response({
            "message": "Access link revoked successfully.",
            "policy": AccessPolicySerializer(policy).data
        }, status=status.HTTP_200_OK)


class TrackExternalShareView(APIView):
    """
    Records an external share event (WhatsApp, Gmail, Telegram, Native, Copy Link)
    and updates the policy's sharing method and audit trail.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            policy = AccessPolicy.objects.select_related('file', 'receiver').get(id=pk, sender=request.user)
        except AccessPolicy.DoesNotExist:
            raise NotFound("Policy not found or you are not authorized to track it.")

        method = request.data.get('sharing_method', 'EXTERNAL').upper()
        allowed_methods = ['WHATSAPP', 'GMAIL', 'TELEGRAM', 'NATIVE', 'CLIPBOARD', 'DIRECT']
        if method not in allowed_methods:
            method = 'EXTERNAL'

        policy.sharing_method = method
        policy.is_external = True
        policy.save(update_fields=['sharing_method', 'is_external'])

        # Record in audit trail
        AccessLog.objects.create(
            policy=policy,
            file=policy.file,
            user=request.user,
            event_type='EXTERNAL_SHARE',
            status='SUCCESS',
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            details=f"Secure access link shared externally via {method} with intended recipient {policy.receiver.email}."
        )

        return Response({
            "message": f"External share via {method} tracked successfully.",
            "policy": AccessPolicySerializer(policy).data
        }, status=status.HTTP_200_OK)


class PolicyAccessHistoryView(generics.ListAPIView):
    """
    Returns the complete audit log trail for a specific access policy (shares, views, downloads, revocations, and unauthorized attempts).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AccessLogSerializer

    def get_queryset(self):
        pk = self.kwargs.get('pk')
        user = self.request.user
        try:
            policy = AccessPolicy.objects.get(id=pk)
            # Only sender or receiver can inspect this policy's history
            if policy.sender != user and policy.receiver != user:
                raise PermissionDenied("You do not have permission to view this policy's audit logs.")
        except AccessPolicy.DoesNotExist:
            raise NotFound("Policy not found.")

        return AccessLog.objects.filter(policy=policy).order_by('-timestamp')


class SenderSharesListView(generics.ListAPIView):
    """
    Lists all links created by the authenticated sender.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AccessPolicySerializer

    def get_queryset(self):
        return AccessPolicy.objects.filter(sender=self.request.user).select_related('file', 'sender', 'receiver')


class ReceiverSharesListView(generics.ListAPIView):
    """
    Lists all links shared with the authenticated receiver.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AccessPolicySerializer

    def get_queryset(self):
        return AccessPolicy.objects.filter(receiver=self.request.user).select_related('file', 'sender', 'receiver')


class AccessHistoryView(generics.ListAPIView):
    """
    Returns security audit log history for files/policies owned by or involving the caller.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AccessLogSerializer

    def get_queryset(self):
        user = self.request.user
        return AccessLog.objects.filter(
            models.Q(user=user) |
            models.Q(policy__sender=user) |
            models.Q(policy__receiver=user)
        ).distinct().order_by('-timestamp')[:100]


class SecurityStatsView(APIView):
    """
    Telemetry metrics for Sender and Security Dashboards.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        sender_policies = AccessPolicy.objects.filter(sender=user)
        
        now = timezone.now()
        active_count = sender_policies.filter(
            status=PolicyStatus.ACTIVE,
            expires_at__gt=now
        ).count()
        expired_count = sender_policies.filter(
            models.Q(status=PolicyStatus.EXPIRED) |
            models.Q(expires_at__lte=now)
        ).count()
        revoked_count = sender_policies.filter(status=PolicyStatus.REVOKED).count()
        limit_reached_count = sender_policies.filter(status=PolicyStatus.LIMIT_REACHED).count()

        total_files = File.objects.filter(uploaded_by=user).count()
        clean_files = File.objects.filter(uploaded_by=user, scan_status='CLEAN').count()

        # Audit events
        logs = AccessLog.objects.filter(policy__sender=user)
        total_accesses = logs.filter(event_type__in=['VIEW', 'DOWNLOAD']).count()
        total_downloads = logs.filter(event_type='DOWNLOAD').count()
        denied_attempts = logs.filter(event_type__in=['ACCESS_DENIED', 'WRONG_RECEIVER']).count()

        return Response({
            "total_files": total_files,
            "clean_files": clean_files,
            "active_links": active_count,
            "expired_links": expired_count,
            "revoked_links": revoked_count,
            "limit_reached_links": limit_reached_count,
            "total_accesses": total_accesses,
            "total_downloads": total_downloads,
            "denied_attempts": denied_attempts,
        }, status=status.HTTP_200_OK)
