"""
AES-256-GCM File Encryption and Decryption Module.

Uses the Python `cryptography` library's standardized `AESGCM` primitive.
Implements envelope encryption:
1. Each file is encrypted with a unique, randomly generated 256-bit Data Encryption Key (DEK).
2. A 96-bit (12-byte) initialization vector (nonce) is generated per encryption from OS entropy.
3. AES-GCM generates ciphertext and a 128-bit authentication tag to detect any tampering.
4. The DEK is encrypted (wrapped) using the server's master key (KEK) and stored safely.

SECURITY RULES:
- Never hardcode encryption keys.
- Never reuse a (key, nonce) pair in GCM mode.
- Never implement AES manually from scratch.
"""

import os
import base64
from typing import Dict, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings


def _get_master_kek() -> bytes:
    """
    Derives or parses the 32-byte (256-bit) Master Key Encryption Key (KEK).
    """
    raw_key = getattr(settings, 'MASTER_ENCRYPTION_KEY', None)
    if not raw_key:
        raise ValueError("MASTER_ENCRYPTION_KEY is not configured in settings.")

    # Accept either 64-character hex string or raw utf-8 string padded to 32 bytes
    if len(raw_key) == 64:
        try:
            return bytes.fromhex(raw_key)
        except ValueError:
            pass

    key_bytes = raw_key.encode('utf-8')
    if len(key_bytes) < 32:
        return key_bytes.ljust(32, b'\0')
    return key_bytes[:32]


def encrypt_bytes(plaintext: bytes) -> Dict[str, str | bytes]:
    """
    Encrypts arbitrary byte payload using AES-256-GCM envelope encryption.

    Returns:
        Dictionary containing:
        - ciphertext: The encrypted bytes (including GCM authentication tag).
        - nonce_b64: Base64-encoded 96-bit initialization vector.
        - encrypted_key_b64: Base64-encoded wrapped Data Encryption Key (DEK).
    """
    # 1. Generate unique 256-bit Data Encryption Key (DEK) for this file
    dek = AESGCM.generate_key(bit_length=256)

    # 2. Generate unique 96-bit (12-byte) Nonce for this file
    file_nonce = os.urandom(12)

    # 3. Encrypt file payload using DEK in AES-GCM mode
    aesgcm_file = AESGCM(dek)
    # Note: in cryptography library, AESGCM.encrypt appends 16-byte tag to ciphertext
    ciphertext = aesgcm_file.encrypt(file_nonce, plaintext, associated_data=None)

    # 4. Wrap (encrypt) the DEK using the Master KEK
    master_kek = _get_master_kek()
    master_aesgcm = AESGCM(master_kek)
    kek_nonce = os.urandom(12)
    wrapped_dek = kek_nonce + master_aesgcm.encrypt(kek_nonce, dek, associated_data=None)

    return {
        "ciphertext": ciphertext,
        "nonce_b64": base64.b64encode(file_nonce).decode('utf-8'),
        "encrypted_key_b64": base64.b64encode(wrapped_dek).decode('utf-8'),
    }


def decrypt_bytes(ciphertext: bytes, nonce_b64: str, encrypted_key_b64: str) -> bytes:
    """
    Decrypts AES-256-GCM ciphertext by unwrapping the DEK and validating integrity.

    Raises:
        cryptography.exceptions.InvalidTag: If ciphertext or metadata has been tampered with.
    """
    # 1. Unwrap DEK using Master KEK
    master_kek = _get_master_kek()
    wrapped_dek = base64.b64decode(encrypted_key_b64.encode('utf-8'))
    kek_nonce = wrapped_dek[:12]
    encrypted_dek_payload = wrapped_dek[12:]

    master_aesgcm = AESGCM(master_kek)
    dek = master_aesgcm.decrypt(kek_nonce, encrypted_dek_payload, associated_data=None)

    # 2. Decrypt file payload using unwrapped DEK and nonce
    file_nonce = base64.b64decode(nonce_b64.encode('utf-8'))
    aesgcm_file = AESGCM(dek)
    plaintext = aesgcm_file.decrypt(file_nonce, ciphertext, associated_data=None)

    return plaintext
