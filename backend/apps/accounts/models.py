"""
Custom User Model for Secure File Exchange Portal.

Provides role-based identification (SENDER, RECEIVER, BOTH)
and UUID primary keys for secure, non-enumerable user references.
"""

import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class UserRole(models.TextChoices):
    SENDER = 'SENDER', 'Sender'
    RECEIVER = 'RECEIVER', 'Receiver'
    BOTH = 'BOTH', 'Both (Sender & Receiver)'


class User(AbstractUser):
    """
    Extended user model using UUID as primary key to prevent enumeration attacks.
    Email is unique and required.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique UUID identifier for this user"
    )
    email = models.EmailField(
        unique=True,
        blank=False,
        help_text="User email address used for identity and receiver binding"
    )
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.BOTH,
        help_text="User functional role within the exchange portal"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    REQUIRED_FIELDS = ['email']

    class Meta:
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return f"{self.username} ({self.email}) [{self.role}]"
