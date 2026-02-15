from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request, Form, UploadFile, File, Depends
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
from backend.services.user_service import user_service
from backend.services.file_service import file_service
from backend.services.token_service import token_service
from backend.services.audit_service import AuditService
from backend.services.event_service import event_service
from backend.services.thumbnail_service import thumbnail_service
from backend.schemas import FileInfo, URLRecord, BatchActionRequest
from backend.core.auth import verify_password
from backend.core.rate_limit import limiter, UPLOAD_LIMIT, TUS_LIMIT
from backend.core.utils import get_client_ip
from backend.config import settings
from datetime import datetime
import os

router = APIRouter()
audit_service = AuditService(os.path.join(settings.paths.user_info_file.parent, "audit_logs.json"))


@router.get("/files/{username}", response_model=List[FileInfo])
async def get_files(username: str):
    """List files for a specific user."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    return await file_service.get_user_files(
        user.folder, 
        retention_days=user.data_retention_days,
        folders=[f.dict() for f in getattr(user, 'folders', [])]
    )


@router.post("/upload")
@limiter.limit(UPLOAD_LIMIT)
async def upload_files(
    request: Request,
    password: str = Form(...),
    files: List[UploadFile] = File(...),
    folder_id: Optional[str] = Form(None)
):
    """Handle multiple file uploads into a specific folder."""
    user = await user_service.get_user_by_password(password)
    if not user:
        raise HTTPException(status_code=401, detail="密碼錯誤")

    # Resolve physical path
    path = await user_service.get_folder_path_names(user.username, folder_id)

    uploaded = []
    file_metadata = getattr(user, 'file_metadata', {})
    
    for file in files:
        if not file.filename: continue
        content = await file.read()
        unique_name = await file_service.save_file(user.username, file.filename, content, path)
        uploaded.append(unique_name)
        
        # Track folder mapping in metadata
        file_metadata[unique_name] = {"folder_id": folder_id}

    await user_service.update_user(user.username, {"file_metadata": file_metadata})

    await audit_service.log_event(user.username, "FILE_UPLOAD", f"Uploaded {len(uploaded)} files: {', '.join(uploaded)}", ip=get_client_ip(request))
    await event_service.notify_user_update(user.username)
    
    return {
        "message": "檔案上傳成功",
        "uploaded_files": uploaded,
        "redirect": f"/{user.username}",
        "first_login": user.first_login
    }


@router.post("/upload_url")
async def upload_url(
    request: Request,
    password: str = Form(...),
    url: str = Form(...)
):
    """Handle URL submission."""
    user = await user_service.get_user_by_password(password)
    if not user:
        raise HTTPException(status_code=401, detail="密碼錯誤")

    new_record = URLRecord(url=url, created=datetime.now())
    
    # Use atomic add to prevent race conditions
    await user_service.add_user_url(user.username, new_record.dict())
    
    await audit_service.log_event(user.username, "NOTE_CREATE", f"Created a secure note/link: {url}", ip=get_client_ip(request))
    await event_service.notify_user_update(user.username)
    
    return {
        "message": "連結建立成功", 
        "redirect": f"/{user.username}",
        "first_login": user.first_login
    }


@router.post("/user/{username}/delete")
async def delete_file(
    request: Request, 
    username: str, 
    filename: str = Form(...), 
    token: Optional[str] = Form(None)
):
    """Delete a file from user's folder."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # Check locks
    if filename in getattr(user, 'locked_files', []):
        if not token:
             raise HTTPException(status_code=403, detail="此資源已被鎖定，請先解鎖")
        
        info = token_service.validate_token(token)
        if not info or info.username != username:
            raise HTTPException(status_code=403, detail="無效或過期的存取權杖")

    # Resolve physical path
    file_metadata = getattr(user, 'file_metadata', {})
    folder_id = file_metadata.get(filename, {}).get('folder_id')
    path = await user_service.get_folder_path_names(username, folder_id)

    success = await file_service.delete_file(username, filename, path)
    if not success:
        raise HTTPException(status_code=404, detail="檔案不存在")
    
    await audit_service.log_event(username, "FILE_DELETE", f"Deleted file: {filename}", ip=get_client_ip(request))
    await event_service.notify_user_update(username)
    return {"message": "檔案已刪除"}


