"""
Sharing service for temporary download tokens.
"""

import secrets
from datetime import datetime, timedelta
from typing import Dict, Optional
from pydantic import BaseModel


class TokenInfo(BaseModel):
    """Metadata for a sharing or access token."""
    username: str
    filename: Optional[str] = None  # None for full access tokens
    expiry: datetime
    token_type: str = "share" # 'share' or 'access'


class TokenService:
    """Service for generating and validating tokens."""

    def __init__(self, expiry_hours: int = 24):
        """Initialize the service.

        Args:
            expiry_hours: How long tokens remain valid.
        """
        self.expiry_hours = expiry_hours
        self.tokens: Dict[str, TokenInfo] = {}

    def create_token(self, username: str, filename: str) -> str:
        """Create a new sharing token for a specific file.

        Args:
            username: The owner of the file.
            filename: The file to share.

        Returns:
            A unique token string.
        """
        token = secrets.token_urlsafe(32)
        expiry = datetime.now() + timedelta(hours=self.expiry_hours)
        self.tokens[token] = TokenInfo(
            username=username,
            filename=filename,
            expiry=expiry,
            token_type="share"
        )
        self._cleanup()
        return token

    def create_access_token(self, username: str) -> str:
        """Create a general access token for a user session.

        Args:
            username: The user to authorize.

        Returns:
            A unique token string.
        """
        token = secrets.token_urlsafe(32)
        expiry = datetime.now() + timedelta(hours=self.expiry_hours)
        self.tokens[token] = TokenInfo(
            username=username,
            expiry=expiry,
            token_type="access"
        )
        self._cleanup()
        return token

    def validate_token(self, token: str) -> Optional[TokenInfo]:
        """Check if a token is valid and not expired.

        Args:
            token: The token to check.

        Returns:
            TokenInfo if valid, None otherwise.
        """
        info = self.tokens.get(token)
        if not info:
            return None
            
        if datetime.now() > info.expiry:
            del self.tokens[token]
            return None
            
        return info

    def _cleanup(self) -> None:
        """Remove expired tokens from memory."""
        now = datetime.now()
        expired = [t for t, info in self.tokens.items() if now > info.expiry]
        for t in expired:
            del self.tokens[t]


# Singleton instance
token_service = TokenService()
