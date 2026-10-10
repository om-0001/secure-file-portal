"""
Cryptographic Hashing Utilities.

Provides SHA-256 cryptographic digests for:
1. File integrity fingerprinting (original plaintext hashing).
2. Ephemeral access token hashing for secure at-rest storage.

IMPORTANT:
- Encryption provides confidentiality (reversible with the key).
- Hashing provides an irreversible one-way fingerprint.
- SHA-256 is NOT used for passwords (Django uses PBKDF2/SHA-256 with salts).
"""

import hashlib


def compute_sha256_bytes(data: bytes) -> str:
    """
    Computes the SHA-256 hexadecimal hash digest of raw bytes.
    """
    hasher = hashlib.sha256()
    hasher.update(data)
    return hasher.hexdigest()


def compute_sha256_file(file_path: str, chunk_size: int = 65536) -> str:
    """
    Computes SHA-256 digest of a file by streaming chunks to avoid high memory usage.
    """
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest()


def hash_token(raw_token: str) -> str:
    """
    Computes SHA-256 hash of an ephemeral access token for secure database lookup.
    """
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
