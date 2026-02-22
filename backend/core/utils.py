from fastapi import Request

def get_client_ip(request: Request) -> str:
    """Detection of client IP, supporting proxies like cloudflared/nginx."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
