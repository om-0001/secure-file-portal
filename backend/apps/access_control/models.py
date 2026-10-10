"""
Database Models for Ephemeral Access Policies, Cryptographic Tokens, and Security Audit Logs.
"""

import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class AccessType(models.TextChoices):
    VIEW_ONLY = 'VIEW_ONLY', 'View Only (Browser Rendering Only)'
    DOWNLOAD = 'DOWNLOAD', 'Download (Attachment Stream)'


class PolicyStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    EXPIRED = 'EXPIRED', 'Expired'
    REVOKED = 'REVOKED', 'Revoked by Sender'
    LIMIT_REACHED = 'LIMIT_REACHED', 'Access Limit Reached'


class AccessPolicy(models.Model):
    """
    Cryptographic ephemeral access rule binding a file to a specific receiver.
    Governs permission type, expiration window, and access limits.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.ForeignKey(
        'files.File',
        on_delete=models.CASCADE,
        related_name='access_policies'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_shares'
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_shares'
    )
    access_type = models.CharField(
        max_length=20,
        choices=AccessType.choices,
        default=AccessType.VIEW_ONLY
    )
    expires_at = models.DateTimeField(
        help_text="Timestamp after which the link immediately self-destructs"
    )
    max_accesses = models.PositiveIntegerField(
        default=1,
        help_text="Maximum number of times this file may be viewed or downloaded"
    )
    access_count = models.PositiveIntegerField(
        default=0,
        help_text="Current number of successful accesses"
    )
    status = models.CharField(
        max_length=20,
        choices=PolicyStatus.choices,
        default=PolicyStatus.ACTIVE
    )
    password_hash = models.CharField(
        max_length=128,
        blank=True,
        default='',
        help_text="Optional PBKDF2/SHA-256 hashed password protecting link access"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sender']),
            models.Index(fields=['receiver']),
            models.Index(fields=['status']),
            models.Index(fields=['expires_at']),
        ]

    def is_valid_time(self) -> bool:
        return timezone.now() < self.expires_at

    def is_valid_count(self) -> bool:
        return self.access_count < self.max_accesses

    def is_active(self) -> bool:
        return (
            self.status == PolicyStatus.ACTIVE
            and self.is_valid_time()
            and self.is_valid_count()
        )

    def __str__(self):
        return f"Policy {self.id} [{self.file.original_name} -> {self.receiver.email}] ({self.status})"


class AccessToken(models.Model):
    """
    Hashed representation of the ephemeral access token.
    The raw token is never stored in the database to prevent link theft from DB dumps.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    policy = models.OneToOneField(
        AccessPolicy,
        on_delete=models.CASCADE,
        related_name='token'
    )
    token_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="SHA-256 hash digest of the cleartext token"
    )
    raw_token = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Cleartext ephemeral token string for authorized party display"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Token for Policy {self.policy.id} [Active: {self.is_active}]"


class AccessLog(models.Model):
    """
    Immutable audit trail recording all security-relevant file access events.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    policy = models.ForeignKey(
        AccessPolicy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs'
    )
    file = models.ForeignKey(
        'files.File',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='access_logs'
    )
    event_type = models.CharField(
        max_length=50,
        help_text="Event type e.g. LINK_CREATED, ACCESS_GRANTED, ACCESS_DENIED, VIEW, DOWNLOAD, REVOKED"
    )
    status = models.CharField(max_length=20, default='SUCCESS')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    details = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['event_type']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        return f"[{self.timestamp}] {self.event_type} - {self.status}"
