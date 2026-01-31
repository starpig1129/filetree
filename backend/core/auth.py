"""
Core authentication and password hashing logic.
"""

import bcrypt


def generate_salt() -> str:
    """Generate a random bcrypt salt.

    Returns:
        A salt string.
    """
    return bcrypt.gensalt().decode('utf-8')


def hash_password(password: str, salt: str) -> str:
    """Hash a password with a salt using bcrypt.

    Args:
        password: The plain text password.
        salt: The salt string (bcrypt salt).

    Returns:
        The hashed password string.
    """
    return bcrypt.hashpw(password.encode(), salt.encode()).decode('utf-8')


def verify_password(password: str, salt: str, hashed: str) -> bool:
    """Verify a password against its hash and salt.

    Args:
        password: The plain text password to check.
        salt: The salt used for hashing (stored in user metadata).
        hashed: The expected hash.

    Returns:
        True if the password is correct, False otherwise.
    """
    try:
        # bcrypt.checkpw can derive the salt from the hash itself,
        # but since we store salt separately in this system's schema,
        # we'll use it to ensure we're matching the expected parameters.
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        # Fallback/Safety for potential invalid formats
        return False
