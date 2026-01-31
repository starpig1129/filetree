import time
from fastapi import Request, HTTPException
from typing import Dict, Tuple

class RateLimiter:
    """Simple in-memory rate limiter."""
    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.cache: Dict[str, Tuple[int, float]] = {}

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        if client_ip not in self.cache:
            self.cache[client_ip] = (1, now)
            return True

        count, first_req_time = self.cache[client_ip]
        if now - first_req_time > self.window_seconds:
            self.cache[client_ip] = (1, now)
            return True

        if count < self.requests_limit:
            self.cache[client_ip] = (count + 1, first_req_time)
            return True

        return False

# Global instances for different levels of strictness
login_limiter = RateLimiter(requests_limit=5, window_seconds=60) # 5 requests per minute
admin_limiter = RateLimiter(requests_limit=10, window_seconds=60)
