"""
Pydantic schemas for data validation and serialization.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, HttpUrl


class URLRecord(BaseModel):
    """Schema for a URL record."""
    url: str
    created: datetime
    is_locked: bool = False


class UserBase(BaseModel):
    """Base user schema."""
    username: str
    folder: str
    is_locked: bool = False
    first_login: bool = True


class UserCreate(UserBase):
    """Schema for creating a user (internal use)."""
    salt: str
    hashed_password: str
    urls: List[URLRecord] = []
    locked_files: List[str] = []


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    is_locked: Optional[bool] = None
    first_login: Optional[bool] = None


class UserPublic(UserBase):
    """Public user info (safe to send to client)."""
    urls: List[URLRecord] = []


class FileInfo(BaseModel):
    """Schema for file information."""
    name: str
    size: float
    size_bytes: int
    created: str
    remaining_days: int
    remaining_hours: int
    remaining_minutes: int
    expired: bool
    is_locked: bool = False


class UnlockRequest(BaseModel):
    """Schema for unlock request."""
    password: str


class ToggleLockRequest(BaseModel):
    """Schema for toggling lock on an item."""
    password: str
    item_type: str  # 'file' or 'url'
    item_id: str    # filename or url
    is_locked: bool
