"""
FastAPI router for all FileNexus API endpoints.
"""

import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse, FileResponse
from backend.services.user_service import user_service
from backend.services.file_service import file_service
from backend.services.token_service import token_service
from backend.services.admin_service import admin_service
from backend.services.tus_service import tus_service
from backend.services.audit_service import AuditService
from backend.services.event_service import EventService
from backend.schemas import UserPublic, FileInfo, URLRecord, UserCreate, UserBase, UnlockRequest, ToggleLockRequest, BatchActionRequest
from backend.core.auth import generate_salt, hash_password, verify_password
from backend.core.rate_limit import login_limiter, admin_limiter
from backend.config import settings
from fastapi import WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api")

# Initialize new services
audit_service = AuditService(os.path.join(settings.paths.user_info_file.parent, "audit_logs.json"))
event_service = EventService()


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
    # 0. Rate Limit
    if not admin_limiter.is_allowed(request.client.host):
        raise HTTPException(status_code=429, detail="請求太過頻繁，請稍後再試。")
        
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
    
    await audit_service.log_event("admin", "USER_UPDATE", f"Admin updated user: {username}")
    if new_username:
        await event_service.notify_user_update(new_username) # Notify new username
    else:
        await event_service.notify_user_update(username)
    
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
    
    await audit_service.log_event("admin", "USER_PASSWORD_RESET_DEFAULT", f"Admin reset password to default for user: {username}")
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
    
    await audit_service.log_event("admin", "USER_DELETE", f"Admin deleted user: {username}")
    await event_service.notify_user_update(username) # Notify for deletion
    
    return {"message": f"使用者 {username} 及其數據已完全移除。"}


@router.post("/login", response_model=UserCreate)
async def login(request: Request, password: str = Form(...)):
    """Verify password and return the associated user."""
    # 0. Rate Limit
    if not login_limiter.is_allowed(request.client.host):
        raise HTTPException(status_code=429, detail="登入次數過多，請於一分鐘後再試。")

    user = await user_service.get_user_by_password(password)
    if not user:
        await audit_service.log_event("system", "LOGIN_FAILURE", "Authentication failed for unknown user", level="WARNING")
        raise HTTPException(status_code=401, detail="密碼錯誤")
    
    await audit_service.log_event(user.username, "LOGIN_SUCCESS", "User authenticated successfully")
    return user


