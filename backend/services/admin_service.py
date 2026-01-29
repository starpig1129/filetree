"""
Service for administrative operations and security validation.
"""

from typing import Optional
from fastapi import Request, HTTPException
from backend.config import settings

class AdminService:
    """Service handling high-level administrative logic."""

    def __init__(self, master_key: Optional[str] = None):
        """Initialize with a master key.
        
        In production, this should be pulled from environment variables.
        """
        # Default fallback if not in config
        self.master_key = master_key or "pigstar"

    def verify_request(self, request: Request, provided_key: str) -> bool:
        """Verify if the request comes from localhost and has the correct master key.

        Args:
            request: The FastAPI request object.
            provided_key: The master key provided by the user.

        Raises:
            HTTPException: If verification fails.
        """
        # 1. IP Whitelisting (Localhost only)
        # Note: In some proxy setups, you might need to check X-Forwarded-For
        client_host = request.client.host
        if client_host not in ("127.0.0.1", "::1"):
             raise HTTPException(
                status_code=403, 
                detail="Security Protocol Breach: Management interface only accessible from local matrix."
            )

        # 2. Master Key Verification
        if provided_key != self.master_key:
            raise HTTPException(
                status_code=401,
                detail="Authority Verification Failed: Invalid Master Key."
            )
        
        return True

# Singleton instance
admin_service = AdminService()
