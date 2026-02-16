"""
Note/URL management service backed by SQLite (notes.db).

Handles all URL/note record operations independently from user service.
"""

from datetime import datetime
from typing import List, Optional, Set

from backend.services.database import get_notes_db


class NoteService:
    """Service for note/URL operations backed by notes.db."""

    async def add_url(
        self,
        username: str,
        url: str,
        folder_id: Optional[str] = None,
    ) -> int:
        """Add a URL record for a user.

        Args:
            username: The username.
            url: The URL string.
            folder_id: Optional folder to place the URL in.

        Returns:
            The inserted row ID.
        """
        db = await get_notes_db()
        cursor = await db.execute(
            "INSERT INTO urls (username, url, created, is_locked, folder_id) "
            "VALUES (?, ?, ?, 0, ?)",
            (username, url, datetime.now().isoformat(), folder_id),
        )
        await db.commit()
        return cursor.lastrowid

    async def get_urls(
        self, username: str, excluded_folder_ids: Optional[Set[str]] = None
    ) -> List[dict]:
        """Fetch all URL records for a user.

        Args:
            username: The username.
            excluded_folder_ids: Optional set of folder IDs to exclude.

        Returns:
            List of URL record dicts.
        """
        db = await get_notes_db()
        cursor = await db.execute(
            "SELECT * FROM urls WHERE username = ? ORDER BY created DESC",
            (username,),
        )
        rows = await cursor.fetchall()
        result = []
        for row in rows:
            d = dict(row)
            if excluded_folder_ids and d["folder_id"] in excluded_folder_ids:
                continue
            d["is_locked"] = bool(d["is_locked"])
            result.append(d)
        return result

    async def delete_url(self, username: str, url: str) -> bool:
        """Delete a URL record.

        Args:
            username: The username.
            url: The URL string to delete.

        Returns:
            True if deleted, False if not found.
        """
        db = await get_notes_db()
        cursor = await db.execute(
            "DELETE FROM urls WHERE username = ? AND url = ?",
            (username, url),
        )
        await db.commit()
        return cursor.rowcount > 0

    async def move_url(
        self, username: str, url: str, folder_id: Optional[str]
    ) -> bool:
        """Move a URL to a different folder.

        Args:
            username: The username.
            url: The URL string.
            folder_id: Target folder ID or None for root.

        Returns:
            True if moved, False if not found.
        """
        db = await get_notes_db()
        cursor = await db.execute(
            "UPDATE urls SET folder_id = ? WHERE username = ? AND url = ?",
            (folder_id, username, url),
        )
        await db.commit()
        return cursor.rowcount > 0

    async def toggle_url_lock(
        self, username: str, url: str, is_locked: bool
    ) -> bool:
        """Toggle lock status for a URL.

        Args:
            username: The username.
            url: The URL string.
            is_locked: New lock status.

        Returns:
            True if updated, False if not found.
        """
        db = await get_notes_db()
        cursor = await db.execute(
            "UPDATE urls SET is_locked = ? WHERE username = ? AND url = ?",
            (int(is_locked), username, url),
        )
        await db.commit()
        return cursor.rowcount > 0

    async def batch_delete_urls(self, username: str, urls: List[str]) -> int:
        """Delete multiple URL records.

        Args:
            username: The username.
            urls: List of URL strings to delete.

        Returns:
            Number of deleted records.
        """
        if not urls:
            return 0
        db = await get_notes_db()
        count = 0
        for url in urls:
            cursor = await db.execute(
                "DELETE FROM urls WHERE username = ? AND url = ? AND is_locked = 0",
                (username, url),
            )
            count += cursor.rowcount
        await db.commit()
        return count

    async def batch_lock_urls(
        self, username: str, urls: List[str], is_locked: bool
    ) -> int:
        """Lock or unlock multiple URL records.

        Args:
            username: The username.
            urls: List of URL strings.
            is_locked: New lock status.

        Returns:
            Number of updated records.
        """
        if not urls:
            return 0
        db = await get_notes_db()
        count = 0
        for url in urls:
            cursor = await db.execute(
                "UPDATE urls SET is_locked = ? WHERE username = ? AND url = ?",
                (int(is_locked), username, url),
            )
            count += cursor.rowcount
        await db.commit()
        return count

    async def delete_all_for_user(self, username: str) -> int:
        """Delete all URL records for a user (used when deleting user).

        Args:
            username: The username.

        Returns:
            Number of deleted records.
        """
        db = await get_notes_db()
        cursor = await db.execute(
            "DELETE FROM urls WHERE username = ?", (username,)
        )
        await db.commit()
        return cursor.rowcount


# Singleton instance
note_service = NoteService()
