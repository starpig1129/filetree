"""
Service for administrative operations and security validation.
"""

import ipaddress
from typing import Optional
from fastapi import Request, HTTPException
from backend.config import settings


def get_real_client_ip(request: Request) -> str:
    """Extract real client IP from proxy headers or direct connection.
    
    Priority:
    1. CF-Connecting-IP (Cloudflare)
    2. X-Forwarded-For (standard proxy, first IP)
    3. request.client.host (direct connection)
    """
    # Cloudflare specific header
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()
    
    # Standard proxy header (comma-separated, first is original client)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    # Direct connection
    return request.client.host if request.client else "unknown"


def is_internal_network(ip_str: str) -> bool:
    """Check if an IP address belongs to an internal/private network.
    
    Internal networks:
    - 127.0.0.0/8 (localhost)
    - 10.0.0.0/8 (Class A private)
    - 172.16.0.0/12 (Class B private)
    - 192.168.0.0/16 (Class C private)
    - ::1 (IPv6 localhost)
    """
    if ip_str in ("::1", "localhost"):
        return True
    
    try:
        ip = ipaddress.ip_address(ip_str)
        # Check for private/loopback
        return ip.is_private or ip.is_loopback
    except ValueError:
        # Invalid IP format, treat as external for safety
        return False


class AdminService:
    """Service handling high-level administrative logic."""

    def __init__(self, master_key: Optional[str] = None):
        """Initialize with a master key."""
        self.master_key = master_key or settings.security.master_key

    def verify_request(self, request: Request, provided_key: str) -> bool:
        """Verify if the request comes from internal network and has the correct key.
        
        Raises:
            HTTPException 418: External network access attempt
            HTTPException 401: Invalid master key
        """
        # 1. Get real client IP (considering proxies)
        client_ip = get_real_client_ip(request)
        
        # 2. Check if internal network
        if not is_internal_network(client_ip):
            # Use 418 (I'm a teapot) as a distinct code for external access
            # This allows frontend to differentiate from other auth failures
            raise HTTPException(
                status_code=418,
                detail="EXTERNAL_NETWORK_BLOCKED"
            )

        # 3. Master Key Verification
        if provided_key != self.master_key:
            raise HTTPException(
                status_code=401,
                detail="Authority Verification Failed: Invalid Master Key."
            )
        
        return True


# Singleton instance
admin_service = AdminService()

