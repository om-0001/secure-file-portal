"""
File Upload, Quarantine, Malware Scanning, and Encryption Views.
"""

import uuid
import os
from pathlib import Path
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings

from files.models import File, FileEncryptionMetadata
from files.serializers import FileSerializer
from files.validators import validate_file_upload
from malware_scanner.scanner import scan_file, ScanStatus
from security.encryption import encrypt_bytes
from security.hashing import compute_sha256_bytes


class FileUploadView(APIView):
    """
    Handles secure multipart file upload:
    1. Validation (extension, size, MIME type).
    2. Quarantine in isolated temporary storage.
    3. Malware scanning (ClamAV / Isolated engine).
    4. AES-256-GCM authenticated encryption.
    5. Storage in encrypted vault & removal of quarantine file.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response(
                {"error": "No file provided in request."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Validation checks
        mime_type = validate_file_upload(uploaded_file)

        # 2. Stage into quarantine storage
        file_id = uuid.uuid4()
        sanitized_name = Path(uploaded_file.name).name
        quarantine_filename = f"{file_id}_{sanitized_name}"
        quarantine_path = settings.QUARANTINE_DIR / quarantine_filename

        with open(quarantine_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        # 3. Malware Scan
        scan_result = scan_file(quarantine_path)

        if scan_result['status'] == ScanStatus.INFECTED:
            # Purge quarantined threat immediately from disk
            if quarantine_path.exists():
                quarantine_path.unlink()

            return Response({
                "error": "Malware scan failed. File rejected.",
                "scan_status": scan_result['status'],
                "threat": scan_result['threat_name'],
                "details": scan_result['details'],
                "engine": scan_result['engine']
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Read plaintext, compute SHA-256 integrity hash, and Encrypt with AES-256-GCM
        try:
            with open(quarantine_path, 'rb') as f:
                plaintext = f.read()

            sha256_hash = compute_sha256_bytes(plaintext)
            crypto_bundle = encrypt_bytes(plaintext)

            # 5. Store ciphertext into secure encrypted vault
            encrypted_filename = f"{file_id}.enc"
            encrypted_path = settings.ENCRYPTED_VAULT_DIR / encrypted_filename

            with open(encrypted_path, 'wb') as f:
                f.write(crypto_bundle['ciphertext'])

        finally:
            # Crucial: Purge quarantine plaintext file from disk regardless of success or error
            if quarantine_path.exists():
                quarantine_path.unlink()

        # 6. Persist metadata in Database
        file_record = File.objects.create(
            id=file_id,
            uploaded_by=request.user,
            original_name=sanitized_name,
            file_size_bytes=uploaded_file.size,
            mime_type=mime_type,
            sha256_hash=sha256_hash,
            scan_status=scan_result['status'],
            scan_details=scan_result['details'],
            encrypted_file_path=str(encrypted_path)
        )

        FileEncryptionMetadata.objects.create(
            file=file_record,
            algorithm='AES-256-GCM',
            nonce_base64=crypto_bundle['nonce_b64'],
            encrypted_key_blob=crypto_bundle['encrypted_key_b64']
        )

        return Response({
            "message": "File successfully scanned, encrypted, and vaulted.",
            "file": FileSerializer(file_record).data,
            "scan_engine": scan_result['engine'],
        }, status=status.HTTP_201_CREATED)


class FileListView(generics.ListAPIView):
    """
    List files uploaded by the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FileSerializer

    def get_queryset(self):
        return File.objects.filter(uploaded_by=self.request.user)


class FileDetailView(generics.RetrieveAPIView):
    """
    Retrieve metadata for a specific uploaded file.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FileSerializer

    def get_queryset(self):
        return File.objects.filter(uploaded_by=self.request.user)