@router.post("/user/change-password")
async def change_password(
    username: str = Form(...),
    old_password: str = Form(...),
    new_password: str = Form(...)
):
    """Allow a user to change their password."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # 1. Verify old password
    if not verify_password(old_password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="舊密碼錯誤")
    
    # 2. Update to new password and clear first_login
    success = await user_service.reset_password(username, new_password)
    if success:
        # Also ensure first_login is false
        await user_service.update_user(username, {"first_login": False})
        await audit_service.log_event(username, "CHANGE_PASSWORD_SUCCESS", "User changed password successfully", level="INFO")
        await event_service.notify_user_update(username)
        return {"message": "密碼更新成功", "status": "success"}
    
    await audit_service.log_event(username, "CHANGE_PASSWORD_FAILURE", "Failed to update password due to internal error", level="ERROR")
    raise HTTPException(status_code=500, detail="密碼更新失敗")


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

    await audit_service.log_event(user.username, "FILE_UPLOAD", f"Uploaded {len(uploaded)} files: {', '.join(uploaded)}")
    await event_service.notify_user_update(user.username)
    
    return {
        "message": "檔案上傳成功",
        "uploaded_files": uploaded,
        "redirect": f"/{user.username}",
        "first_login": user.first_login
    }


@router.post("/upload/tus")
async def tus_create(request: Request):
    """Tus Creation-Defer-Length extension endpoint."""
    length = int(request.headers.get("Upload-Length", 0))
    metadata_str = request.headers.get("Upload-Metadata", "")
    
    # Generate a unique ID (could be more robust)
    import uuid
    upload_id = str(uuid.uuid4())
    
    try:
        await tus_service.create_upload(upload_id, length, metadata_str)
        # We don't log success here to avoid file spam for large files, 
        # but we'll log it in finalize.
    except PermissionError as e:
        await audit_service.log_event("unknown", "TUS_CREATE_FAILURE", f"Auth failed: {str(e)}", level="WARNING")
        raise HTTPException(status_code=401, detail=str(e))
    except ValueError as e:
        await audit_service.log_event("unknown", "TUS_CREATE_FAILURE", f"Bad request: {str(e)}", level="WARNING")
        raise HTTPException(status_code=400, detail=str(e))
    
    # We expect password in metadata for initial auth
    # For now, we'll return the location
    host = request.headers.get("Host", "localhost:5168")
    scheme = request.headers.get("X-Forwarded-Proto", "http")
    location = f"{scheme}://{host}/api/upload/tus/{upload_id}"
    
    return JSONResponse(
        content={},
        status_code=201,
        headers={
            "Location": location,
            "Tus-Resumable": "1.0.0",
            "Access-Control-Expose-Headers": "Location, Tus-Resumable"
        }
    )


@router.head("/upload/tus/{upload_id}")
async def tus_head(upload_id: str):
    """Tus Core HEAD endpoint."""
    info = await tus_service.get_upload_info(upload_id)
    if not info:
        raise HTTPException(status_code=404)
    
    return JSONResponse(
        content={},
        headers={
            "Upload-Offset": str(info['offset']),
            "Upload-Length": str(info['length']),
            "Tus-Resumable": "1.0.0",
            "Access-Control-Expose-Headers": "Upload-Offset, Upload-Length, Tus-Resumable"
        }
    )


@router.patch("/upload/tus/{upload_id}")
async def tus_patch(upload_id: str, request: Request):
    """Tus Core PATCH endpoint."""
    offset = int(request.headers.get("Upload-Offset", 0))
    content_type = request.headers.get("Content-Type", "")
    
    if content_type != "application/offset+octet-stream":
        raise HTTPException(status_code=415)
    
    chunk = await request.body()
    
    try:
        new_offset = await tus_service.patch_upload(upload_id, offset, chunk)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    
    # Check if complete
    info = await tus_service.get_upload_info(upload_id)
    if info and info['offset'] == info['length']:
        # Authenticate and finalize
        # Password should be in metadata
        password = info['metadata'].get('password')
        if not password:
            raise HTTPException(status_code=401, detail="Missing password in metadata")
            
        user = await user_service.get_user_by_password(password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid password")
            
        filename = await tus_service.finalize_upload(upload_id, file_service._get_user_folder(user.folder))
        await audit_service.log_event(user.username, "FILE_UPLOAD_TUS", f"Uploaded file via TUS: {filename}")
        await event_service.notify_user_update(user.username)
        
    return JSONResponse(
        content={},
        headers={
            "Upload-Offset": str(new_offset),
            "Tus-Resumable": "1.0.0",
            "Access-Control-Expose-Headers": "Upload-Offset, Tus-Resumable"
        }
    )


@router.options("/upload/tus")
@router.options("/upload/tus/{upload_id}")
async def tus_options():
    """Tus Core OPTIONS endpoint."""
    return JSONResponse(
        content={},
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Max-Size": "10737418240", # 10GB
            "Tus-Extension": "creation,creation-with-upload",
            "Access-Control-Allow-Methods": "POST, GET, HEAD, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Tus-Version, Tus-Max-Size, Tus-Extension, Location, Upload-Offset, Upload-Length"
        }
    )


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
    
    await audit_service.log_event(user.username, "NOTE_CREATE", f"Created a secure note/link: {url}")
    await event_service.notify_user_update(user.username)
    
    return {
        "message": "連結建立成功", 
        "redirect": f"/{user.username}",
        "first_login": user.first_login
    }


@router.delete("/files/{username}/{filename}")
async def delete_file(
    username: str, 
    filename: str, 
    token: Optional[str] = None
):
    """Delete a file. Requires token if locked."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # Check locks
    is_locked = user.is_locked or filename in getattr(user, 'locked_files', [])
    if is_locked:
        if not token:
             raise HTTPException(status_code=403, detail="此資源已被鎖定，請先解鎖")
        
        info = token_service.validate_token(token)
        if not info or info.username != username:
            raise HTTPException(status_code=403, detail="無效或過期的存取權杖")

    success = await file_service.delete_file(user.folder, filename)
    if not success:
        raise HTTPException(status_code=404, detail="檔案不存在")
    
    await audit_service.log_event(username, "FILE_DELETE", f"Deleted file: {filename}")
    await event_service.notify_user_update(username)
    return {"message": "檔案已刪除"}


