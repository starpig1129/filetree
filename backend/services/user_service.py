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


    async def add_user_url(self, username: str, url_record: dict) -> bool:
        """Atomically add a URL to the user's list.

        Args:
            username: The user to update.
            url_record: The URL record dict (from URLRecord.dict()).
        
        Returns:
            True if successful.
        """
        async with self._lock:
            users = await self._read_users()
            for user in users:
                if user['username'] == username:
                    current_urls = user.get('urls', [])
                    # Insert at beginning
                    current_urls.insert(0, url_record)
                    # Limit to 30
                    user['urls'] = current_urls[:30]
                    await self._write_users(users)
                    return True
            return False


# Singleton instance
user_service = UserService()
