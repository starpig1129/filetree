from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request, Form
from backend.services.user_service import user_service
from backend.services.admin_service import admin_service
from backend.services.audit_service import AuditService
from backend.services.event_service import event_service
from backend.schemas import UserPublic, InitResponse, SystemConfig
from backend.core.rate_limit import limiter, ADMIN_LIMIT
from backend.core.utils import get_client_ip
from backend.config import settings
from backend.core.auth import generate_salt, hash_password
import os

router = APIRouter()

audit_service = AuditService(os.path.join(settings.paths.user_info_file.parent, "audit_logs.json"))

@router.get("/init", response_model=InitResponse)
async def init_data(request: Request):
    """Initial data fetch for the SPA. Lists all public users and system config."""
    users = await user_service.list_public_users()
    config = SystemConfig(
        allowed_extensions=settings.logic.allowed_extensions
    )
    return InitResponse(users=users, config=config)

@router.post("/admin/create-user")
@limiter.limit(ADMIN_LIMIT)
async def admin_create_user(
    request: Request,
    master_key: str = Form(...),
    username: str = Form(...),
    password: Optional[str] = Form(None),
    folder: Optional[str] = Form(None)
):
    """Admin endpoint to create a user."""
    # 1. Verify authority
    admin_service.verify_request(request, master_key)
    
    # 2. Check if exists
    existing = await user_service.get_user_by_name(username)
    if existing:
        raise HTTPException(status_code=400, detail="此使用者已存在。")
    
    # 3. Create user logic
    password = username # Default password is the username
    salt = generate_salt()
    
    async with user_service.lock:
        users = await user_service._read_users()
        
        new_user = {
            'username': username,
            'folder': folder or username,
            'salt': salt,
            'hashed_password': hash_password(password, salt),
            'first_login': True,
            'is_locked': False,
            'urls': []
        }
        
        users.append(new_user)
        await user_service._write_users(users)
    
    # Ensure folder existence
    path = settings.paths.upload_folder / new_user['folder']
    path.mkdir(parents=True, exist_ok=True)
    
    await audit_service.log_event("admin", "USER_CREATE", f"Created user {username}", ip=get_client_ip(request))
    await event_service.notify_global_update("USER_LIST_UPDATE")
    return {"message": f"使用者 {username} 建立成功", "status": "success"}


@router.get("/admin/verify")
async def verify_admin(request: Request, master_key: str):
    """Verify if the provided key is valid for the current session."""
    admin_service.verify_request(request, master_key)
    return {"status": "authorized"}


@router.post("/admin/reset-password")
async def admin_reset_password(
    request: Request,
    master_key: str = Form(...),
    username: str = Form(...),
    new_password: str = Form(...)
):
    """Admin endpoint to reset a user's password."""
    admin_service.verify_request(request, master_key)
    
    success = await user_service.reset_password(username, new_password)
    if not success:
        raise HTTPException(status_code=404, detail="找不到該使用者。")
    
    await audit_service.log_event("admin", "USER_PASSWORD_RESET", f"Admin set new password for user: {username}", ip=get_client_ip(request))
    return {"message": f"使用者 {username} 的密碼已更新", "status": "success"}


@router.get("/admin/users", response_model=List[UserPublic])
async def admin_list_users(request: Request, master_key: str):
    """Admin endpoint to list all users (including hidden ones)."""
    admin_service.verify_request(request, master_key)
    return await user_service.list_all_users_for_admin()


@router.post("/admin/update-user")
async def admin_update_user(
    request: Request,
    master_key: str = Form(...),
    username: str = Form(...),
    new_username: Optional[str] = Form(None),
    is_locked: Optional[bool] = Form(None),
    data_retention_days: Optional[int] = Form(None),
    show_in_list: Optional[bool] = Form(None)
):
    """Admin endpoint to update user profile (rename, lock)."""
    admin_service.verify_request(request, master_key)
    
    try:
        success = await user_service.update_user_profile(
            username, 
            new_username=new_username, 
            is_locked=is_locked
        )
        
        update_data = {}
        if data_retention_days is not None:
             if data_retention_days < -1:
                 raise HTTPException(status_code=400, detail="保留天數不能為負數（-1 除外）。")
             update_data['data_retention_days'] = None if data_retention_days == -1 else data_retention_days
        if show_in_list is not None:
            update_data['show_in_list'] = show_in_list
            
        if update_data:
            await user_service.update_user(new_username or username, update_data)

        if not success:
            raise HTTPException(status_code=404, detail="找不到該使用者。")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await audit_service.log_event("admin", "USER_UPDATE", f"Admin updated user: {username}", ip=get_client_ip(request))
    if new_username:
        await event_service.notify_user_update(new_username)
        await event_service.notify_global_update("USER_LIST_UPDATE")
    else:
        await event_service.notify_user_update(username)
        if show_in_list is not None:
             await event_service.notify_global_update("USER_LIST_UPDATE")
    
    return {"message": "使用者資料更新成功", "status": "success"}


@router.post("/admin/reset-default-password")
async def admin_reset_default_password(
    request: Request,
    master_key: str = Form(...),
    username: str = Form(...)
):
    """Admin endpoint to reset a user's password to match their username."""
    admin_service.verify_request(request, master_key)
    
    success = await user_service.reset_password(username, username)
    if not success:
        raise HTTPException(status_code=404, detail="找不到該使用者。")
    
    await audit_service.log_event("admin", "USER_PASSWORD_RESET_DEFAULT", f"Admin reset password to default for user: {username}", ip=get_client_ip(request))
    await event_service.notify_user_update(username)
    
    return {"message": f"使用者 {username} 的密碼已重設為預設值。"}


@router.post("/admin/delete-user")
async def admin_delete_user(
    request: Request,
    master_key: str = Form(...),
    username: str = Form(...)
):
    """Admin endpoint to delete a user and their data."""
    admin_service.verify_request(request, master_key)
    
    success = await user_service.delete_user(username)
    if not success:
        raise HTTPException(status_code=404, detail="找不到該使用者。")
    
    await audit_service.log_event("admin", "USER_DELETE", f"Admin deleted user: {username}", ip=get_client_ip(request))
    await event_service.notify_user_update(username)
    await event_service.notify_global_update("USER_LIST_UPDATE")
    
    return {"message": f"使用者 {username} 及其數據已完全移除。"}
