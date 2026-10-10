"""
Cryptographically Secure Random Token Generator.

Uses Python's `secrets` module (backed by the operating system's CSPRNG `os.urandom`)
to produce unpredictable, high-entropy access tokens.

RULES:
- Never use pseudo-random generators like random.random() or Math.random().
- Never rely on timestamps, sequential IDs, or simple strings.
"""

import secrets
from typing import Tuple
from security.hashing import hash_token


def generate_ephemeral_token(length_bytes: int = 32) -> Tuple[str, str]:
    """
    Generates a cryptographically secure URL-safe ephemeral token.
    
    Args:
        length_bytes: Number of random bytes of entropy (default 32 bytes = 256 bits).
        
    Returns:
        Tuple containing:
        - raw_token: The string given to the authorized receiver in the ephemeral link.
        - token_hash: SHA-256 hex digest of the raw token, stored in the database.
    """
    raw_token = secrets.token_urlsafe(length_bytes)
    hashed_token = hash_token(raw_token)
    return raw_token, hashed_token
