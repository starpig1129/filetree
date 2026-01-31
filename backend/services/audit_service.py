import json
import os
import aiofiles
from datetime import datetime
from typing import List, Dict, Any

class AuditService:
    """Service for logging and retrieving system audit events."""

    def __init__(self, log_path: str):
        self.log_path = log_path
        # Ensure data directory exists
        os.makedirs(os.path.dirname(log_path), exist_ok=True)

    async def _read_logs(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.log_path):
            return []
        try:
            async with aiofiles.open(self.log_path, mode='r') as f:
                content = await f.read()
                return json.loads(content) if content else []
        except Exception:
            return []

    async def _write_logs(self, logs: List[Dict[str, Any]]):
        async with aiofiles.open(self.log_path, mode='w') as f:
            await f.write(json.dumps(logs, indent=2, ensure_ascii=False))

    async def log_event(self, username: str, action: str, details: str, level: str = "INFO"):
        """Record a new audit event.
        
        Args:
            username: User performining the action (or "system"/"admin").
            action: The action name (e.g., "LOGIN_SUCCESS", "FILE_DELETE").
            details: Human readable details.
            level: INFO, WARNING, ERROR.
        """
        logs = await self._read_logs()
        event = {
            "timestamp": datetime.now().isoformat(),
            "username": username,
            "action": action,
            "details": details,
            "level": level
        }
        logs.insert(0, event)  # Newest first
        # Limit to last 1000 logs to prevent file bloating
        await self._write_logs(logs[:1000])

    async def get_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve recent audit logs."""
        logs = await self._read_logs()
        return logs[:limit]
