"""
Serializers for Access Policy, Link Creation, and Audit Logging.
"""

from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from access_control.models import AccessPolicy, AccessLog, AccessType, PolicyStatus
from files.serializers import FileSerializer
from accounts.serializers import UserSerializer
from accounts.models import User


class AccessPolicySerializer(serializers.ModelSerializer):
    """
    Public and dashboard view of an access policy.
    """
    file = FileSerializer(read_only=True)
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    is_valid_now = serializers.SerializerMethodField()
    requires_password = serializers.SerializerMethodField()
    raw_token = serializers.SerializerMethodField()
    share_url = serializers.SerializerMethodField()

    class Meta:
        model = AccessPolicy
        fields = [
            'id',
            'file',
            'sender',
            'receiver',
            'access_type',
            'expires_at',
            'max_accesses',
            'access_count',
            'status',
            'created_at',
            'revoked_at',
            'is_valid_now',
            'requires_password',
            'raw_token',
            'share_url'
        ]
        read_only_fields = fields

    def get_is_valid_now(self, obj) -> bool:
        return obj.is_active()

    def get_requires_password(self, obj) -> bool:
        return bool(obj.password_hash)

    def get_raw_token(self, obj) -> str:
        try:
            if hasattr(obj, 'token') and obj.token.raw_token:
                return obj.token.raw_token
        except Exception:
            pass
        return ''

    def get_share_url(self, obj) -> str:
        from django.conf import settings
        token = self.get_raw_token(obj)
        if token:
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            return f"{frontend_url}/access/{token}"
        return ''


class CreateShareLinkSerializer(serializers.Serializer):
    """
    Validates parameters for generating a new ephemeral access link.
    """
    file_id = serializers.UUIDField(required=True)
    receiver_id = serializers.UUIDField(required=False)
    receiver_email = serializers.EmailField(required=False)
    file_password = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        max_length=100,
        help_text="Optional password required to unlock and open file"
    )
    access_type = serializers.ChoiceField(
        choices=AccessType.choices,
        default=AccessType.VIEW_ONLY
    )
    duration_minutes = serializers.IntegerField(
        min_value=1,
        max_value=10080,  # Max 7 days in minutes
        default=10,
        help_text="Link lifetime in minutes"
    )
    max_accesses = serializers.IntegerField(
        min_value=1,
        max_value=100,
        default=1,
        help_text="Maximum allowed accesses"
    )

    def validate(self, attrs):
        # Resolve receiver by ID or Email
        receiver_id = attrs.get('receiver_id')
        receiver_email = attrs.get('receiver_email')

        if not receiver_id and not receiver_email:
            raise serializers.ValidationError("Either receiver_id or receiver_email must be specified.")

        if receiver_id:
            try:
                receiver = User.objects.get(id=receiver_id)
            except User.DoesNotExist:
                raise serializers.ValidationError("Specified receiver does not exist in the system.")
        else:
            clean_email = receiver_email.strip().lower()
            receiver = User.objects.filter(email__iexact=clean_email).first()
            if not receiver:
                # Automatically create receiver account for this email (Gmail-style recipient support)
                base_username = clean_email.split('@')[0]
                clean_username = "".join(c for c in base_username if c.isalnum() or c in ('_', '-')) or 'user'
                unique_username = clean_username
                counter = 1
                while User.objects.filter(username=unique_username).exists():
                    unique_username = f"{clean_username}_{counter}"
                    counter += 1
                
                receiver = User.objects.create(
                    username=unique_username,
                    email=clean_email,
                    role='BOTH'
                )
                receiver.set_unusable_password()
                receiver.save()

        attrs['resolved_receiver'] = receiver
        return attrs


class AccessLogSerializer(serializers.ModelSerializer):
    """
    Serializer for security audit logs.
    """
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    file_name = serializers.CharField(source='file.original_name', read_only=True)

    class Meta:
        model = AccessLog
        fields = [
            'id',
            'event_type',
            'status',
            'ip_address',
            'user_agent',
            'details',
            'timestamp',
            'user_email',
            'user_name',
            'file_name',
        ]
        read_only_fields = fields
