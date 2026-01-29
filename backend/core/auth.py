"""
Core authentication and password hashing logic.
"""

import hashlib
import secrets


def generate_salt() -> str:
    """Generate a random hex salt.

    Returns:
        A 32-character hex string.
    """
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    """Hash a password with a salt using SHA256.

    Args:
        password: The plain text password.
        salt: The salt string.

    Returns:
        The hex-encoded SHA256 hash.
    """
    return hashlib.sha256((password + salt).encode()).hexdigest()


def verify_password(password: str, salt: str, hashed: str) -> bool:
    """Verify a password against its hash and salt.

    Args:
        password: The plain text password to check.
        salt: The salt used for hashing.
        hashed: The expected hash.

    Returns:
        True if the password is correct, False otherwise.
    """
    return hash_password(password, salt) == hashed
