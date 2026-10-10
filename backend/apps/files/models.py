"""
Database Models for Files and Cryptographic Encryption Metadata.
"""

import uuid
from django.db import models
from django.conf import settings


class File(models.Model):
    """
    Metadata representation of an uploaded file.
    The actual file contents on disk are strictly encrypted with AES-256-GCM.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="UUID unique file identifier"
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='uploaded_files'
    )
    original_name = models.CharField(max_length=255)
    file_size_bytes = models.BigIntegerField()
    mime_type = models.CharField(max_length=100)
    sha256_hash = models.CharField(
        max_length=64,
        help_text="Cryptographic SHA-256 fingerprint of the original plaintext for integrity verification"
    )
    scan_status = models.CharField(
        max_length=30,
        default='PENDING',
        help_text="CLEAN, INFECTED, SCANNER_UNAVAILABLE, or ERROR"
    )
    scan_details = models.TextField(blank=True, default='')
    encrypted_file_path = models.CharField(
        max_length=500,
        help_text="Relative or absolute path to the AES-256-GCM encrypted payload on disk"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['uploaded_by']),
            models.Index(fields=['sha256_hash']),
            models.Index(fields=['scan_status']),
        ]

    def __str__(self):
        return f"{self.original_name} ({self.id}) - [{self.scan_status}]"


class FileEncryptionMetadata(models.Model):
    """
    Cryptographic parameters required to decrypt the file ciphertext.
    The Data Encryption Key (DEK) is securely wrapped with the Master KEK.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.OneToOneField(
        File,
        on_delete=models.CASCADE,
        related_name='encryption_metadata'
    )
    algorithm = models.CharField(max_length=50, default='AES-256-GCM')
    nonce_base64 = models.CharField(
        max_length=100,
        help_text="Base64 encoded 96-bit initialization vector"
    )
    encrypted_key_blob = models.TextField(
        help_text="Base64 encoded wrapped Data Encryption Key (DEK)"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"CryptoMeta for {self.file.original_name} [{self.algorithm}]"
