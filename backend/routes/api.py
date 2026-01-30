"""
FastAPI router for all FileNexus API endpoints.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse, FileResponse
from backend.services.user_service import user_service
from backend.services.file_service import file_service
from backend.services.token_service import token_service
from backend.services.admin_service import admin_service
from backend.schemas import UserPublic, FileInfo, URLRecord, UserCreate, UserBase, UnlockRequest, ToggleLockRequest
from backend.core.auth import generate_salt, hash_password, verify_password
from backend.config import settings

router = APIRouter(prefix="/api")


@router.get("/init", response_model=List[UserPublic])
async def init_data(request: Request):
    """Initial data fetch for the SPA. Lists all public users."""
    # Add a simple check: if not localhost, maybe don't return everything?
    # For now, we'll keep it as is but we've acknowledged the risk.
    return await user_service.list_public_users()


@router.post("/admin/create-user")
async def admin_create_user(
    request: Request,
    master_key: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    folder: Optional[str] = Form(None)
):
    """Admin endpoint to create a user."""
    # 1. Verify authority
    admin_service.verify_request(request, master_key)
    
    # 2. Check if exists
    existing = await user_service.get_user_by_name(username)
    if existing:
        raise HTTPException(status_code=400, detail="此使用者已存在。")
    
    # 3. Create user logic (copied from cli.py logic)
    salt = generate_salt()
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
    # 1. Verify authority
    admin_service.verify_request(request, master_key)
    
    # 2. Reset logic
    success = await user_service.reset_password(username, new_password)
    if not success:
        raise HTTPException(status_code=404, detail="找不到該使用者。")
    
    return {"message": f"使用者 {username} 的密碼已更新", "status": "success"}


@router.get("/admin/users", response_model=List[UserPublic])
async def admin_list_users(request: Request, master_key: str):
    """Admin endpoint to list all users with full public details."""
    admin_service.verify_request(request, master_key)
    return await user_service.list_public_users()


@router.post("/admin/update-user")
async def admin_update_user(
    request: Request,
    master_key: str = Form(...),
    username: str = Form(...),
    new_username: Optional[str] = Form(None),
    is_locked: Optional[bool] = Form(None)
):
    """Admin endpoint to update user profile (rename, lock)."""
    admin_service.verify_request(request, master_key)
    
    try:
        success = await user_service.update_user_profile(
            username, 
            new_username=new_username, 
            is_locked=is_locked
        )
        if not success:
            raise HTTPException(status_code=404, detail="找不到該使用者。")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return {"message": "使用者資料更新成功", "status": "success"}


@router.post("/login", response_model=UserCreate)
async def login(password: str = Form(...)):
    """Verify password and return the associated user."""
    user = await user_service.get_user_by_password(password)
    if not user:
        raise HTTPException(status_code=401, detail="密碼錯誤")
    return user


@router.get("/files/{username}", response_model=List[FileInfo])
async def get_files(username: str):
    """List files for a specific user."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    return await file_service.get_user_files(user.folder)


@router.post("/upload")
async def upload_files(
    password: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Handle multiple file uploads."""
    user = await user_service.get_user_by_password(password)
    if not user:
        raise HTTPException(status_code=401, detail="密碼錯誤")

    uploaded = []
    for file in files:
        content = await file.read()
        unique_name = await file_service.save_file(user.folder, file.filename, content)
        uploaded.append(unique_name)

    return {
        "message": "檔案上傳成功",
        "uploaded_files": uploaded,
        "redirect": f"/{user.username}"
    }


@router.post("/upload_url")
async def upload_url(
    password: str = Form(...),
    url: str = Form(...)
):
    """Handle URL submission."""
    user = await user_service.get_user_by_password(password)
    if not user:
        raise HTTPException(status_code=401, detail="密碼錯誤")

    current_urls = user.urls
    current_urls.insert(0, URLRecord(url=url, created=datetime.now()))
    
    # Store as dicts back to JSON
    await user_service.update_user(user.username, {"urls": [u.dict() for u in current_urls[:30]]})
    
    return {"message": "連結建立成功", "redirect": f"/{user.username}"}


@router.delete("/files/{username}/{filename}")
async def delete_file(username: str, filename: str):
    """Delete a file."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    success = await file_service.delete_file(user.folder, filename)
    if not success:
        raise HTTPException(status_code=404, detail="檔案不存在")
    
    return {"message": "檔案已刪除"}


@router.post("/share/{username}/{filename}")
async def create_share(username: str, filename: str):
    """Generate a temporary sharing token for a file."""
    token = token_service.create_token(username, filename)
    return {
        "success": True,
        "token": token,
        "expiry_hours": token_service.expiry_hours
    }


@router.get("/download-shared/{token}")
async def download_shared(token: str):
    """Download a file via a share token."""
    info = token_service.validate_token(token)
    if not info:
        raise HTTPException(status_code=404, detail="分享連結已過期或無效")
    
    user = await user_service.get_user_by_name(info.username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # Send the file
    folder = file_service._get_user_folder(user.folder)
    return FileResponse(path=folder / info.filename, filename=info.filename)


@router.get("/download/{username}/{filename}")
async def download_direct(username: str, filename: str):
    """Direct download for authenticated users (protected in real apps)."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    folder = file_service._get_user_folder(user.folder)
    return FileResponse(path=folder / filename, filename=filename)


@router.post("/user/{username}/unlock")
async def unlock_user(username: str, data: UnlockRequest):
    """Verify password for unlocking the dashboard."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    if not verify_password(data.password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="密碼驗證失敗")
    
    return {"status": "success", "authenticated": True}


@router.post("/user/{username}/toggle-lock")
async def toggle_item_lock(username: str, data: ToggleLockRequest):
    """Toggle lock status for a file or URL."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    if not verify_password(data.password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="密碼驗證失敗")
    
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
            return {"status": "success", "message": "鎖定狀態已更新"}
            
    raise HTTPException(status_code=500, detail="寫入數據失敗")


@router.get("/user/{username}")
async def get_user_dashboard(username: str, password: Optional[str] = None):
    """Fetch full dashboard data for a user (files, usage, urls)."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # Verify auth if password provided
    is_authenticated = False
    if password:
        is_authenticated = verify_password(password, user.salt, user.hashed_password)

    files = await file_service.get_user_files(user.folder)
    locked_files = getattr(user, 'locked_files', [])
    
    # Mark files as locked
    for f in files:
        if f.name in locked_files:
            f.is_locked = True
            
    # Calculate usage
    total_bytes = sum(f.size_bytes for f in files)
    usage_mb = round(total_bytes / (1024 * 1024), 2)
    
    return {
        "user": {"username": user.username},
        "usage": usage_mb,
        "files": files,
        "urls": user.urls,
        "is_authenticated": is_authenticated
    }