@router.post("/user/{username}/rename-file")
async def rename_file(
    request: Request, 
    username: str,
    password: str = Form(...),
    old_name: str = Form(...),
    new_name: str = Form(...)
):
    """Rename a file."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")

    if not verify_password(password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="密碼錯誤")

    if old_name in getattr(user, 'locked_files', []):
         raise HTTPException(status_code=403, detail="此資源已被鎖定，請先解鎖")

    # Resolve path
    file_metadata = getattr(user, 'file_metadata', {})
    folder_id = file_metadata.get(old_name, {}).get('folder_id')
    path = await user_service.get_folder_path_names(username, folder_id)

    success = await file_service.rename_file(username, old_name, new_name, path)
    if not success:
        raise HTTPException(status_code=400, detail="重新命名失敗（檔案不存在或名稱重複）")
    
    # Update metadata if filename changed (metadata key is filename)
    if old_name in file_metadata:
        file_metadata[new_name] = file_metadata.pop(old_name)
        await user_service.update_user(username, {"file_metadata": file_metadata})

    await audit_service.log_event(username, "FILE_RENAME", f"Renamed {old_name} to {new_name}", ip=get_client_ip(request))
    await event_service.notify_user_update(username)
    return {"message": "檔案重新命名成功"}


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
    
    # Resolve physical path
    file_metadata = getattr(user, 'file_metadata', {})
    folder_id = file_metadata.get(info.filename, {}).get('folder_id')
    path_names = await user_service.get_folder_path_names(info.username, folder_id)
    folder = file_service._get_folder_path(info.username, path_names)
    
    return FileResponse(path=folder / info.filename, filename=info.filename)


@router.get("/download/{username}/{filename}")
async def download_direct(
    username: str, 
    filename: str,
    token: Optional[str] = None,
    inline: Optional[bool] = None
):
    """Direct download for authenticated users."""
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

    # Resolve physical path
    file_metadata = getattr(user, 'file_metadata', {})
    folder_id = file_metadata.get(filename, {}).get('folder_id')
    path_names = await user_service.get_folder_path_names(username, folder_id)
    folder = file_service._get_folder_path(username, path_names)
    file_path = folder / filename
    
    # Check if exists locally
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="檔案不存在")

    if inline:
        return FileResponse(path=file_path)
    return FileResponse(path=file_path, filename=filename)


@router.get("/thumbnail/{username}/{filename}")
@limiter.limit(TUS_LIMIT)
async def get_thumbnail(
    request: Request,
    username: str, 
    filename: str,
    token: Optional[str] = None
):
    """Get a thumbnail for a file."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check locks
    is_locked = user.is_locked or filename in getattr(user, 'locked_files', [])
    if is_locked:
        if not token:
             raise HTTPException(status_code=403, detail="Locked resource")
        
        info = token_service.validate_token(token)
        if not info or info.username != username:
            if not (info and info.token_type == 'share' and info.filename == filename and info.username == username):
                raise HTTPException(status_code=403, detail="Invalid token")

    file_metadata = getattr(user, 'file_metadata', {})
    folder_id = file_metadata.get(filename, {}).get('folder_id')
    path_names = await user_service.get_folder_path_names(username, folder_id)
    folder = file_service._get_folder_path(username, path_names)
    file_path = folder / filename
    
    thumb_path = await thumbnail_service.get_thumbnail(file_path)
    
    if thumb_path:
        return FileResponse(path=thumb_path)
    
    raise HTTPException(status_code=404, detail="Thumbnail not available")


@router.post("/user/{username}/folders")
async def create_folder(
    username: str, 
    name: str = Form(...), 
    folder_type: str = Form(...), 
    password: str = Form(...),
    parent_id: Optional[str] = Form(None)
):
    """Create a new folder for files or URLs."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    if not verify_password(password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="密碼錯誤")
    
    # Validation: parent must exist if provided
    if parent_id:
        parent = next((f for f in getattr(user, 'folders', []) if f.id == parent_id), None)
        if not parent:
            raise HTTPException(status_code=400, detail="父資料夾不存在")

    folder_id = await user_service.add_folder(username, name, folder_type, parent_id)
    if not folder_id:
        raise HTTPException(status_code=500, detail="建立資料夾失敗")
    
    await event_service.notify_user_update(username)
    return {"status": "success", "folder_id": folder_id}


@router.post("/user/{username}/folders/{folder_id}/update")
async def update_folder(username: str, folder_id: str, name: str = Form(...), password: str = Form(...)):
    """Update a folder name."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    if not verify_password(password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="密碼錯誤")
    
    # If it's a file folder, we should rename it physically too
    folders = getattr(user, 'folders', [])
    target_folder = next((f for f in folders if f.id == folder_id), None)
    if not target_folder:
        raise HTTPException(status_code=404, detail="找不到資料夾")
    
    if target_folder.type == 'file':
        parent_path = await user_service.get_folder_path_names(username, target_folder.parent_id)
        await file_service.rename_physical_folder(username, parent_path, target_folder.name, name)

    success = await user_service.update_folder(username, folder_id, name)
    if not success:
        raise HTTPException(status_code=500, detail="更新資料夾失敗")
    
    await event_service.notify_user_update(username)
    return {"status": "success"}


