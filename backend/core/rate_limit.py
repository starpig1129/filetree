
from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize Global Limiter
limiter = Limiter(key_func=get_remote_address)

# We can define constants for rates if we want
LOGIN_LIMIT = "5/minute"
ADMIN_LIMIT = "10/minute"
UPLOAD_LIMIT = "20/minute"
