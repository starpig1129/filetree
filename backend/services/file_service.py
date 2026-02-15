"""
File management service for handling physical file operations.
"""

import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional
import aiofiles.os
import zipfile
import tempfile
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

    def _get_user_base_folder(self, username: str) -> Path:
        """Get the absolute path to a user's root upload folder.

        Args:
            username: The username.

        Returns:
            The Path object for the base folder.
        """
        path = self.upload_base / username
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _get_folder_path(self, username: str, folder_path_names: List[str]) -> Path:
        """Get the absolute path for a specific subfolder path.
        
        Args:
            username: The username.
            folder_path_names: List of folder names from root to target.
            
        Returns:
            The absolute Path object.
        """
        path = self._get_user_base_folder(username)
        for name in folder_path_names:
            path = path / name
        path.mkdir(parents=True, exist_ok=True)
        return path

    async def get_user_files(self, username: str, retention_days: int = None, folders: List[dict] = None) -> List[FileInfo]:
        """Fetch all files in a user's base folder (recursively) with metadata.

        Args:
            username: The username.
            retention_days: Optional custom retention period. Defaults to config if None.
            folders: Optional list of user folder dicts to map physical paths to folder IDs.

        Returns:
            A list of FileInfo schemas.
        """
        if retention_days is None:
            retention_days = settings.logic.file_retention_days
        base_folder = self._get_user_base_folder(username)
        files = []

        # Build path map from folders: tuple(path_parts) -> folder_id
        # We need to resolve full path for each folder id
        # folders is list of dicts: {id, name, parent_id, ...}
        folder_path_map = {}
        if folders:
            # First build id -> folder map
            id_map = {f['id']: f for f in folders}
            
            # Helper to resolve path
            def resolve_path(current_id):
                path = []
                curr = current_id
                depth = 0
                while curr and depth < 50:
                    f = id_map.get(curr)
                    if not f: break
                    path.insert(0, f['name'])
                    curr = f.get('parent_id')
                    depth += 1
                return tuple(path)

            for f in folders:
                p = resolve_path(f['id'])
                if p:
                    folder_path_map[p] = f['id']

        # List files in the directory recursively
        for root, dirs, filenames in os.walk(base_folder):
            # Determine folder_id for current root
            rel_path = Path(root).relative_to(base_folder)
            rel_parts = tuple(rel_path.parts) if str(rel_path) != '.' else ()
            
            current_folder_id = folder_path_map.get(rel_parts)

            for filename in filenames:
                item = Path(root) / filename
                stat = item.stat()
                created_time = datetime.fromtimestamp(stat.st_mtime)
                
                if retention_days == 0:
                    remaining_days = -1
                    remaining_hours = 0
                    remaining_minutes = 0
                    expired = False
                else:
                    expiry_time = created_time + timedelta(days=retention_days)
                    remaining = expiry_time - datetime.now()
                    remaining_days = max(0, remaining.days)
                    remaining_hours = max(0, remaining.seconds // 3600)
                    remaining_minutes = max(0, (remaining.seconds % 3600) // 60)
                    expired = remaining.total_seconds() <= 0

                files.append(FileInfo(
                    name=item.name,
                    size=round(stat.st_size / (1024 * 1024), 2),
                    size_bytes=stat.st_size,
                    created=created_time.strftime('%Y-%m-%d %H:%M:%S'),
                    remaining_days=remaining_days,
                    remaining_hours=remaining_hours,
                    remaining_minutes=remaining_minutes,

                    expired=expired,
                    folder_id=current_folder_id
                ))

        return sorted(files, key=lambda x: x.name)

    async def delete_file(self, username: str, filename: str, folder_path_names: List[str] = None) -> bool:
        """Delete a specific file.

        Args:
            username: The username.
            filename: The name of the file to delete.
            folder_path_names: Optional physical subpath.

        Returns:
            True if deleted, False if not found.
        """
        filename = os.path.basename(filename)
        folder = self._get_folder_path(username, folder_path_names or [])
        filepath = folder / filename
        if filepath.exists() and filepath.is_file():
            await aiofiles.os.remove(filepath)
            return True
        return False

    async def save_file(self, username: str, filename: str, content: bytes, folder_path_names: List[str] = None) -> str:
        """Save a new file, ensuring a unique name.

        Args:
            username: The username.
            filename: The original filename.
            content: The file content in bytes.
            folder_path_names: Optional physical subpath.

        Returns:
            The final unique filename.
        """
        filename = os.path.basename(filename)
        folder = self._get_folder_path(username, folder_path_names or [])
        name, ext = os.path.splitext(filename)
        counter = 1
        unique_name = filename
        
        while (folder / unique_name).exists():
            unique_name = f"{name}_{counter}{ext}"
            counter += 1
            
        async with aiofiles.open(folder / unique_name, mode='wb') as f:
            await f.write(content)
        
        from backend.services.dedup_service import dedup_service
        try:
            await dedup_service.deduplicate(folder / unique_name)
        except Exception as e:
            print(f"Dedup failed: {e}")
            
        return unique_name

    async def move_file(self, username: str, filename: str, from_path: List[str], to_path: List[str]) -> bool:
        """Physically move a file to another subfolder."""
        filename = os.path.basename(filename)
        old_folder = self._get_folder_path(username, from_path)
        new_folder = self._get_folder_path(username, to_path)
        
        if not (old_folder / filename).exists():
            return False
            
        # Ensure name uniqueness in target
        name, ext = os.path.splitext(filename)
        target_name = filename
        counter = 1
        while (new_folder / target_name).exists():
            target_name = f"{name}_{counter}{ext}"
            counter += 1
            
        await aiofiles.os.rename(old_folder / filename, new_folder / target_name)
        return True

    async def rename_physical_folder(self, username: str, path_to: List[str], old_name: str, new_name: str) -> bool:
        """Rename a physical directory."""
        base = self._get_folder_path(username, path_to)
        old_path = base / old_name
        new_path = base / new_name
        
        if old_path.exists() and old_path.is_dir() and not new_path.exists():
            await aiofiles.os.rename(old_path, new_path)
            return True
        return False

    async def delete_physical_folder(self, username: str, path: List[str]) -> bool:
        """Delete a physical directory recursively."""
        target_path = self._get_folder_path(username, path)
        if target_path.exists() and target_path.is_dir():
            import shutil
            import asyncio
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, shutil.rmtree, target_path)
            return True
        return False

    async def rename_file(self, username: str, old_name: str, new_name: str, folder_path_names: List[str] = None) -> bool:
        """Rename a file.

        Args:
            username: The username.
            old_name: Current filename.
            new_name: New filename.
            folder_path_names: Optional physical subpath.

        Returns:
            True if successful, False if file doesn't exist or new name taken.
        """
        # Security: Prevent path traversal
        old_name = os.path.basename(old_name)
        new_name = os.path.basename(new_name)
        
        folder = self._get_folder_path(username, folder_path_names or [])
        old_path = folder / old_name
        new_path = folder / new_name
        
        if not old_path.exists() or not old_path.is_file():
            return False
            
        if new_path.exists():
            return False
            
        await aiofiles.os.rename(old_path, new_path)
        return True
    async def import_file(self, source_path: Path, username: str, filename: str, folder_path_names: List[str] = None) -> Optional[str]:
        """Import a file from a local path into the user's folder (move).

        Args:
            source_path: Path to the source file (will be moved).
            username: The username.
            filename: The original filename.
            folder_path_names: Optional physical subpath.

        Returns:
            The final unique filename, or None on failure.
        """
        # Security: Prevent path traversal
        filename = os.path.basename(filename)
        folder = self._get_folder_path(username, folder_path_names or [])
        
        if not source_path.exists():
            return None
            
        name, ext = os.path.splitext(filename)
        counter = 1
        unique_name = filename
        
        while (folder / unique_name).exists():
            unique_name = f"{name}_{counter}{ext}"
            counter += 1
            
        target_path = folder / unique_name
        
        try:
            # Move the file
            await aiofiles.os.rename(source_path, target_path)
            
            # Trigger deduplication
            from backend.services.dedup_service import dedup_service
            try:
                await dedup_service.deduplicate(target_path)
            except Exception as e:
                # Log but don't fail the upload
                print(f"Dedup failed for imported file {unique_name}: {e}")
                
            return unique_name
        except Exception as e:
            print(f"Failed to import file: {e}")
            return None

    def create_batch_zip(self, username: str, filenames: List[str], folder_path_names: List[str] = None) -> Path:
        """Create a temporary zip file containing specified files.

        Args:
            username: The username.
            filenames: List of filenames to include in the zip.
            folder_path_names: Optional physical subpath.

        Returns:
            The Path to the created temporary zip file.
        """
        user_folder = self._get_folder_path(username, folder_path_names or [])
        
        # Create a named temporary file that won't be deleted automatically on close
        # because we need to send it in the response
        temp_zip = tempfile.NamedTemporaryFile(suffix='.zip', delete=False)
        temp_zip_path = Path(temp_zip.name)
        temp_zip.close() # Close the handle so zipfile can open it

        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for filename in filenames:
                # Sanitize filename to prevent path traversal
                filename = os.path.basename(filename)
                filepath = user_folder / filename
                if filepath.exists() and filepath.is_file():
                    zf.write(filepath, arcname=filename)
        
        return temp_zip_path

# Singleton instance
file_service = FileService()
