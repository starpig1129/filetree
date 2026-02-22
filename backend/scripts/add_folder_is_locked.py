"""Migration: add is_locked column to folders table.

Adds the `is_locked` column to the existing `folders` table
in users.db. Safe to re-run (ignores if column already exists).
"""

import sqlite3
import sys
from pathlib import Path

# Resolve project root → data/users.db
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = PROJECT_ROOT / "data" / "users.db"


def migrate() -> None:
    """Add is_locked column to folders table if missing."""
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}, skipping migration.")
        sys.exit(0)

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(folders)")
    columns = [row[1] for row in cursor.fetchall()]

    if "is_locked" in columns:
        print("Column 'is_locked' already exists in folders table. Nothing to do.")
        conn.close()
        return

    cursor.execute(
        "ALTER TABLE folders ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0"
    )
    conn.commit()
    conn.close()
    print("Successfully added 'is_locked' column to folders table.")


if __name__ == "__main__":
    migrate()
