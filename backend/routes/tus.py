"""
TUS Protocol Endpoints for Resumable Uploads

Implements TUS 1.0.0 protocol with R2 Multipart backend.
Enables refresh-resume while maintaining R2's parallel upload speed.
"""

from fastapi import APIRouter, Request, Response, HTTPException, Header
from typing import Optional
import uuid
import base64
import logging

from backend.services.user_service import user_service
from backend.services.r2_service import r2_service
from backend.services.tus_metadata_store import TusMetadataStore
from backend.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# TUS Protocol Constants
TUS_VERSION = "1.0.0"
CHUNK_SIZE = 5 * 1024 * 1024  # 5MB chunks (aligned with R2 Multipart)

# Initialize metadata store
metadata_store = TusMetadataStore()


def parse_tus_metadata(metadata_header: Optional[str]) -> dict:
    """Parse TUS Upload-Metadata header (Base64-encoded key-value pairs)."""
    if not metadata_header:
        return {}
    
    result = {}
    for pair in metadata_header.split(','):
        pair = pair.strip()
        if ' ' not in pair:
            continue
        key, value = pair.split(' ', 1)
        try:
            decoded = base64.b64decode(value).decode('utf-8')
            result[key] = decoded
        except Exception as e:
            logger.warning(f"Failed to decode metadata {key}: {e}")
    
    return result


def calculate_fingerprint(filename: str, size: int, modified: Optional[str] = None) -> str:
    """Calculate file fingerprint for resume detection (matches Uppy's logic)."""
    parts = [filename, str(size)]
    if modified:
        parts.append(modified)
    return '-'.join(parts)


