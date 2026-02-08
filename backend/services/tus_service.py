"""
Tus (v1.0.0) protocol service for handling chunked and resumable uploads.
"""

import os
import json
import base64
from pathlib import Path
from typing import Optional, Dict, Any, List, AsyncIterator
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
                # Split only on first space to separate key and value
                parts = pair.strip().split(' ', 1)
                if len(parts) >= 2:
                    key = parts[0]
                    try:
                        value = base64.b64decode(parts[1]).decode('utf-8')
                        metadata[key] = value
                    except Exception as e:
                        print(f"Metadata decode error for {key}: {e}")
                        continue

        if not metadata:
            print(f"DEBUG: No metadata found after parsing. Original string: {metadata_str}")
            # Fallback if metadata parsing failed completely but we have a raw string?
            # Actually Tus spec says it must be Key Base64Value
            raise ValueError(f"Invalid or missing metadata: {metadata_str}")

        password = metadata.get('password')
        if not password:
            print("DEBUG: Password missing in metadata")
            raise ValueError("Missing password in metadata")

        # Validate file extension
        filename = metadata.get('filename')
        if filename and settings.logic.allowed_extensions:
            # Check if extension is allowed (case-insensitive)
            ext = os.path.splitext(filename)[1].lower()
            if ext not in [e.lower() for e in settings.logic.allowed_extensions]:
                raise ValueError(f"File type not allowed. Allowed: {', '.join(settings.logic.allowed_extensions)}")

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
        """Append a chunk of data to the upload."""
        info = await self.get_upload_info(upload_id)
        if not info:
            raise ValueError("Upload not found")

        if info['offset'] != offset:
            raise ValueError(f"Offset mismatch: expected {info['offset']}, got {offset}")

        async with aiofiles.open(self._get_data_path(upload_id), mode='ab') as f:
            await f.write(chunk)

        info['offset'] += len(chunk)

        async with aiofiles.open(self._get_info_path(upload_id), mode='w') as f:
            await f.write(json.dumps(info))

        return info['offset']

    async def patch_upload_stream(self, upload_id: str, offset: int, stream: AsyncIterator[bytes]) -> int:
        """Append a stream of data to the upload."""
        info = await self.get_upload_info(upload_id)
        if not info:
            raise ValueError("Upload not found")

        if info['offset'] != offset:
             raise ValueError(f"Offset mismatch: expected {info['offset']}, got {offset}")

        bytes_written = 0
        async with aiofiles.open(self._get_data_path(upload_id), mode='ab') as f:
            async for chunk in stream:
                await f.write(chunk)
                bytes_written += len(chunk)

        info['offset'] += bytes_written
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


    async def concat_uploads(self, target_id: str, partial_ids: List[str], metadata_str: str) -> None:
        """Concatenate multiple partial uploads into a final upload.

        Args:
            target_id: The ID of the final upload.
            partial_ids: List of IDs of partial uploads to concatenate.
            metadata_str: Metadata for the final upload.
        """
        # 1. Validate all partial uploads exist and are finished
        total_length = 0
        for pid in partial_ids:
            info = await self.get_upload_info(pid)
            if not info:
                raise ValueError(f"Partial upload {pid} not found")
            if info['offset'] != info['length']:
                raise ValueError(f"Partial upload {pid} is not complete")
            total_length += info['length']

        # 2. Create the final upload info
        # Reuse create_upload logic or manually create info
        # We need to parse metadata here too
        await self.create_upload(target_id, total_length, metadata_str)

        # 3. Concatenate data
        target_data_path = self._get_data_path(target_id)
        # Clear the empty file created by create_upload
        async with aiofiles.open(target_data_path, mode='wb') as f_target:
            for pid in partial_ids:
                source_data_path = self._get_data_path(pid)
                async with aiofiles.open(source_data_path, mode='rb') as f_source:
                    while True:
                        chunk = await f_source.read(1024 * 1024) # 1MB buffer
                        if not chunk:
                            break
                        await f_target.write(chunk)
        
        # 4. Update offset to reflect completion
        info = await self.get_upload_info(target_id)
        info['offset'] = total_length
        async with aiofiles.open(self._get_info_path(target_id), mode='w') as f:
            await f.write(json.dumps(info))

        # 5. Cleanup partial uploads
        for pid in partial_ids:
            await aiofiles.os.remove(self._get_info_path(pid))
            await aiofiles.os.remove(self._get_data_path(pid))

# Singleton instance
tus_service = TusService()
