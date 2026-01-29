"""
File management service for handling physical file operations.
"""

import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional
import aiofiles.os
from backend.config import settings
from backend.schemas import FileInfo


class FileService:
    """Service for file-related operations."""

    def __init__(self, upload_base: Path = settings.paths.upload_folder):
        """Initialize the service.

        Args:
            upload_base: The base directory for uploads.
        """
        self.upload_base = upload_base

    def _get_user_folder(self, folder_name: str) -> Path:
        """Get the absolute path to a user's upload folder.

        Args:
            folder_name: The user-specific folder name.

        Returns:
            The Path object for the folder.
        """
        path = self.upload_base / folder_name
        path.mkdir(parents=True, exist_ok=True)
        return path

    async def get_user_files(self, folder_name: str) -> List[FileInfo]:
        """Fetch all files in a user's folder with metadata.

        Args:
            folder_name: The user's folder name.

        Returns:
            A list of FileInfo schemas.
        """
        folder = self._get_user_folder(folder_name)
        files = []

        # List files in the directory
        for item in folder.iterdir():
            if item.is_file():
                stat = item.stat()
                created_time = datetime.fromtimestamp(stat.st_mtime)
                expiry_time = created_time + timedelta(days=settings.logic.file_retention_days)
                remaining = expiry_time - datetime.now()

                files.append(FileInfo(
                    name=item.name,
                    size=round(stat.st_size / (1024 * 1024), 2),
                    size_bytes=stat.st_size,
                    created=created_time.strftime('%Y-%m-%d %H:%M:%S'),
                    remaining_days=max(0, remaining.days),
                    remaining_hours=max(0, remaining.seconds // 3600),
                    remaining_minutes=max(0, (remaining.seconds % 3600) // 60),
                    expired=remaining.total_seconds() <= 0
                ))

        return sorted(files, key=lambda x: x.name)

    async def delete_file(self, folder_name: str, filename: str) -> bool:
        """Delete a specific file.

        Args:
            folder_name: The user's folder name.
            filename: The name of the file to delete.

        Returns:
            True if deleted, False if not found.
        """
        filepath = self._get_user_folder(folder_name) / filename
        if filepath.exists() and filepath.is_file():
            await aiofiles.os.remove(filepath)
            return True
        return False

    async def save_file(self, folder_name: str, filename: str, content: bytes) -> str:
        """Save a new file, ensuring a unique name.

        Args:
            folder_name: The user's folder.
            filename: The original filename.
            content: The file content in bytes.

        Returns:
            The final unique filename.
        """
        folder = self._get_user_folder(folder_name)
        name, ext = os.path.splitext(filename)
        counter = 1
        unique_name = filename
        
        while (folder / unique_name).exists():
            unique_name = f"{name}_{counter}{ext}"
            counter += 1
            
        async with aiofiles.open(folder / unique_name, mode='wb') as f:
            await f.write(content)
            
        return unique_name


# Singleton instance
file_service = FileService()