@router.post("/user/{username}/folders/{folder_id}/delete")
async def delete_folder(username: str, folder_id: str, password: str = Form(...)):
    """Delete a folder and its physical content."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    if not verify_password(password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="密碼錯誤")
    
    folders = getattr(user, 'folders', [])
    target_folder = next((f for f in folders if f.id == folder_id), None)
    if not target_folder:
        raise HTTPException(status_code=404, detail="找不到資料夾")

    if target_folder.type == 'file':
        path = await user_service.get_folder_path_names(username, folder_id)
        await file_service.delete_physical_folder(username, path)

    success = await user_service.delete_folder(username, folder_id)
    if not success:
        raise HTTPException(status_code=500, detail="刪除資料夾失敗")
    
    await event_service.notify_user_update(username)
    return {"status": "success"}


@router.post("/user/{username}/move-item")
async def move_item(
    username: str, 
    item_type: str = Form(...), 
    item_id: str = Form(...), 
    folder_id: Optional[str] = Form(None), 
    password: str = Form(...)
):
    """Move an item (file, url, or folder) to a folder."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    if not verify_password(password, user.salt, user.hashed_password):
        raise HTTPException(status_code=401, detail="密碼錯誤")
    
    # Handle physical move for files
    if item_type == 'file':
        # Get old path
        file_metadata = getattr(user, 'file_metadata', {})
        old_folder_id = file_metadata.get(item_id, {}).get('folder_id')
        from_path = await user_service.get_folder_path_names(username, old_folder_id)
        to_path = await user_service.get_folder_path_names(username, folder_id)
        await file_service.move_file(username, item_id, from_path, to_path)
    
    elif item_type == 'folder':
        # Moving a folder inside another folder
        folders = getattr(user, 'folders', [])
        target_folder = next((f for f in folders if f.id == item_id), None)
        if not target_folder:
            raise HTTPException(status_code=404, detail="找不到項目資料夾")
            
        if target_folder.type == 'file':
            old_parent_path = await user_service.get_folder_path_names(username, target_folder.parent_id)
            new_parent_path = await user_service.get_folder_path_names(username, folder_id)
            
            # Use file_service to move directory
            old_dir = file_service._get_folder_path(username, old_parent_path) / target_folder.name
            new_dir = file_service._get_folder_path(username, new_parent_path) / target_folder.name
            
            if old_dir.exists() and old_dir.is_dir():
                import shutil
                # Using a blocking call here for simplicity in async context, 
                # ideally should be in run_in_threadpool if large
                try:
                    shutil.move(str(old_dir), str(new_dir))
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"物理資料夾移動失敗: {e}")

    success = await user_service.move_item(username, item_type, item_id, folder_id)
    if not success:
        raise HTTPException(status_code=400, detail="移動項目失敗或造成循環引用")
    
    await event_service.notify_user_update(username)
    return {"status": "success"}


