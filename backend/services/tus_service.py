"""
Tus (v1.0.0) protocol service for handling chunked and resumable uploads.
"""

import os
import json
import base64
from pathlib import Path
from typing import Optional, Dict, Any
import aiofiles
import aiofiles.os
from backend.config import settings
from backend.services.user_service import user_service


class TusService:
    """Service for Tus protocol operations."""

    def __init__(self, temp_base: Path = settings.paths.tus_temp_folder):
        """Initialize the service.

        Args:
            temp_base: Directory for temporary chunk storage.
        """
        self.temp_base = temp_base
        self.temp_base.mkdir(parents=True, exist_ok=True)

    def _get_info_path(self, upload_id: str) -> Path:
        """Get the path to the upload metadata file."""
        return self.temp_base / f"{upload_id}.info"

    def _get_data_path(self, upload_id: str) -> Path:
        """Get the path to the upload data file."""
        return self.temp_base / f"{upload_id}.bin"

    async def create_upload(self, upload_id: str, length: int, metadata_str: str) -> None:
        """Initialize a new upload session.

        Args:
            upload_id: Unique identifier for the upload.
            length: Total size of the file in bytes.
            metadata_str: The encoded metadata string from Tus client.
        """
        # Parse metadata
        metadata = {}
        if metadata_str:
            for pair in metadata_str.split(','):
                parts = pair.split(' ')
                if len(parts) == 2:
                    key = parts[0]
                    value = base64.b64decode(parts[1]).decode('utf-8')
                    metadata[key] = value

        if not metadata:
            raise ValueError("Missing metadata")

        password = metadata.get('password')
        if not password:
            raise ValueError("Missing password in metadata")

        # Validate password using UserService
        # We need to await this since user_service methods are async
        user = await user_service.get_user_by_password(password)
        if not user:
            raise PermissionError("Invalid password")

        info = {
            "id": upload_id,
            "length": length,
            "offset": 0,
            "metadata": metadata
        }

        # Save metadata
        async with aiofiles.open(self._get_info_path(upload_id), mode='w') as f:
            await f.write(json.dumps(info))

        # Create empty data file
        async with aiofiles.open(self._get_data_path(upload_id), mode='wb') as f:
            pass

    async def get_upload_info(self, upload_id: str) -> Optional[Dict[str, Any]]:
        """Get information about an existing upload.

        Args:
            upload_id: Unique identifier for the upload.

        Returns:
            Dictionary containing upload info or None if not found.
        """
        info_path = self._get_info_path(upload_id)
        if not await aiofiles.os.path.exists(info_path):
            return None

        async with aiofiles.open(info_path, mode='r') as f:
            content = await f.read()
            return json.loads(content)

    async def patch_upload(self, upload_id: str, offset: int, chunk: bytes) -> int:
        """Append a chunk of data to the upload.

        Args:
            upload_id: Unique identifier for the upload.
            offset: The offset at which to write the data.
            chunk: The bytes to write.

        Returns:
            The new offset after writing.

        Raises:
            ValueError: If offset is incorrect or upload not found.
        """
        info = await self.get_upload_info(upload_id)
        if not info:
            raise ValueError("Upload not found")

        if info['offset'] != offset:
            # Tolerant offset check? Local clients might retry.
            # Tus spec says 409 Conflict if offset mismatch.
            raise ValueError(f"Offset mismatch: expected {info['offset']}, got {offset}")

        async with aiofiles.open(self._get_data_path(upload_id), mode='ab') as f:
            await f.write(chunk)

        info['offset'] += len(chunk)

        async with aiofiles.open(self._get_info_path(upload_id), mode='w') as f:
            await f.write(json.dumps(info))

        return info['offset']

    async def finalize_upload(self, upload_id: str, target_folder: Path) -> str:
        """Move the completed upload to its final location.

        Args:
            upload_id: Unique identifier for the upload.
            target_folder: Absolute path to the user's folder.

        Returns:
            The final filename.
        """
        info = await self.get_upload_info(upload_id)
        if not info:
            raise ValueError("Upload not found")

        filename = info['metadata'].get('filename', upload_id)
        # Security: Prevent path traversal
        filename = os.path.basename(filename)
        # Ensure unique name in target folder
        name, ext = os.path.splitext(filename)
        counter = 1
        unique_name = filename
        while (target_folder / unique_name).exists():
            unique_name = f"{name}_{counter}{ext}"
            counter += 1

        # Move file
        await aiofiles.os.rename(self._get_data_path(upload_id), target_folder / unique_name)
        
        # Cleanup info file
        await aiofiles.os.remove(self._get_info_path(upload_id))

        return unique_name


# Singleton instance
tus_service = TusService()
