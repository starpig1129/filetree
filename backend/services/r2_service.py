"""
Service for Cloudflare R2 (S3 compatible) storage operations.
Handles multipart uploads, presigned URLs, and cleanup.
"""

import json

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
        
        # Zero-Cost Safety Mechanism
        self._usage_file = settings.paths.upload_folder.parent / "r2_usage.json"
        self._usage = self._load_usage()
        
        # Initialize client if config is present
        self._init_client()

    def _load_usage(self) -> Dict[str, Any]:
        """Load usage stats from disk."""
        default_usage = {
            "month": time.strftime("%Y-%m"),
            "storage_bytes_approx": 0, # Note: This is hard to track perfectly due to deletions
            "requests_class_a": 0,
            "requests_class_b": 0
        }
        
        if not self._usage_file.exists():
            return default_usage
            
        try:
            with open(self._usage_file, 'r') as f:
                data = json.load(f)
                # Check if month changed
                if data.get("month") != time.strftime("%Y-%m"):
                    logger.info("New month detected. Resetting R2 usage stats.")
                    return default_usage
                return data
        except Exception as e:
            logger.error(f"Failed to load R2 usage: {e}")
            return default_usage

    def _save_usage(self):
        """Save usage stats to disk."""
        try:
            with open(self._usage_file, 'w') as f:
                json.dump(self._usage, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save R2 usage: {e}")

    def get_usage(self) -> Dict[str, Any]:
        """Get current usage stats."""
        return self._usage.copy()

    def _check_quota(self, class_a: int = 0, class_b: int = 0) -> bool:
        """Check if operation is within monthly limits."""
        with self._lock:
            if self._usage["requests_class_a"] + class_a >= settings.r2.monthly_limit_class_a:
                logger.warning("R2 Class A quota exceeded (Self-Imposed). Switching to fallback.")
                return False
            if self._usage["requests_class_b"] + class_b >= settings.r2.monthly_limit_class_b:
                logger.warning("R2 Class B quota exceeded (Self-Imposed). Switching to fallback.")
                return False
                
            # Storage Check Relaxation:
            # Since we delete files immediately after download, our *Average Storage* (which Cloudflare bills for)
            # is extremely low, even if we transfer TBs of data.
            # The 'storage_bytes_approx' metric is actually 'cumulative_ingress', which doesn't reflect cost.
            # Therefore, we DO NOT block based on this metric to allow high-throughput transient usage.
            # We only track it for informational purposes.
            return True

    def _increment_usage(self, class_a: int = 0, class_b: int = 0, bytes_added: int = 0):
        """Update usage stats."""
        with self._lock:
            self._usage["requests_class_a"] += class_a
            self._usage["requests_class_b"] += class_b
            self._usage["storage_bytes_approx"] += bytes_added
            # Prevent negative storage
            if self._usage["storage_bytes_approx"] < 0:
                self._usage["storage_bytes_approx"] = 0
        self._save_usage()

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
        """Check if R2 is configured and client is ready AND within quota."""
        if self._client is None:
            return False
        # Check quota (0 cost check)
        return self._check_quota()

    def acquire_upload_slot(self) -> bool:
        """Try to acquire an upload slot."""
        if not self._check_quota(class_a=1): # Upload assumes at least 1 Class A op forthcoming
            return False
            
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
        
        # Check quota. Presigning itself is local, but it enables an op.
        # Put = Class A, Get = Class B
        is_put = method == 'put_object'
        if not self._check_quota(class_a=1 if is_put else 0, class_b=0 if is_put else 1):
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
            # Optimistically increment usage for the URL generation
            # Note: We don't know if client actually uses it, but safer to over-count for 0 cost.
            self._increment_usage(class_a=1 if is_put else 0, class_b=0 if is_put else 1)
            
            return response
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {e}")
            return None

    def create_multipart_upload(self, object_name: str, content_type: str = 'application/octet-stream') -> Optional[Dict[str, Any]]:
        """Initiate a multipart upload."""
        if not self._client:
            return None
            
        if not self._check_quota(class_a=1):
            return None
        
        try:
            response = self._client.create_multipart_upload(
                Bucket=settings.r2.bucket_name,
                Key=object_name,
                ContentType=content_type
            )
            self._increment_usage(class_a=1)
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
            self._increment_usage(class_a=1) # Delete is Class A
            logger.info(f"Deleted file from R2: {object_name}")
        except ClientError as e:
            logger.error(f"Error deleting file from R2: {e}")

    def upload_file(self, local_path: Path, object_name: str) -> bool:
        """Upload a local file to R2 (for acceleration downloads)."""
        if not self._client:
            return False
            
        if not self._check_quota(class_a=1):
            return False

        try:
            file_size = os.path.getsize(local_path)
            self._client.upload_file(
                str(local_path),
                settings.r2.bucket_name,
                object_name
            )
            self._increment_usage(class_a=1, bytes_added=file_size)
            return True
        except ClientError as e:
            logger.error(f"Error uploading file to R2: {e}")
            return False

    def download_and_delete(self, object_name: str, local_path: Path) -> bool:
        """Download file from R2 to local and delete it immediately."""
        if not self._client:
            return False
            
        if not self._check_quota(class_b=1): # Download is Class B
             # Critical fallback: If we can't download because of quota, we are in trouble if we uploaded it.
             # But usually this method matches 'upload_file' -> 'download'.
             # If we are strictly 0 cost, we should block.
             # However, delete (Class A) is needed to clean up.
             # Let's allow download if it's cleanup? No, strict rules.
             logger.warning("Quota exceeded during download_and_delete. Attempting anyway to cleanup?")
             pass # We proceed for download/cleanup to avoid data loss/zombies? 
             # Actually, if we block download, the file stays in R2.
             # Strategy: Allow Class B overage slightly for cleanup? 
             # For now, strict check.
             return False

        try:
            logger.info(f"Downloading {object_name} from R2 to {local_path}...")
            self._client.download_file(
                settings.r2.bucket_name,
                object_name,
                str(local_path)
            )
            
            # Decrement storage usage (Transient Storage Logic)
            try:
                file_size = os.path.getsize(str(local_path))
                self._increment_usage(class_b=1, bytes_added=-file_size)
            except Exception:
                # Fallback if size check fails (shouldn't happen)
                self._increment_usage(class_b=1)

            logger.info(f"Download complete. Deleting R2 copy...")
            self.delete_file(object_name) # Internal increment check (Class A)
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
