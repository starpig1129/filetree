#!/usr/bin/env python3
"""
Migration script: user_info.json → 3 SQLite databases.

Reads the legacy user_info.json and populates:
  - data/users.db  (users + folders)
  - data/notes.db  (url/note records)
  - data/files.db  (file index from existing disk scan)

Usage:
    conda activate stellarnexus
    python -m backend.scripts.migrate_json_to_sqlite
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Ensure the project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings
from backend.services.database import (
    init_db,
    close_all,
    get_users_db,
    get_notes_db,
    get_files_db,
)


async def migrate() -> None:
    """Run the full migration from JSON to SQLite."""
    json_path = settings.paths.user_info_file
    if not json_path.exists():
        print(f"[ERROR] user_info.json not found at {json_path}")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        users_data = json.load(f)

    if not isinstance(users_data, list):
        print("[ERROR] Expected a JSON array of user objects.")
        sys.exit(1)

    print(f"[INFO] Found {len(users_data)} users in {json_path}")

    # 1. Initialize schemas
    await init_db()
    print("[INFO] Database schemas initialized.")

    users_db = await get_users_db()
    notes_db = await get_notes_db()
    files_db = await get_files_db()

    user_count = 0
    folder_count = 0
    url_count = 0
    file_count = 0

    for user_data in users_data:
        username = user_data.get("username", "")
        if not username:
            print(f"  [WARN] Skipping user with empty username.")
            continue

        # --- users.db: Insert user ---
        cursor = await users_db.execute(
            """INSERT OR IGNORE INTO users
               (username, folder, salt, hashed_password,
                is_locked, first_login, data_retention_days, show_in_list)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                username,
                user_data.get("folder", username),
                user_data.get("salt", ""),
                user_data.get("hashed_password", ""),
                int(user_data.get("is_locked", False)),
                int(user_data.get("first_login", True)),
                user_data.get("data_retention_days"),
                int(user_data.get("show_in_list", True)),
            ),
        )
        user_id = cursor.lastrowid
        user_count += 1
        print(f"  [USER] {username} (id={user_id})")

        # --- users.db: Insert folders ---
        folders = user_data.get("folders", [])
        for folder in folders:
            fid = folder.get("id", "")
            fname = folder.get("name", "")
            ftype = folder.get("type", "file")
            parent_id = folder.get("parent_id")
            if not fid or not fname:
                continue
            await users_db.execute(
                "INSERT OR IGNORE INTO folders (id, user_id, name, type, parent_id) "
                "VALUES (?, ?, ?, ?, ?)",
                (fid, user_id, fname, ftype, parent_id),
            )
            folder_count += 1

        # --- notes.db: Insert URLs ---
        urls = user_data.get("urls", [])
        for url_rec in urls:
            url_str = url_rec.get("url", "")
            if not url_str:
                continue
            created = url_rec.get("created", datetime.now().isoformat())
            is_locked = int(url_rec.get("is_locked", False))
            folder_id = url_rec.get("folder_id")
            await notes_db.execute(
                "INSERT INTO urls (username, url, created, is_locked, folder_id) "
                "VALUES (?, ?, ?, ?, ?)",
                (username, url_str, created, is_locked, folder_id),
            )
            url_count += 1

        # --- files.db: Scan user directory and populate index ---
        user_folder = user_data.get("folder", username)
        user_dir = settings.paths.upload_folder / user_folder
        file_metadata = user_data.get("file_metadata", {})
        locked_files = user_data.get("locked_files", [])

        if user_dir.exists() and user_dir.is_dir():
            for root, _dirs, filenames in os.walk(user_dir):
                for filename in filenames:
                    filepath = Path(root) / filename
                    try:
                        stat = filepath.stat()
                    except OSError:
                        continue

                    # Determine folder_id from old file_metadata
                    fid = file_metadata.get(filename, {}).get("folder_id")
                    is_locked = int(filename in locked_files)

                    await files_db.execute(
                        "INSERT OR IGNORE INTO files "
                        "(username, filename, folder_id, size_bytes, created_at, is_locked) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        (
                            user_folder,
                            filename,
                            fid,
                            stat.st_size,
                            datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            is_locked,
                        ),
                    )
                    file_count += 1

    await users_db.commit()
    await notes_db.commit()
    await files_db.commit()

    print(f"\n[DONE] Migration complete:")
    print(f"  Users:   {user_count}")
    print(f"  Folders: {folder_count}")
    print(f"  URLs:    {url_count}")
    print(f"  Files:   {file_count}")

    await close_all()


if __name__ == "__main__":
    asyncio.run(migrate())
