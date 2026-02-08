
import os
import hashlib
import subprocess
from pathlib import Path
from PIL import Image, ImageOps
import asyncio
from backend.config import settings

class ThumbnailService:
    def __init__(self):
        self.cache_dir = settings.paths.tus_temp_folder.parent / "cache" / "thumbnails"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.thumb_size = (300, 300)

    def _get_cache_path(self, file_path: Path) -> Path:
        """Generate a unique cache path based on file content hash (or path+mtime)"""
        # Using path + mtime is faster than reading whole file for hash
        stat = file_path.stat()
        identifier = f"{file_path.absolute()}_{stat.st_mtime}_{stat.st_size}"
        hash_name = hashlib.md5(identifier.encode()).hexdigest()
        return self.cache_dir / f"{hash_name}.jpg"

    async def get_thumbnail(self, file_path: Path) -> str:
        """Get path to thumbnail, generating if necessary."""
        if not file_path.exists():
            return None

        cache_path = self._get_cache_path(file_path)
        if cache_path.exists():
            return str(cache_path)

        # Generate generic thumbnail
        ext = file_path.suffix.lower()
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
            await self._generate_image_thumbnail(file_path, cache_path)
        elif ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
            await self._generate_video_thumbnail(file_path, cache_path)
        else:
            return None # No thumbnail for other types

        return str(cache_path) if cache_path.exists() else None

    async def _generate_image_thumbnail(self, input_path: Path, output_path: Path):
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._process_image, input_path, output_path)
        except Exception as e:
            print(f"Error generating image thumbnail for {input_path}: {e}")

    def _process_image(self, input_path, output_path):
        with Image.open(input_path) as img:
            # Convert to RGB (handle RGBA, P, etc.)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            # Smart crop/resize
            img = ImageOps.fit(img, self.thumb_size, method=Image.Resampling.LANCZOS)
            img.save(output_path, "JPEG", quality=80)

    async def _generate_video_thumbnail(self, input_path: Path, output_path: Path):
        try:
            # Use ffmpeg to extract first frame
            cmd = [
                'ffmpeg',
                '-i', str(input_path),
                '-ss', '00:00:00',
                '-vframes', '1',
                '-vf', f'scale={self.thumb_size[0]}:-1', # maintain aspect ratio
                str(output_path)
            ]
            
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            await proc.communicate()
            
        except Exception as e:
            print(f"Error generating video thumbnail for {input_path}: {e}")

thumbnail_service = ThumbnailService()
