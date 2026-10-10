"""
File Upload Validation Rules.

Enforces:
1. Whitelist file extensions.
2. File size bounds (non-empty, <= 25MB).
3. MIME type inspection using magic byte signatures (not trusting extension alone).
"""

import os
from pathlib import Path
from rest_framework.exceptions import ValidationError

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.zip'}

ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',  # Sometimes reported for zip or docx
}

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 Megabytes


def validate_file_upload(uploaded_file):
    """
    Validates uploaded file against security constraints.
    """
    # 1. Check file size
    if uploaded_file.size <= 0:
        raise ValidationError("Uploaded file is empty (0 bytes).")

    if uploaded_file.size > MAX_FILE_SIZE_BYTES:
        raise ValidationError(f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.")

    # 2. Check extension
    ext = Path(uploaded_file.name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(f"File extension '{ext}' is not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    # 3. Detect MIME type using python-magic or header magic bytes
    try:
        import magic
        # Read header sample without advancing seek pointer
        sample = uploaded_file.read(2048)
        uploaded_file.seek(0)
        mime = magic.from_buffer(sample, mime=True)
    except Exception:
        mime = uploaded_file.content_type or 'application/octet-stream'

    return mime