@router.post("/user/{username}/batch-action")
async def batch_action(
    request: Request,
    username: str, 
    data: BatchActionRequest
):
    """Perform action on multiple items."""
    user = await user_service.get_user_by_name(username)
    if not user:
         raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(data.password, user.salt, user.hashed_password):
         raise HTTPException(status_code=401, detail="密碼驗證失敗")

    success_count = 0
    errors = []

    for item_id in data.item_ids:
        try:
            if data.action == 'delete':
                if data.item_type == 'file':
                    # Physical deletion logic
                    if item_id in getattr(user, 'locked_files', []):
                        continue # Skip locked in batch without specific override?
                    
                    file_metadata = getattr(user, 'file_metadata', {})
                    folder_id = file_metadata.get(item_id, {}).get('folder_id')
                    path = await user_service.get_folder_path_names(username, folder_id)
                    
                    if await file_service.delete_file(username, item_id, path):
                         success_count += 1
                elif data.item_type == 'url':
                    # user.urls is a list of URLRecord Pydantic models
                    if item_id in [u.url for u in user.urls if u.is_locked]:
                        continue

                    user.urls = [u for u in user.urls if u.url != item_id]
                    success_count += 1
            
            elif data.action == 'lock':
                if data.item_type == 'file':
                    if item_id not in getattr(user, 'locked_files', []):
                        user.locked_files.append(item_id)
                        success_count += 1
                elif data.item_type == 'url':
                    for u in user.urls:
                        if u.url == item_id:
                            u.is_locked = True
                            success_count += 1
            
            elif data.action == 'unlock':
                if data.item_type == 'file':
                    if item_id in getattr(user, 'locked_files', []):
                         user.locked_files = [f for f in user.locked_files if f != item_id]
                         success_count += 1
                elif data.item_type == 'url':
                    for u in user.urls:
                        if u.url == item_id:
                            u.is_locked = False
                            success_count += 1

        except Exception as e:
            errors.append(f"{item_id}: {str(e)}")

    # Persist changes
    # Note: user object here is a UserCreate Pydantic model turned dict? 
    # Actually get_user_by_name returns UserCreate model.
    # We need to save it back.
    # But UserCreate is immutable Pydantic v2? Or v1?
    # user_service.update_user expects a dict of changes.
    
    # This part is tricky with the current service design for batch updates.
    # We should probably implement batch methods in service.
    # For now, we will construct the update payload.
    
    update_payload = {}
    if data.action in ['lock', 'unlock']:
         if data.item_type == 'file':
             update_payload['locked_files'] = user.locked_files
         else:
             update_payload['urls'] = [u.dict() for u in user.urls] # Convert back to dicts
    elif data.action == 'delete' and data.item_type == 'url':
         update_payload['urls'] = [u.dict() for u in user.urls]

    if update_payload:
        await user_service.update_user(username, update_payload)
    
    await event_service.notify_user_update(username)
    return {"message": f"成功處理 {success_count} 個項目", "errors": errors}


@router.post("/user/{username}/batch-download")
async def batch_download(
    username: str, 
    filenames: List[str] = Form(...),
    password: Optional[str] = Form(None)
):
    """Download multiple files as a zip archive."""
    user = await user_service.get_user_by_name(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify password if any file is locked? 
    # Requirement: "Batch download doesn't strictly require pre-authentication for public files"
    # But if any selected file is locked, we need auth.
    locked_files = getattr(user, 'locked_files', [])
    has_locked = any(f in locked_files for f in filenames)
    
    if has_locked:
        if not password or not verify_password(password, user.salt, user.hashed_password):
             raise HTTPException(status_code=403, detail="部分檔案已鎖定，需要密碼")

    # Group by folders to handle paths correctly?
    # Simple zip: flat structure or preserved structure?
    # file_service.create_batch_zip handles flat list from names.
    # If duplicates in name but different folders? create_batch_zip likely fails or overwrites.
    # Assuming unique names for now based on current file_service logic.
    
    # We need to find the paths for each file
    # file_service.create_batch_zip now needs an update to handle list of (filename, path) tuples?
    # Or we loop here and copy to temp?
    
    # Let's assume file_service can handle it or we update it.
    # Current `create_batch_zip` takes `filenames` and `folder_path_names`. 
    # This implies all files must be in the SAME folder.
    # If selection spans multiple folders, we need a better zip service.
    
    # For now, let's limit batch download to flat or implement a robust zipper here.
    import tempfile
    import zipfile
    
    temp_zip = tempfile.NamedTemporaryFile(suffix='.zip', delete=False)
    temp_zip_path = temp_zip.name
    temp_zip.close()

    file_metadata = getattr(user, 'file_metadata', {})

    with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for fname in filenames:
            folder_id = file_metadata.get(fname, {}).get('folder_id')
            path_names = await user_service.get_folder_path_names(username, folder_id)
            folder_path = file_service._get_folder_path(username, path_names)
            file_path = folder_path / fname
            
            if file_path.exists():
                # Store with hierarchy? Or flat?
                # If flat, collisions possible.
                # Use path_names to build arcname
                arcname = os.path.join(*path_names, fname) if path_names else fname
                zf.write(file_path, arcname=arcname)

    return FileResponse(
        path=temp_zip_path, 
        filename=f"{username}_batch_download.zip",
        background=BackgroundTask(os.unlink, temp_zip_path) # Clean up after send
    )


