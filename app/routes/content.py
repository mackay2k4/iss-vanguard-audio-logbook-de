"""Content routes: protocol index and full protocol detail."""
from fastapi import APIRouter, Depends, HTTPException
from app import content, auth as auth_module

router = APIRouter()


@router.get("/api/content")
async def get_content_index(user: dict = Depends(auth_module.require_user)):
    """Return lightweight protocol index (id, number, variant, order, title, hasAudio)."""
    return content.get_all_protocols()


@router.get("/api/content/protocol/{protocol_id}")
async def get_protocol(protocol_id: str, user: dict = Depends(auth_module.require_user)):
    """Return full protocol object by id, or 404 if not found."""
    protocol = content.get_protocol_by_id(protocol_id)
    if protocol is None:
        raise HTTPException(status_code=404, detail="protocol not found")
    return protocol
