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
    data_retention_days: Optional[int] = None
    show_in_list: bool = True


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
    data_retention_days: Optional[int] = None
    show_in_list: Optional[bool] = None


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

class BatchActionRequest(BaseModel):
    """Schema for batch operations on files/urls."""
    password: str
    item_type: str  # 'file' or 'url'
    item_ids: List[str]
    action: str  # 'lock', 'unlock', 'delete'

class RenameFileRequest(BaseModel):
    """Schema for renaming a file."""
    password: str
    old_name: str
    new_name: str

class SystemConfig(BaseModel):
    """Public system configuration."""
    allowed_extensions: Optional[List[str]] = None
    r2_enabled: bool = False

class InitResponse(BaseModel):
    """Response for initial data load."""
    users: List[UserPublic]
    config: SystemConfig

class UploadInitRequest(BaseModel):
    filename: str
    file_size: int
    password: str

class UploadInitResponse(BaseModel):
    strategy: str  # "tus" or "r2"
    tus_endpoint: Optional[str] = None
    

