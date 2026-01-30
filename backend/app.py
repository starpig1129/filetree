"""
Main FastAPI entry point for the FileNexus application.
"""

import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.routes.api import router as api_router

app = FastAPI(
    title="FileNexus API",
    description="High-performance file management backend with FastAPI",
    version="2.1.0"
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)

# Serve the React build (SPA)
# 1. First, try to serve specific files from static/dist
# 2. If no file matches, serve index.html (SPA routing)

# Check if static dir exists
static_path = settings.paths.static_dir
if not static_path.exists():
    print(f"Warning: Static directory {static_path} not found. Build the frontend first.")

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
    index_path = static_path / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    
    return {"detail": "Not Found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=settings.server.debug
    )
