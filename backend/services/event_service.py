from typing import Dict, List
from fastapi import WebSocket

class EventService:
    """Service for managing WebSocket connections and broadcasting updates."""

    def __init__(self):
        # dictionary mapping username -> list of active websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, username: str, websocket: WebSocket):
        """Accept a connection and track it for a specific user."""
        await websocket.accept()
        if username not in self.active_connections:
            self.active_connections[username] = []
        self.active_connections[username].append(websocket)

    def disconnect(self, username: str, websocket: WebSocket):
        """Remove a tracking connection."""
        if username in self.active_connections:
            if websocket in self.active_connections[username]:
                self.active_connections[username].remove(websocket)
            if not self.active_connections[username]:
                del self.active_connections[username]

    async def notify_user_update(self, username: str):
        """Broadcast an update signal to all active sessions of a user."""
        if username in self.active_connections:
            # We send a "ping" or "refresh" message
            # The client should treat any message as a signal to re-fetch data
            dead_connections = []
            for connection in self.active_connections[username]:
                try:
                    await connection.send_text("REFRESH")
                except Exception:
                    dead_connections.append(connection)
            
            # Cleanup dead connections
            for dead in dead_connections:
                self.disconnect(username, dead)
