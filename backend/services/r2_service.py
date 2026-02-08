"""
Service for Cloudflare R2 (S3 compatible) storage operations.
Handles multipart uploads, presigned URLs, and cleanup.
"""

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import threading
import time
import os
from backend.config import settings

logger = logging.getLogger(__name__)

class R2Service:
    """Service for R2 operations with fallback and concurrency control."""

    def __init__(self):
        self._client = None
        self._lock = threading.Lock()
        self._active_uploads = 0
        self._active_downloads = 0
        
        # Initialize client if config is present
        self._init_client()

    def _init_client(self):
        """Initialize boto3 client."""
        if not settings.r2.endpoint_url or not settings.r2.access_key_id:
            logger.warning("R2 credentials not configured. R2 service disabled.")
            return

        try:
            self._client = boto3.client(
                's3',
                endpoint_url=settings.r2.endpoint_url,
                aws_access_key_id=settings.r2.access_key_id,
                aws_secret_access_key=settings.r2.secret_access_key,
                config=Config(signature_version='s3v4'),
                region_name='auto' # R2 requires region, auto is usually fine or specific one
            )
            logger.info("R2 client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize R2 client: {e}")
            self._client = None

    def is_configured(self) -> bool:
        """Check if R2 is configured and client is ready."""
        return self._client is not None

    def acquire_upload_slot(self) -> bool:
        """Try to acquire an upload slot."""
        with self._lock:
            if self._active_uploads < settings.r2.max_concurrent_uploads:
                self._active_uploads += 1
                return True
            return False

    def release_upload_slot(self):
        """Release an upload slot."""
        with self._lock:
            if self._active_uploads > 0:
                self._active_uploads -= 1

    def generate_presigned_url(self, object_name: str, method: str = 'put_object', expiration: int = 3600) -> Optional[str]:
        """Generate a presigned URL for direct upload/download."""
        if not self._client:
            return None
        
        try:
            response = self._client.generate_presigned_url(
                ClientMethod=method,
                Params={
                    'Bucket': settings.r2.bucket_name,
                    'Key': object_name
                },
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {e}")
            return None

    def create_multipart_upload(self, object_name: str, content_type: str = 'application/octet-stream') -> Optional[Dict[str, Any]]:
        """Initiate a multipart upload."""
        if not self._client:
            return None
        
        try:
            response = self._client.create_multipart_upload(
                Bucket=settings.r2.bucket_name,
                Key=object_name,
                ContentType=content_type
            )
            return {'UploadId': response['UploadId'], 'Key': response['Key']}
        except ClientError as e:
            logger.error(f"Error initiating multipart upload: {e}")
            return None

    def delete_file(self, object_name: str):
        """Delete file from R2 immediately."""
        if not self._client:
            return
        
        try:
            self._client.delete_object(
                Bucket=settings.r2.bucket_name,
                Key=object_name
            )
            logger.info(f"Deleted file from R2: {object_name}")
        except ClientError as e:
            logger.error(f"Error deleting file from R2: {e}")

    def upload_file(self, local_path: Path, object_name: str) -> bool:
        """Upload a local file to R2 (for acceleration downloads)."""
        if not self._client:
            return False
            
        try:
            self._client.upload_file(
                str(local_path),
                settings.r2.bucket_name,
                object_name
            )
            return True
        except ClientError as e:
            logger.error(f"Error uploading file to R2: {e}")
            return False

    def download_and_delete(self, object_name: str, local_path: Path) -> bool:
        """Download file from R2 to local and delete it immediately."""
        if not self._client:
            return False
            
        try:
            logger.info(f"Downloading {object_name} from R2 to {local_path}...")
            self._client.download_file(
                settings.r2.bucket_name,
                object_name,
                str(local_path)
            )
            logger.info(f"Download complete. Deleting R2 copy...")
            self.delete_file(object_name)
            return True
        except Exception as e:
            logger.error(f"Error downloading/deleting file from R2: {e}")
            # Try to delete anyway to clean up
            self.delete_file(object_name)
            return False

    def prepare_download(self, local_path: Path, object_name: str) -> Optional[str]:
        """Ensure file exists on R2 and return presigned URL."""
        if not self._client:
            return None
            
        # 1. Check if exists
        try:
            self._client.head_object(Bucket=settings.r2.bucket_name, Key=object_name)
            # Exists, generate URL
            logger.info(f"R2 cache hit for {object_name}")
            return self.generate_presigned_url(object_name, method='get_object')
        except ClientError:
            # Not found (404), proceed to upload
            pass
            
        # 2. Upload
        if not self.acquire_upload_slot(): # Reuse upload slot for this egress-upload
            logger.warning("R2 slots full, skipping acceleration")
            return None
            
        try:
            logger.info(f"Uploading {local_path} to R2 for acceleration...")
            self._client.upload_file(
                str(local_path),
                settings.r2.bucket_name,
                object_name
            )
            return self.generate_presigned_url(object_name, method='get_object')
        except Exception as e:
            logger.error(f"Failed to upload for download acceleration: {e}")
            return None
        finally:
            self.release_upload_slot()

# Singleton instance
r2_service = R2Service()
