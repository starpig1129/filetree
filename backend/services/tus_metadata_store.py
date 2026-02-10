"""
TUS Upload Metadata Store

Manages persistent storage of TUS upload metadata to enable resume functionality.
Uses SQLite for simplicity and reliability.
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)


class TusMetadataStore:
    """
    Stores TUS upload metadata including fingerprints, offsets, and R2 upload IDs.
    
    This enables refresh-resume by mapping file fingerprints to existing uploads.
    """
    
    def __init__(self, db_path: str = "data/tus_metadata.db"):
        """
        Initialize the metadata store.
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        """Initialize database schema."""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS tus_uploads (
                    id TEXT PRIMARY KEY,
                    fingerprint TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    r2_upload_id TEXT NOT NULL,
                    r2_key TEXT NOT NULL,
                    offset INTEGER NOT NULL DEFAULT 0,
                    size INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    content_type TEXT,
                    metadata TEXT,
                    parts TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL,
                    UNIQUE(fingerprint, user_id)
                )
            """)
            
            # Index for fast fingerprint lookup
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_fingerprint_user 
                ON tus_uploads(fingerprint, user_id)
            """)
            
            # Index for cleanup of old uploads
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_created_at 
                ON tus_uploads(created_at)
            """)
            
            conn.commit()
    
    @contextmanager
    def _get_connection(self):
        """Get database connection with context manager."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def create_upload(
        self,
        upload_id: str,
        fingerprint: str,
        user_id: int,
        r2_upload_id: str,
        r2_key: str,
        size: int,
        filename: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new upload record.
        
        Args:
            upload_id: TUS upload ID
            fingerprint: File fingerprint for resume detection
            user_id: User ID
            r2_upload_id: R2 multipart upload ID
            r2_key: R2 object key
            size: Total file size
            filename: Original filename
            content_type: MIME type
            metadata: Additional metadata
        
        Returns:
            Created upload record
        """
        now = datetime.utcnow()
        
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO tus_uploads (
                    id, fingerprint, user_id, r2_upload_id, r2_key,
                    offset, size, filename, content_type, metadata,
                    parts, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                upload_id,
                fingerprint,
                user_id,
                r2_upload_id,
                r2_key,
                0,  # initial offset
                size,
                filename,
                content_type,
                json.dumps(metadata or {}),
                json.dumps([]),  # empty parts list
                'active',
                now,
                now
            ))
            conn.commit()
        
        return self.get_upload(upload_id)
    
    def get_upload(self, upload_id: str) -> Optional[Dict[str, Any]]:
        """
        Get upload record by ID.
        
        Args:
            upload_id: TUS upload ID
        
        Returns:
            Upload record or None if not found
        """
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM tus_uploads WHERE id = ?",
                (upload_id,)
            ).fetchone()
            
            if not row:
                return None
            
            return self._row_to_dict(row)
    
    def get_upload_by_fingerprint(
        self,
        fingerprint: str,
        user_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get active upload by fingerprint and user.
        
        This enables resume after page refresh.
        
        Args:
            fingerprint: File fingerprint
            user_id: User ID
        
        Returns:
            Upload record or None if not found
        """
        with self._get_connection() as conn:
            row = conn.execute("""
                SELECT * FROM tus_uploads 
                WHERE fingerprint = ? AND user_id = ? AND status = 'active'
                ORDER BY created_at DESC
                LIMIT 1
            """, (fingerprint, user_id)).fetchone()
            
            if not row:
                return None
            
            return self._row_to_dict(row)
    
    def update_offset(
        self,
        upload_id: str,
        offset: int,
        parts: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        Update upload offset and parts.
        
        Args:
            upload_id: TUS upload ID
            offset: New offset (bytes uploaded)
            parts: Updated parts list
        
        Returns:
            True if updated, False if not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute("""
                UPDATE tus_uploads 
                SET offset = ?, parts = ?, updated_at = ?
                WHERE id = ?
            """, (
                offset,
                json.dumps(parts) if parts is not None else None,
                datetime.utcnow(),
                upload_id
            ))
            conn.commit()
            return cursor.rowcount > 0
    
    def mark_completed(self, upload_id: str) -> bool:
        """
        Mark upload as completed.
        
        Args:
            upload_id: TUS upload ID
        
        Returns:
            True if updated, False if not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute("""
                UPDATE tus_uploads 
                SET status = 'completed', updated_at = ?
                WHERE id = ?
            """, (datetime.utcnow(), upload_id))
            conn.commit()
            return cursor.rowcount > 0
    
    def mark_aborted(self, upload_id: str) -> bool:
        """
        Mark upload as aborted.
        
        Args:
            upload_id: TUS upload ID
        
        Returns:
            True if updated, False if not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute("""
                UPDATE tus_uploads 
                SET status = 'aborted', updated_at = ?
                WHERE id = ?
            """, (datetime.utcnow(), upload_id))
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_upload(self, upload_id: str) -> bool:
        """
        Delete upload record.
        
        Args:
            upload_id: TUS upload ID
        
        Returns:
            True if deleted, False if not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM tus_uploads WHERE id = ?",
                (upload_id,)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    def cleanup_old_uploads(self, days: int = 7) -> int:
        """
        Clean up old completed/aborted uploads.
        
        Args:
            days: Delete uploads older than this many days
        
        Returns:
            Number of deleted records
        """
        cutoff = datetime.utcnow().timestamp() - (days * 24 * 3600)
        
        with self._get_connection() as conn:
            cursor = conn.execute("""
                DELETE FROM tus_uploads 
                WHERE status IN ('completed', 'aborted') 
                AND created_at < datetime(?, 'unixepoch')
            """, (cutoff,))
            conn.commit()
            return cursor.rowcount
    
    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert SQLite row to dictionary."""
        return {
            'id': row['id'],
            'fingerprint': row['fingerprint'],
            'user_id': row['user_id'],
            'r2_upload_id': row['r2_upload_id'],
            'r2_key': row['r2_key'],
            'offset': row['offset'],
            'size': row['size'],
            'filename': row['filename'],
            'content_type': row['content_type'],
            'metadata': json.loads(row['metadata']) if row['metadata'] else {},
            'parts': json.loads(row['parts']) if row['parts'] else [],
            'status': row['status'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        }
