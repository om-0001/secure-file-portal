"""
Serializers for File Management.
"""

from rest_framework import serializers
from files.models import File
from accounts.serializers import UserSerializer


class FileSerializer(serializers.ModelSerializer):
    """
    Public metadata serializer for uploaded files.
    Safely hides internal server storage paths and cryptographic keys.
    """
    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = File
        fields = [
            'id',
            'original_name',
            'file_size_bytes',
            'mime_type',
            'sha256_hash',
            'scan_status',
            'scan_details',
            'created_at',
            'uploaded_by'
        ]
        read_only_fields = fields
