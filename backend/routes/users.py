from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request, Form, Depends
from backend.services.user_service import user_service
from backend.services.token_service import token_service
from backend.services.audit_service import AuditService
from backend.services.event_service import event_service
from backend.schemas import FileInfo, ToggleLockRequest
from backend.core.auth import verify_password
from backend.core.utils import get_client_ip
from backend.config import settings
import os

router = APIRouter()
audit_service = AuditService(os.path.join(settings.paths.user_info_file.parent, "audit_logs.json"))

@router.get("/user/{username}")
async def get_user_dashboard(request: Request, username: str, token: Optional[str] = None):
    """Get dashboard data for a user."""
    user = await user_service.get_user_by_name(username)
    if not user:
         raise HTTPException(status_code=404, detail="使用者不存在")
    
    # Check authentication state via token
    is_authenticated = False
    if token:
        info = token_service.validate_token(token)
        if info and info.username == username:
            is_authenticated = True
    
    # Filter content based on auth
    files = []
    # If authenticated, use system retention logic for 'expired' calculation but show everything
    # If not, same logic.
    # The file_service.get_user_files handles expiration calculation.
    from backend.services.file_service import file_service
    all_files = await file_service.get_user_files(
        user.username, 
        user.data_retention_days,
        folders=[f.dict() for f in getattr(user, 'folders', [])]
    )
    
    # Filter locked files
    visible_files = []
    locked_files = getattr(user, 'locked_files', [])
    
    for f in all_files:
        f.is_locked = f.name in locked_files
        # Admin/User sees everything, guest sees only unlocked? 
        # Requirement: "Guests see locked files but cannot open them" -> implies they should be listed.
        # So we include them, but marked as locked.
        visible_files.append(f)
        
    # URLs
    urls = user.urls or []
    visible_urls = []
    for u in urls:
        # u is a URLRecord (Pydantic model)
        u_dict = u.dict()
        u_dict['is_locked'] = u_dict.get('is_locked', False)
        visible_urls.append(u_dict)
        
    return {
        "user": {
            "username": user.username,
            "show_in_list": user.show_in_list,
            "first_login": user.first_login,
            "is_locked": user.is_locked
        },
        "usage": 0, # TODO: Calculate total usage
        "files": visible_files,
        "urls": visible_urls,
        "folders": getattr(user, 'folders', [])
    }


@router.post("/user/change-password")
async def change_password(
    request: Request,
    username: str = Form(...),
    old_password: str = Form(...),
    new_password: str = Form(...)
):
    """Allow a user to change their password."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    if not verify_password(old_password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="舊密碼錯誤")
    
    success = await user_service.reset_password(username, new_password)
    if success:
        await user_service.update_user(username, {"first_login": False})
        await audit_service.log_event(username, "CHANGE_PASSWORD_SUCCESS", "User changed password successfully", level="INFO", ip=get_client_ip(request))
        await event_service.notify_user_update(username)
        return {"message": "密碼更新成功", "status": "success"}
    
    raise HTTPException(status_code=500, detail="密碼更新失敗")


@router.post("/user/update-profile")
async def update_own_profile(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    show_in_list: bool = Form(...)
):
    """User endpoint to update their own profile settings."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    if not verify_password(password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="密碼錯誤")
    
    await user_service.update_user(username, {"show_in_list": show_in_list})
    
    await audit_service.log_event(username, "PROFILE_UPDATE", f"User updated profile visibility to {show_in_list}", ip=get_client_ip(request))
    await event_service.notify_user_update(username)
    await event_service.notify_global_update("USER_LIST_UPDATE")
    return {"message": "設定更新成功", "status": "success"}


@router.post("/user/{username}/toggle-lock")
async def toggle_item_lock(username: str, data: ToggleLockRequest):
    """Toggle lock status for a file or URL."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    if not verify_password(data.password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="密碼驗證失敗")
    
    async with user_service.lock:
        users = await user_service._read_users()
        for u in users:
            if u['username'] == username:
                if data.item_type == 'file':
                    locked_files = u.get('locked_files', [])
                    if data.is_locked:
                        if data.item_id not in locked_files:
                            locked_files.append(data.item_id)
                    else:
                        locked_files = [f for f in locked_files if f != data.item_id]
                    u['locked_files'] = locked_files
                elif data.item_type == 'url':
                    for url_rec in u.get('urls', []):
                        if url_rec['url'] == data.item_id:
                            url_rec['is_locked'] = data.is_locked
                            break
                
                await user_service._write_users(users)
                await event_service.notify_user_update(username)
                return {"status": "success", "message": "鎖定狀態已更新"}
            
    raise HTTPException(status_code=500, detail="寫入數據失敗")
