"""
User management service for handling JSON-based user storage.
"""

import json
import asyncio
import uuid
from pathlib import Path
from typing import List, Optional
import aiofiles
from backend.config import settings
from backend.schemas import UserCreate, UserPublic
from backend.core.auth import verify_password, generate_salt, hash_password


class UserService:
    """Service for user operations."""

    def __init__(self, data_path: Path = settings.paths.user_info_file):
        """Initialize the service.

        Args:
            data_path: Path to the user JSON file.
        """
        self.data_path = data_path
        self._lock = asyncio.Lock()

    @property
    def lock(self):
        """Expose lock for external atomic operations."""
        return self._lock

    async def _read_users(self) -> List[dict]:
        """Read users from the JSON file.

        Returns:
            A list of user dictionaries.
        """
        if not self.data_path.exists():
            return []
        async with aiofiles.open(self.data_path, mode='r', encoding='utf-8') as f:
            content = await f.read()
            return json.loads(content) if content else []

    async def _write_users(self, users: List[dict]) -> None:
        """Write users to the JSON file.

        Args:
            users: List of user dictionaries to save.
        """
        # Use UUID to prevent filename collisions during concurrent writes
        temp_path = self.data_path.with_suffix(f".{uuid.uuid4()}.tmp")
        try:
            async with aiofiles.open(temp_path, mode='w', encoding='utf-8') as f:
                await f.write(json.dumps(users, indent=4, ensure_ascii=False, default=str))
            # Atomic rename
            temp_path.replace(self.data_path)
        except Exception as e:
            if temp_path.exists():
                temp_path.unlink()
            raise e

    async def get_user_by_name(self, username: str) -> Optional[UserCreate]:
        """Fetch a user by their username.

        Args:
            username: The username to find.

        Returns:
            The UserCreate model if found, None otherwise.
        """
        users = await self._read_users()
        for user in users:
            if user['username'] == username:
                return UserCreate(**user)
        return None

    async def get_user_by_password(self, password: str) -> Optional[UserCreate]:
        """Authenticate a user by password.

        Args:
            password: The plain text password.

        Returns:
            The authenticated UserCreate model if successful, None otherwise.
        """
        users = await self._read_users()
        for user_data in users:
            # Handle legacy plain passwords if any (though new ones use hashes)
            if 'salt' in user_data:
                if verify_password(password, user_data['salt'], user_data['hashed_password']):
                    return UserCreate(**user_data)
            elif user_data.get('password') == password:
                return UserCreate(**user_data)
        return None

    async def list_public_users(self) -> List[UserPublic]:
        """List all users with public info.

        Returns:
            A list of UserPublic models.
        """
        users = await self._read_users()
        # Filter out users who have explicitly set show_in_list to False
        # Default to True for backward compatibility
        return [UserPublic(**u) for u in users if u.get('show_in_list', True)]

    async def list_all_users_for_admin(self) -> List[UserPublic]:
        """List ALL users for admin panel (including hidden ones).

        Returns:
            A list of UserPublic models (safe to send to client).
        """
        users = await self._read_users()
        return [UserPublic(**u) for u in users]

    async def list_all_users(self) -> List[UserCreate]:
        """List all users with full info (Admin usage).

        Returns:
            A list of UserCreate models.
        """
        users = await self._read_users()
        return [UserCreate(**u) for u in users]

    async def update_user(self, username: str, update_data: dict) -> bool:
        """Update specific fields for a user.

        Args:
            username: The user to update.
            update_data: Dictionary of fields to update.

        Returns:
            True if successful, False if user not found.
        """
        async with self._lock:
            users = await self._read_users()
            for user in users:
                if user['username'] == username:
                    user.update(update_data)
                    await self._write_users(users)
                    return True
            return False

    async def update_user_profile(self, old_username: str, new_username: Optional[str] = None, is_locked: Optional[bool] = None) -> bool:
        """Advanced user update including renaming and folder sync.

        Args:
            old_username: Current username.
            new_username: New username to set.
            is_locked: Whether to lock the account.

        Returns:
            True if successful.
        """
        async with self._lock:
            users = await self._read_users()
            user_idx = -1
            for i, u in enumerate(users):
                if u['username'] == old_username:
                    user_idx = i
                    break
            
            if user_idx == -1:
                return False

            user = users[user_idx]
            
            # 1. Handle Rename
            if new_username and new_username != old_username:
                # Check collision
                if any(u['username'] == new_username for u in users):
                    raise ValueError(f"節點代碼 {new_username} 已被佔用。")
                
                # Sync folder if it was named after the user
                old_folder = user.get('folder', old_username)
                if old_folder == old_username:
                    old_path = settings.paths.upload_folder / old_folder
                    new_path = settings.paths.upload_folder / new_username
                    if old_path.exists() and not new_path.exists():
                        old_path.rename(new_path)
                        user['folder'] = new_username
                
                user['username'] = new_username

            # 2. Handle Lock
            if is_locked is not None:
                user['is_locked'] = is_locked

            await self._write_users(users)
            return True

    async def reset_password(self, username: str, new_password: str) -> bool:
        """Reset a user's password.

        Args:
            username: The user whose password to reset.
            new_password: The new plain text password.

        Returns:
            True if successful, False if user not found.
        """
        async with self._lock:
            users = await self._read_users()
            for user in users:
                if user['username'] == username:
                    salt = generate_salt()
                    user['salt'] = salt
                    user['hashed_password'] = hash_password(new_password, salt)
                    user['first_login'] = True
                    await self._write_users(users)
                    return True
            return False

    async def delete_user(self, username: str) -> bool:
        """Delete a user and their associated data.

        Args:
            username: The username to delete.

        Returns:
            True if successful, False if not found.
        """
        async with self._lock:
            users = await self._read_users()
            user_to_delete = None
            for i, u in enumerate(users):
                if u['username'] == username:
                    user_to_delete = users.pop(i)
                    break
            
            if not user_to_delete:
                return False

            # Clean up storage folder if it matches conventions
            folder = user_to_delete.get('folder')
            if folder:
                folder_path = settings.paths.upload_folder / folder
                if folder_path.exists() and folder_path.is_dir():
                    import shutil
                    # Use a separate thread for blocking IO? 
                    # For simplicity in this scale, we'll do it directly or use aiofiles if possible.
                    # shutil.rmtree is blocking, so we wrap it.
                    import asyncio
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, shutil.rmtree, folder_path)

            await self._write_users(users)
            return True


    async def add_folder(self, username: str, name: str, folder_type: str, parent_id: Optional[str] = None) -> str:
        """Add a new folder for a user.
        
        Args:
            username: The user's name.
            name: Folder name.
            folder_type: 'file' or 'url'.
            parent_id: Optional parent folder ID.
            
        Returns:
            The new folder ID.
        """
        # Sanitize name
        name = name.strip().replace("/", "_").replace("\\", "_").replace("..", "_")
        if not name:
            raise Exception("Invalid folder name")

        async with self._lock:
            users = await self._read_users()
            for user in users:
                if user['username'] == username:
                    folders = user.get('folders', [])
                    
                    # Check for duplicate name in same parent
                    if any(f['name'] == name and f.get('parent_id') == parent_id for f in folders):
                        raise Exception("Folder name already exists")

                    folder_id = str(uuid.uuid4())
                    folders.append({
                        "id": folder_id,
                        "name": name,
                        "type": folder_type,
                        "parent_id": parent_id
                    })
                    user['folders'] = folders
                    await self._write_users(users)
                    return folder_id
            return None

    async def update_folder(self, username: str, folder_id: str, name: str) -> bool:
        """Update folder metadata.
        
        Args:
            username: The username.
            folder_id: The folder ID.
            name: New folder name.
            
        Returns:
            Success status.
        """
        # Sanitize name
        name = name.strip().replace("/", "_").replace("\\", "_").replace("..", "_")
        if not name:
            return False

        async with self._lock:
            users = await self._read_users()
            for user in users:
                if user['username'] == username:
                    folders = user.get('folders', [])
                    target_folder = next((f for f in folders if f['id'] == folder_id), None)
                    
                    if not target_folder:
                        return False

                    # Check for duplicate name in same parent (excluding self)
                    parent_id = target_folder.get('parent_id')
                    if any(f['name'] == name and f.get('parent_id') == parent_id and f['id'] != folder_id for f in folders):
                        # Duplicate found
                        return False

                    target_folder['name'] = name
                    await self._write_users(users)
                    return True
            return False

    async def delete_folder(self, username: str, folder_id: str) -> bool:
        """Delete a folder and unassign items.

        Args:
            username: The user to update.
            folder_id: Folder ID.
        
        Returns:
            True if successful.
        """
        async with self._lock:
            users = await self._read_users()
            for user in users:
                if user['username'] == username:
                    # Remove folder
                    folders = user.get('folders', [])
                    user['folders'] = [f for f in folders if f['id'] != folder_id]
                    
                    # Unassign URLs
                    urls = user.get('urls', [])
                    for u in urls:
                        if u.get('folder_id') == folder_id:
                            u['folder_id'] = None
                    
                    # Unassign files in metadata
                    file_metadata = user.get('file_metadata', {})
                    for filename, meta in file_metadata.items():
                        if meta.get('folder_id') == folder_id:
                            meta['folder_id'] = None
                    
                    await self._write_users(users)
                    return True
            return False

    async def move_item(self, username: str, item_type: str, item_id: str, folder_id: Optional[str]) -> bool:
        """Move a file, URL, or folder to a folder.

        Args:
            username: The user to update.
            item_type: 'file', 'url', or 'folder'.
            item_id: filename, url string, or folder ID.
            folder_id: Target folder ID (parent) or None to move to root.
        
        Returns:
            True if successful.
        """
        async with self._lock:
            users = await self._read_users()
            for user in users:
                if user['username'] == username:
                    if item_type == 'url':
                        urls = user.get('urls', [])
                        for u in urls:
                            if u['url'] == item_id:
                                u['folder_id'] = folder_id
                                await self._write_users(users)
                                return True
                    elif item_type == 'file':
                        file_metadata = user.get('file_metadata', {})
                        if item_id not in file_metadata:
                            file_metadata[item_id] = {}
                        file_metadata[item_id]['folder_id'] = folder_id
                        user['file_metadata'] = file_metadata
                        await self._write_users(users)
                        return True
                    elif item_type == 'folder':
                        folders = user.get('folders', [])
                        
                        # Prevent moving to itself or its descendant
                        if folder_id:
                            if item_id == folder_id:
                                return False
                            
                            def is_descendant(f_id, target_id):
                                current = target_id
                                while current:
                                    parent = next((f.get('parent_id') for f in folders if f['id'] == current), None)
                                    if parent == f_id:
                                        return True
                                    current = parent
                                return False
                            
                            if is_descendant(item_id, folder_id):
                                return False

                        for f in folders:
                            if f['id'] == item_id:
                                f['parent_id'] = folder_id
                                await self._write_users(users)
                                return True
            return False

    async def get_folder_path_names(self, username: str, folder_id: Optional[str]) -> List[str]:
        """Resolve the physical path (list of folder names) for a folder ID.
        
        Args:
            username: The username.
            folder_id: The folder ID.
            
        Returns:
            List of folder names from root to target.
        """
        if not folder_id:
            return []
            
        users = await self._read_users()
        user = next((u for u in users if u['username'] == username), None)
        if not user:
            return []
            
        folders = user.get('folders', [])
        path = []
        current_id = folder_id
        
        # Max depth safety
        for _ in range(50):
            folder = next((f for f in folders if f['id'] == current_id), None)
            if not folder:
                break
            path.insert(0, folder['name'])
            current_id = folder.get('parent_id')
            if not current_id:
                break
                
        return path


# Singleton instance
user_service = UserService()
