
import os
import hashlib
import shutil
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
        # Check if ffmpeg is available at startup
        self._ffmpeg_available = shutil.which("ffmpeg") is not None
        if not self._ffmpeg_available:
            print("WARNING: ffmpeg not found. Video thumbnails will be unavailable.")

    def _is_valid_media(self, file_path: Path) -> bool:
        """Perform basic magic byte validation to ensure file is a legitimate media type."""
        try:
            with open(file_path, "rb") as f:
                header = f.read(16)
                
            ext = file_path.suffix.lower()
            
            # Image signatures
            if ext in ['.jpg', '.jpeg']:
                return header.startswith(b'\xff\xd8\xff')
            if ext == '.png':
                return header.startswith(b'\x89PNG\r\n\x1a\n')
            if ext == '.gif':
                return header.startswith(b'GIF87a') or header.startswith(b'GIF89a')
            if ext == '.bmp':
                return header.startswith(b'BM')
            if ext == '.webp':
                return header.startswith(b'RIFF') and b'WEBP' in header
            if ext in ['.heic', '.heif']:
                return b'ftyp' in header and (b'heic' in header or b'heix' in header or b'hevc' in header or b'mif1' in header)
            if ext in ['.arw', '.cr2', '.nef', '.dng', '.orf', '.sr2', '.raf']:
                # Most RAW formats use TIFF structure: II* (Little Endian) or MM (Big Endian)
                return header.startswith(b'II\x2a\x00') or header.startswith(b'MM\x00\x2a')
                
            # Video signatures (simple ftyp check)
            if ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
                # ftyp usually starts at offset 4
                return b'ftyp' in header or b'matroska' in header or b'RIFF' in header or header.startswith(b'\x1a\x45\xdf\xa3') # EBML (mkv/webm)
            
            return False
        except Exception:
            return False

    def _get_cache_path(self, file_path: Path) -> Path:
        """Generate a unique cache path based on file content hash (or path+mtime)"""
        # Using path + mtime is faster than reading whole file for hash
        stat = file_path.stat()
        identifier = f"{file_path.absolute()}_{stat.st_mtime}_{stat.st_size}"
        hash_name = hashlib.md5(identifier.encode()).hexdigest()
        
        # Use .gif for gif files, .jpg for others
        ext = ".gif" if file_path.suffix.lower() == ".gif" else ".jpg"
        return self.cache_dir / f"{hash_name}{ext}"

    async def get_thumbnail(self, file_path: Path) -> str:
        """Get path to thumbnail, generating if necessary."""
        if not file_path.exists():
            return None

        cache_path = self._get_cache_path(file_path)
        if cache_path.exists():
            return str(cache_path)

        # SECURITY: Validate file content before processing
        if not self._is_valid_media(file_path):
            return None

        # Generate generic thumbnail
        ext = file_path.suffix.lower()
        if ext == '.gif':
            await self._generate_gif_thumbnail(file_path, cache_path)
            # If GIF generation failed (no cache file), return original to preserve animation
            if not cache_path.exists():
                return str(file_path)
        elif ext in ['.jpg', '.jpeg', '.png', '.webp', '.bmp']:
            await self._generate_image_thumbnail(file_path, cache_path)
        elif ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
            # Skip video thumbnails if ffmpeg is not available
            if not self._ffmpeg_available:
                return None
            await self._generate_video_thumbnail(file_path, cache_path)
        else:
            return None  # No thumbnail for other types

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

    async def _generate_gif_thumbnail(self, input_path: Path, output_path: Path):
        """Generate an animated GIF thumbnail using ffmpeg."""
        if not self._ffmpeg_available:
            return

        try:
            # Use ffmpeg to scale the GIF
            # flags=lanczos for better quality scaling
            cmd = [
                'ffmpeg',
                '-y',
                '-i', str(input_path),
                '-vf', f'scale={self.thumb_size[0]}:-1:flags=lanczos',
                str(output_path)
            ]
            
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE
            )
            
            try:
                _, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
                if proc.returncode != 0:
                    print(f"ffmpeg gif generation error: {stderr.decode()}")
            except asyncio.TimeoutError:
                proc.kill()
                print(f"ffmpeg timeout for {input_path}")
                
        except Exception as e:
            print(f"Error generating gif thumbnail for {input_path}: {e}")

    async def _generate_video_thumbnail(self, input_path: Path, output_path: Path):
        """Generate a video thumbnail using ffmpeg with a timeout."""
        try:
            # Use ffmpeg to extract first frame
            cmd = [
                'ffmpeg',
                '-y',  # Overwrite output file without asking
                '-i', str(input_path),
                '-ss', '00:00:01',  # Seek to 1 second for a better frame
                '-vframes', '1',
                '-vf', f'scale={self.thumb_size[0]}:-1',  # maintain aspect ratio
                str(output_path)
            ]
            
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE
            )
            try:
                # Add timeout to prevent hanging
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
                if proc.returncode != 0:
                    print(f"ffmpeg error: {stderr.decode()}")
            except asyncio.TimeoutError:
                proc.kill()
                print(f"ffmpeg timeout for {input_path}")
            
        except Exception as e:
            print(f"Error generating video thumbnail for {input_path}: {e}")

thumbnail_service = ThumbnailService()
