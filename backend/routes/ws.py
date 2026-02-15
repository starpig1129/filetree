from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.event_service import event_service
from backend.services.user_service import user_service
from backend.core.utils import get_client_ip

router = APIRouter()

@router.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    """WebSocket bridge for real-time state synchronization."""
    # Authenticate or at least verify user exists?
    # Current implementation in api.py didn't seem to check password here, 
    # relying on the fact that if you know the username you can connect.
    # Ideally should include token query param.
    # For now, keeping original logic parity.
    
    # Check if user exists
    user = await user_service.get_user_by_name(username)
    if not user:
        await websocket.close(code=1008)
        return

    await event_service.connect(username, websocket)
    try:
        while True:
            # Keep connection alive, we don't expect messages from client for now
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_service.disconnect(username, websocket)
    except Exception:
        event_service.disconnect(username, websocket)



