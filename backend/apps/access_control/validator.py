"""
12-Step Cryptographic & Policy Access Validation Pipeline.

Enforces server-side zero-trust verification of every access request:
The ephemeral link itself does NOT grant access without meeting all 12 criteria.
"""

from typing import Tuple, Optional
from django.utils import timezone
from django.db import transaction
from django.contrib.auth.hashers import check_password
from rest_framework.exceptions import PermissionDenied, NotFound, AuthenticationFailed
from access_control.models import AccessPolicy, AccessToken, AccessLog, PolicyStatus, AccessType
from security.hashing import hash_token
from security.encryption import decrypt_bytes


def get_client_ip(request) -> str:
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def get_user_agent(request) -> str:
    return request.META.get('HTTP_USER_AGENT', '')[:500]


def validate_access_policy(
    raw_token: str,
    user,
    requested_action: str = 'VIEW',  # 'VIEW' or 'DOWNLOAD' or 'METADATA'
    provided_password: Optional[str] = None,
    request=None
) -> Tuple[AccessPolicy, Optional[bytes]]:
    """
    Executes the comprehensive 12-step validation algorithm.

    Returns:
        Tuple[AccessPolicy, Optional[bytes]]: The valid policy and decrypted payload (if applicable).

    Raises:
        AuthenticationFailed: If user is unauthenticated.
        NotFound: If token is invalid.
        PermissionDenied: If receiver mismatch, expired, limit reached, revoked, or forbidden action.
    """
    ip = get_client_ip(request) if request else ''
    ua = get_user_agent(request) if request else ''

    # Step 1: Authentication Check
    if not user or not user.is_authenticated:
        if request:
            AccessLog.objects.create(
                event_type='ACCESS_DENIED',
                status='FAILURE',
                ip_address=ip,
                user_agent=ua,
                details='Unauthenticated user attempted to access link.'
            )
        raise AuthenticationFailed("Authentication required to access this file.")

    # Step 2: Token Hash Lookup
    token_digest = hash_token(raw_token)
    try:
        token_record = AccessToken.objects.select_related('policy', 'policy__file', 'policy__receiver', 'policy__sender').get(token_hash=token_digest)
    except AccessToken.DoesNotExist:
        if request:
            AccessLog.objects.create(
                user=user,
                event_type='ACCESS_DENIED',
                status='FAILURE',
                ip_address=ip,
                user_agent=ua,
                details='Invalid access token submitted.'
            )
        raise NotFound("Invalid or non-existent access link.")

    policy = token_record.policy

    # Step 3: Strict Receiver Identity Check (Receiver Binding & Forwarding Prevention)
    if policy.receiver_id != user.id:
        AccessLog.objects.create(
            policy=policy,
            file=policy.file,
            user=user,
            event_type='WRONG_RECEIVER',
            status='FAILURE',
            ip_address=ip,
            user_agent=ua,
            details=f"Unauthorized forwarding attempt by user {user.username} ({user.email}). Intended for {policy.receiver.email}."
        )
        raise PermissionDenied("Access Denied: You are not the designated recipient for this file.")

    # Step 4: Manual Revocation Check
    if policy.status == PolicyStatus.REVOKED:
        AccessLog.objects.create(
            policy=policy,
            file=policy.file,
            user=user,
            event_type='REVOKED',
            status='FAILURE',
            ip_address=ip,
            user_agent=ua,
            details='User attempted access on a link manually revoked by the sender.'
        )
        raise PermissionDenied("Access Denied: Access to this file has been revoked by the sender.")

    # Step 5: Expiration Timestamp Check
    if timezone.now() >= policy.expires_at or policy.status == PolicyStatus.EXPIRED:
        with transaction.atomic():
            policy.status = PolicyStatus.EXPIRED
            policy.save(update_fields=['status'])
            token_record.is_active = False
            token_record.save(update_fields=['is_active'])

        AccessLog.objects.create(
            policy=policy,
            file=policy.file,
            user=user,
            event_type='EXPIRED',
            status='FAILURE',
            ip_address=ip,
            user_agent=ua,
            details='User attempted access on an expired link.'
        )
        raise PermissionDenied("Access Denied: This ephemeral link has expired.")

    # Step 6: Access Count Check
    if policy.access_count >= policy.max_accesses or policy.status == PolicyStatus.LIMIT_REACHED:
        with transaction.atomic():
            policy.status = PolicyStatus.LIMIT_REACHED
            policy.save(update_fields=['status'])
            token_record.is_active = False
            token_record.save(update_fields=['is_active'])

        AccessLog.objects.create(
            policy=policy,
            file=policy.file,
            user=user,
            event_type='LIMIT_REACHED',
            status='FAILURE',
            ip_address=ip,
            user_agent=ua,
            details=f"Access limit reached ({policy.access_count}/{policy.max_accesses})."
        )
        raise PermissionDenied(f"Access Denied: Maximum access limit ({policy.max_accesses}) for this link has been reached.")

    # Step 7: Check Token Active State
    if not token_record.is_active:
        AccessLog.objects.create(
            policy=policy,
            file=policy.file,
            user=user,
            event_type='ACCESS_DENIED',
            status='FAILURE',
            ip_address=ip,
            user_agent=ua,
            details='Token has been deactivated.'
        )
        raise PermissionDenied("This access link is no longer active.")

    # Step 7.5: File Access Password Protection Check
    if policy.password_hash:
        if requested_action == 'METADATA':
            if provided_password and not check_password(provided_password, policy.password_hash):
                raise PermissionDenied("Access Denied: Incorrect file access password.")
        else:
            if not provided_password or not check_password(provided_password, policy.password_hash):
                AccessLog.objects.create(
                    policy=policy,
                    file=policy.file,
                    user=user,
                    event_type='ACCESS_DENIED',
                    status='FAILURE',
                    ip_address=ip,
                    user_agent=ua,
                    details='Access denied: Incorrect or missing file access password.'
                )
                raise PermissionDenied("Access Denied: Incorrect or missing file access password.")

    # Step 8: Strict Access Type Server Enforcement (View Only vs. Download)
    if requested_action == 'DOWNLOAD' and policy.access_type == AccessType.VIEW_ONLY:
        AccessLog.objects.create(
            policy=policy,
            file=policy.file,
            user=user,
            event_type='ACCESS_DENIED',
            status='FAILURE',
            ip_address=ip,
            user_agent=ua,
            details='Illegal download attempt on a VIEW_ONLY configured policy.'
        )
        raise PermissionDenied("Access Denied: This file is restricted to in-browser viewing only. Downloading is strictly prohibited.")

    # If only validating metadata (e.g. initial landing check), do not increment count yet
    if requested_action == 'METADATA':
        return policy, None

    # Step 9 & 10: Atomic Increment and Limit Invalidation
    with transaction.atomic():
        # Lock row for update to prevent concurrent race condition bypass
        locked_policy = AccessPolicy.objects.select_for_update().get(id=policy.id)
        locked_policy.access_count += 1

        if locked_policy.access_count >= locked_policy.max_accesses:
            locked_policy.status = PolicyStatus.LIMIT_REACHED
            token_record.is_active = False
            token_record.save(update_fields=['is_active'])

        locked_policy.save(update_fields=['access_count', 'status'])
        policy = locked_policy

    # Step 11: Decrypt Payload from Encrypted Vault
    file_record = policy.file
    crypto_meta = file_record.encryption_metadata

    with open(file_record.encrypted_file_path, 'rb') as f:
        ciphertext = f.read()

    plaintext = decrypt_bytes(
        ciphertext=ciphertext,
        nonce_b64=crypto_meta.nonce_base64,
        encrypted_key_b64=crypto_meta.encrypted_key_blob
    )

    # Step 12: Record Security Audit Log
    event = 'DOWNLOAD' if requested_action == 'DOWNLOAD' else 'VIEW'
    AccessLog.objects.create(
        policy=policy,
        file=file_record,
        user=user,
        event_type=event,
        status='SUCCESS',
        ip_address=ip,
        user_agent=ua,
        details=f"Successful {event} access (Count {policy.access_count}/{policy.max_accesses})."
    )

    return policy, plaintext
