"""
Main FastAPI entry point for the FileNexus application.
"""

import os
import sys
import asyncio
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.routes.api import router as api_router
from backend.routes.tus import router as tus_router
from backend.routes.tus import cleanup_expired_uploads
from contextlib import asynccontextmanager
from starlette.concurrency import run_in_threadpool
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize databases
    from backend.services.database import init_db, close_all
    from backend.services.file_service import file_service
    logger.info("Startup: Initializing databases...")
    await init_db()

    # Startup: Reconcile disk ↔ DB
    logger.info("Startup: Reconciling file index...")
    stats = await file_service.reconcile_all_users()
    logger.info(f"Reconciliation: {stats}")

    # Startup: Run cleanup immediately
    try:
        logger.info("Startup: Running stale upload cleanup...")
        await run_in_threadpool(cleanup_expired_uploads)
    except Exception as e:
        logger.error(f"Startup cleanup failed: {e}")

    # Start periodic background task
    async def periodic_cleanup():
        while True:
            await asyncio.sleep(36000)  # Run every 10 hour
            try:
                logger.info("Periodic: Running stale upload cleanup...")
                await run_in_threadpool(cleanup_expired_uploads)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Periodic cleanup failed: {e}")

    cleanup_task = asyncio.create_task(periodic_cleanup())
    
    yield
    
    # Shutdown: Cancel cleanup task
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    # Shutdown: Close database connections
    await close_all()


def suppress_connection_reset_error(loop, context):
    """Custom exception handler to suppress ConnectionResetError on Windows."""
    exception = context.get("exception")
    if isinstance(exception, ConnectionResetError):
        # Silently ignore ConnectionResetError (WinError 10054)
        return
    # For all other exceptions, use the default handler
    loop.default_exception_handler(context)


from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from backend.core.rate_limit import limiter


app = FastAPI(
    title="FileNexus API",
    description="High-performance file management backend with FastAPI",
    version="2.2.0",
    lifespan=lifespan
)

# Set up Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Tus-Resumable", 
        "Tus-Version", 
        "Tus-Extension", 
        "Tus-Max-Size", 
        "Upload-Offset", 
        "Upload-Length", 
        "Upload-Metadata", 
        "Location",
        "Content-Length"
    ]
)

# Include API routes
# TUS router MUST be registered FIRST to prevent conflicts with old TUS endpoints in api.py
app.include_router(tus_router)  # TUS resumable upload endpoints (NEW)
app.include_router(api_router)  # Legacy routes (contains old TUS endpoints - commented out)

# Serve the React build (SPA)
# 1. First, try to serve specific files from static/dist
# 2. If no file matches, serve index.html (SPA routing)

# Check if static dir exists
static_path = settings.paths.static_dir
if not static_path.exists():
    print(f"Warning: Static directory {static_path} not found. Build the frontend first.")

# WebSocket endpoint for global events - defined directly on app to bypass router issues
from fastapi import WebSocket, WebSocketDisconnect
from backend.services.event_service import event_service

@app.websocket("/ws/global")
async def global_websocket_endpoint(websocket: WebSocket):
    """Global WebSocket for system-wide updates (e.g. user list)."""
    await event_service.connect_global(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_service.disconnect_global(websocket)
    except Exception:
        event_service.disconnect_global(websocket)

@app.get("/{path:path}")
async def serve_spa(request: Request, path: str):
    """Serve the SPA or static assets."""
    # Special case for /uploads which should be handled by a specific route or StaticFiles
    if path.startswith("uploads/"):
        # We'll implement a proper download route later if needed
        pass

    # Try to see if the file exists in static_dir
    file_path = static_path / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    
    # Otherwise, return index.html for SPA routing
    # IMPORTANT: no-cache for index.html to prevent stale JS bundle references
    index_path = static_path / "index.html"
    if index_path.exists():
        return FileResponse(
            index_path,
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    
    return {"detail": "Not Found"}

if __name__ == "__main__":
    import uvicorn
    
    # Suppress ConnectionResetError on Windows
    loop = asyncio.new_event_loop()
    loop.set_exception_handler(suppress_connection_reset_error)
    asyncio.set_event_loop(loop)
    
    uvicorn.run(
        "backend.app:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=settings.server.debug,
        timeout_graceful_shutdown=0,  # Force immediate shutdown
        timeout_keep_alive=60  # Enable keep-alive for TUS
    )
