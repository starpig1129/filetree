"""
User management service for handling JSON-based user storage.
"""

import json
from pathlib import Path
from typing import List, Optional
import aiofiles
from backend.config import settings
from backend.schemas import UserCreate, UserPublic
from backend.core.auth import verify_password


class UserService:
    """Service for user operations."""

    def __init__(self, data_path: Path = settings.paths.user_info_file):
        """Initialize the service.

        Args:
            data_path: Path to the user JSON file.
        """
        self.data_path = data_path

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
        async with aiofiles.open(self.data_path, mode='w', encoding='utf-8') as f:
            await f.write(json.dumps(users, indent=4, ensure_ascii=False))

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
        return [UserPublic(**u) for u in users]

    async def update_user(self, username: str, update_data: dict) -> bool:
        """Update user data.

        Args:
            username: The user to update.
            update_data: Dictionary of fields to update.

        Returns:
            True if user was found and updated, False otherwise.
        """
        users = await self._read_users()
        for i, user in enumerate(users):
            if user['username'] == username:
                users[i].update(update_data)
                await self._write_users(users)
                return True
        return False


# Singleton instance
user_service = UserService()
