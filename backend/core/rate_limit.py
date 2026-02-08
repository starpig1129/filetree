
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.config import settings

# Initialize Global Limiter
limiter = Limiter(
    key_func=get_remote_address, 
    enabled=settings.rate_limit.enabled,
    default_limits=[settings.rate_limit.default_limit]
)

# We can define constants for rates if we want
LOGIN_LIMIT = settings.rate_limit.login_limit
ADMIN_LIMIT = settings.rate_limit.admin_limit
UPLOAD_LIMIT = settings.rate_limit.upload_limit
TUS_LIMIT = settings.rate_limit.tus_limit