@router.post("/upload/tus")
async def create_tus_upload(
    request: Request,
    upload_length: int = Header(..., alias="Upload-Length"),
    upload_metadata: Optional[str] = Header(None, alias="Upload-Metadata"),
    tus_resumable: str = Header(TUS_VERSION, alias="Tus-Resumable")
):
    """TUS POST - Create new upload or return existing one for resume."""
    # Parse metadata
    metadata = parse_tus_metadata(upload_metadata)
    filename = metadata.get('filename', 'unnamed')
    content_type = metadata.get('filetype', 'application/octet-stream')
    password = metadata.get('password')
    
    # Authenticate
    if not password:
        raise HTTPException(status_code=401, detail="Missing password in metadata")
    
    user = await user_service.get_user_by_password(password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Calculate fingerprint
    fingerprint = calculate_fingerprint(filename, upload_length, metadata.get('lastModified'))
    logger.info(f"TUS Create: fingerprint={fingerprint}, size={upload_length}, user={user.username}")
    
    # Check for existing upload (resume)
    existing = metadata_store.get_upload_by_fingerprint(fingerprint, user.id)
    
    if existing and existing['status'] == 'active':
        logger.info(f"TUS Resume: Found existing upload {existing['id']}, offset={existing['offset']}")
        return Response(
            status_code=200,
            headers={
                "Location": f"/api/upload/tus/{existing['id']}",
                "Tus-Resumable": TUS_VERSION,
                "Upload-Offset": str(existing['offset'])
            }
        )
    
    # Create new upload
    upload_id = str(uuid.uuid4())
    object_key = f"temp/{user.username}/{filename}"
    
    r2_result = r2_service.create_multipart_upload(object_key, content_type)
    if not r2_result:
        raise HTTPException(status_code=500, detail="Failed to initialize R2 upload")
    
    metadata_store.create_upload(
        upload_id=upload_id,
        fingerprint=fingerprint,
        user_id=user.id,
        r2_upload_id=r2_result['UploadId'],
        r2_key=r2_result['Key'],
        size=upload_length,
        filename=filename,
        content_type=content_type,
        metadata=metadata
    )
    
    logger.info(f"TUS Created: upload_id={upload_id}, r2_upload_id={r2_result['UploadId']}")
    
    return Response(
        status_code=201,
        headers={
            "Location": f"/api/upload/tus/{upload_id}",
            "Tus-Resumable": TUS_VERSION,
            "Upload-Offset": "0"
        }
    )


@router.head("/upload/tus/{upload_id}")
async def get_tus_upload_offset(
    upload_id: str,
    tus_resumable: str = Header(TUS_VERSION, alias="Tus-Resumable")
):
    """TUS HEAD - Get current upload offset."""
    upload = metadata_store.get_upload(upload_id)
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return Response(
        status_code=200,
        headers={
            "Tus-Resumable": TUS_VERSION,
            "Upload-Offset": str(upload['offset']),
            "Upload-Length": str(upload['size']),
            "Cache-Control": "no-store"
        }
    )


@router.patch("/upload/tus/{upload_id}")
async def upload_tus_chunk(
    upload_id: str,
    request: Request,
    upload_offset: int = Header(..., alias="Upload-Offset"),
    content_length: int = Header(..., alias="Content-Length"),
    tus_resumable: str = Header(TUS_VERSION, alias="Tus-Resumable")
):
    """TUS PATCH - Upload a chunk of data."""
    upload = metadata_store.get_upload(upload_id)
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    # Verify offset
    if upload['offset'] != upload_offset:
        raise HTTPException(
            status_code=409,
            detail=f"Offset mismatch: expected {upload['offset']}, got {upload_offset}"
        )
    
    # Read chunk
    chunk_data = await request.body()
    if len(chunk_data) != content_length:
        raise HTTPException(
            status_code=400,
            detail=f"Content-Length mismatch: expected {content_length}, got {len(chunk_data)}"
        )
    
    # Upload to R2
    part_number = (upload_offset // CHUNK_SIZE) + 1
    logger.info(f"TUS Upload: upload_id={upload_id}, part={part_number}, offset={upload_offset}")
    
    part_result = r2_service.upload_part_direct(
        upload_id=upload['r2_upload_id'],
        key=upload['r2_key'],
        part_number=part_number,
        data=chunk_data
    )
    
    if not part_result:
        raise HTTPException(status_code=500, detail="Failed to upload part to R2")
    
    # Update metadata
    new_offset = upload_offset + len(chunk_data)
    current_parts = upload.get('parts', [])
    current_parts.append(part_result)
    metadata_store.update_offset(upload_id, new_offset, current_parts)
    
    # Complete if done
    if new_offset >= upload['size']:
        logger.info(f"TUS Complete: upload_id={upload_id}")
        complete_result = r2_service.complete_multipart_upload(
            upload['r2_upload_id'],
            upload['r2_key'],
            current_parts
        )
        
        if complete_result:
            metadata_store.mark_completed(upload_id)
        else:
            raise HTTPException(status_code=500, detail="Failed to complete R2 upload")
    
    return Response(
        status_code=204,
        headers={
            "Tus-Resumable": TUS_VERSION,
            "Upload-Offset": str(new_offset)
        }
    )


@router.delete("/upload/tus/{upload_id}")
async def cancel_tus_upload(
    upload_id: str,
    tus_resumable: str = Header(TUS_VERSION, alias="Tus-Resumable")
):
    """TUS DELETE - Cancel upload and clean up."""
    upload = metadata_store.get_upload(upload_id)
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    logger.info(f"TUS Delete: upload_id={upload_id}")
    
    # Abort R2 upload
    try:
        r2_service._client.abort_multipart_upload(
            Bucket=settings.r2.bucket_name,
            Key=upload['r2_key'],
            UploadId=upload['r2_upload_id']
        )
    except Exception as e:
        logger.warning(f"Failed to abort R2 upload: {e}")
    
    metadata_store.mark_aborted(upload_id)
    
    return Response(
        status_code=204,
        headers={"Tus-Resumable": TUS_VERSION}
    )


@router.options("/upload/tus")
@router.options("/upload/tus/{upload_id}")
async def tus_options(request: Request):
    """TUS OPTIONS - Advertise server capabilities."""
    return Response(
        status_code=204,
        headers={
            "Tus-Resumable": TUS_VERSION,
            "Tus-Version": TUS_VERSION,
            "Tus-Extension": "creation,termination",
            "Tus-Max-Size": str(10 * 1024 * 1024 * 1024),  # 10GB
        }
    )
