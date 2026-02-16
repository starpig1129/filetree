from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Form, Request
from backend.services.user_service import user_service
from backend.services.token_service import token_service
from backend.services.audit_service import AuditService
from backend.schemas import UnlockRequest
from backend.core.auth import verify_password
from backend.core.rate_limit import limiter, LOGIN_LIMIT
from backend.core.utils import get_client_ip
from backend.config import settings
import os

router = APIRouter()

# Initialize localized audit service
audit_service = AuditService(os.path.join(settings.paths.user_info_file.parent, "audit_logs.json"))


@router.post("/login")
@limiter.limit(LOGIN_LIMIT)
async def login(request: Request, password: str = Form(...)):
    """Verify password and return the associated user."""
    user = await user_service.get_user_by_password(password)
    if not user:
        await audit_service.log_event(
            "system", "LOGIN_FAILURE",
            "Authentication failed for unknown user",
            level="WARNING", ip=get_client_ip(request),
        )
        raise HTTPException(status_code=401, detail="密碼錯誤")

    await audit_service.log_event(
        user["username"], "LOGIN_SUCCESS",
        "User authenticated successfully",
        ip=get_client_ip(request),
    )

    # Return safe user data (no hashed_password/salt to frontend)
    return {
        "username": user["username"],
        "folder": user["folder"],
        "is_locked": user["is_locked"],
        "first_login": user["first_login"],
        "data_retention_days": user.get("data_retention_days"),
        "show_in_list": user["show_in_list"],
        "salt": user["salt"],
        "hashed_password": user["hashed_password"],
        "folders": user.get("folders", []),
    }


@router.post("/user/{username}/unlock")
async def unlock_user(username: str, data: UnlockRequest):
    """Verify password for unlocking the dashboard."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")

    if not verify_password(data.password, user["salt"], user["hashed_password"]):
        raise HTTPException(status_code=401, detail="密碼驗證失敗")

    # Generate access token
    token = token_service.create_access_token(username)

    return {
        "status": "success",
        "authenticated": True,
        "token": token,
    }
