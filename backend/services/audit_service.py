import json
import os
import asyncio
import aiofiles
import logging
from datetime import datetime
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class AuditService:
    """Service for logging and retrieving system audit events."""

    def __init__(self, log_path: str):
        self.log_path = log_path
        # Ensure data directory exists
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        self._lock = asyncio.Lock()

    async def _read_logs(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.log_path):
            return []
        try:
            async with aiofiles.open(self.log_path, mode='r', encoding='utf-8') as f:
                content = await f.read()
                return json.loads(content) if content else []
        except Exception as e:
            logger.error(f"Error reading audit logs: {e}")
            return []

    async def _write_logs(self, logs: List[Dict[str, Any]]):
        temp_path = f"{self.log_path}.{os.getpid()}.{asyncio.get_running_loop().time()}.tmp"
        try:
            async with aiofiles.open(temp_path, mode='w', encoding='utf-8') as f:
                await f.write(json.dumps(logs, indent=2, ensure_ascii=False))
            
            # Windows atomic replace retry loop
            retries = 3
            for i in range(retries):
                try:
                    if os.path.exists(self.log_path):
                        os.replace(temp_path, self.log_path)
                    else:
                        os.rename(temp_path, self.log_path)
                    break
                except PermissionError as e:
                    if i == retries - 1:
                        raise e
                    await asyncio.sleep(0.1 * (i + 1))
        except Exception as e:
            logger.error(f"Error writing audit logs: {e}")
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except:
                    pass
            raise

    async def log_event(self, username: str, action: str, details: str, level: str = "INFO", ip: str = None):
        """Record a new audit event.
        
        Args:
            username: User performining the action (or "system"/"admin").
            action: The action name (e.g., "LOGIN_SUCCESS", "FILE_DELETE").
            details: Human readable details.
            level: INFO, WARNING, ERROR.
            ip: Source IP address.
        """
        event = {
            "timestamp": datetime.now().isoformat(),
            "username": username,
            "action": action,
            "details": details,
            "level": level,
            "ip": ip
        }
        
        async with self._lock:
            try:
                logs = await self._read_logs()
                logs.insert(0, event)  # Newest first
                # Limit to last 1000 logs to prevent file bloating
                await self._write_logs(logs[:1000])
            except Exception as e:
                logger.error(f"Failed to log event: {e}")

    async def get_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve recent audit logs."""
        async with self._lock:
            logs = await self._read_logs()
            return logs[:limit]