@router.post("/share/{username}/{filename}")
async def create_share(
    username: str, 
    filename: str,
    token: Optional[str] = Form(None)
):
    """Generate a temporary sharing token for a file."""
    # Check user existence
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")

    # Check locks
    is_locked = user.is_locked or filename in getattr(user, 'locked_files', [])
    if is_locked:
        if not token:
             raise HTTPException(status_code=403, detail="此資源已被鎖定，請先解鎖")
        
        info = token_service.validate_token(token)
        if not info or info.username != username:
            raise HTTPException(status_code=403, detail="無效或過期的存取權杖")

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
async def download_direct(
    username: str, 
    filename: str,
    token: Optional[str] = None
):
    """Direct download for authenticated users (protected in real apps)."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # Check locks
    is_locked = user.is_locked or filename in getattr(user, 'locked_files', [])
    if is_locked:
        if not token:
             raise HTTPException(status_code=403, detail="此資源已被鎖定，請先解鎖")
        
        info = token_service.validate_token(token)
        if not info or info.username != username:
            # Allow share tokens too if they match filename
            if not (info and info.token_type == 'share' and info.filename == filename and info.username == username):
                raise HTTPException(status_code=403, detail="無效或過期的存取權杖")

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
    
    # Generate access token
    token = token_service.create_access_token(username)
    
    return {
        "status": "success", 
        "authenticated": True,
        "token": token
    }


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
async def get_user_dashboard(
    username: str, 
    password: Optional[str] = None,
    token: Optional[str] = None
):
    """Fetch full dashboard data for a user (files, usage, urls)."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # Check authentication
    is_authenticated = False
    if password:
        is_authenticated = verify_password(password, user.salt, user.hashed_password)
    elif token:
        info = token_service.validate_token(token)
        if info and info.username == username:
            is_authenticated = True

    # Check lock status for privacy
    # If locked and not authenticated, hide details
    is_locked_account = user.is_locked
    
    # We load files anyway to calculate usage (which is usually public info? or hide it too?)
    # Let's verify usage is safe to show? Usually yes. But filenames definitely no.
    files = await file_service.get_user_files(user.folder)
    
    locked_files_list = getattr(user, 'locked_files', [])
    
    # Mark files as locked
    for f in files:
        if f.name in locked_files_list:
            f.is_locked = True
            
    # Calculate usage
    total_bytes = sum(f.size_bytes for f in files)
    usage_mb = round(total_bytes / (1024 * 1024), 2)
    
    response_files = files
    response_urls = user.urls

    # FILTERING LOGIC
    if not is_authenticated:
        # 1. If account is locked, hide everything
        if is_locked_account:
            response_files = []
            response_urls = []
        else:
            # 2. If account is open, hide only INDIVIDUALLY locked items
            # Files: hide if name is in locked_files_list
            response_files = [f for f in files if f.name not in locked_files_list]
            
            # URLs: hide if u.is_locked is true
            response_urls = [u for u in user.urls if not getattr(u, 'is_locked', False)]
    
    return {
        "user": {
            "username": user.username, 
            "is_locked": is_locked_account,
            "first_login": user.first_login
        },
        "usage": usage_mb,
        "files": response_files,
        "urls": response_urls,
        "is_authenticated": is_authenticated
    }
@router.get("/admin/audit-logs")
async def get_audit_logs(request: Request, master_key: str):
    """Admin endpoint to view system audit logs."""
    admin_service.verify_request(request, master_key)
    return await audit_service.get_logs()


@router.post("/user/{username}/batch-action")
async def batch_action(username: str, req: BatchActionRequest):
    """Perform batch operations on files or urls."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    if not verify_password(req.password, user.salt, user.hashed_password):
        await audit_service.log_event(username, "BATCH_AUTH_FAILURE", f"Failed batch auth for {req.action}", level="WARNING")
        raise HTTPException(status_code=401, detail="密碼錯誤")

    success_count = 0
    if req.item_type == 'file':
        locked_files = set(getattr(user, 'locked_files', []))
        for filename in req.item_ids:
            if req.action == 'lock':
                locked_files.add(filename)
                success_count += 1
            elif req.action == 'unlock':
                if filename in locked_files:
                    locked_files.remove(filename)
                    success_count += 1
            elif req.action == 'delete':
                if await file_service.delete_file(user.folder, filename):
                    if filename in locked_files:
                        locked_files.remove(filename)
                    success_count += 1
        await user_service.update_user(username, {"locked_files": list(locked_files)})
    
    elif req.item_type == 'url':
        urls = user.urls
        for item_id in req.item_ids:
            # For URLs, item_id is the URL string itself or something unique
            # In our current schema, the URL itself is the identifier
            for u in urls:
                if u.url == item_id:
                    if req.action == 'lock':
                        u.is_locked = True
                        success_count += 1
                    elif req.action == 'unlock':
                        u.is_locked = False
                        success_count += 1
                    elif req.action == 'delete':
                        urls.remove(u)
                        success_count += 1
                    break
        await user_service.update_user(username, {"urls": [u.dict() for u in urls]})

    await audit_service.log_event(username, f"BATCH_{req.action.upper()}", f"Successfully processed {success_count} {req.item_type}s")
    await event_service.notify_user_update(username)
    return {"message": f"成功處理 {success_count} 個項目。", "success_count": success_count}


@router.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    """WebSocket bridge for real-time state synchronization."""
    await event_service.connect(username, websocket)
    try:
        while True:
            # Keep connection alive, we don't expect messages from client for now
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_service.disconnect(username, websocket)
    except Exception:
        event_service.disconnect(username, websocket)
