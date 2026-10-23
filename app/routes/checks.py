"""Checklist state routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app import db, auth as auth_module, content

router = APIRouter()


class CheckRequest(BaseModel):
    checked: bool


@router.get("/api/savegames/{savegame_id}/checks")
async def get_checks(savegame_id: int, user: dict = Depends(auth_module.require_user)):
    """Return {item_id: True} for all checked items in the savegame.

    Stale item_ids (no longer in the content model) are silently ignored (Req 6.4).
    Returns 404 if savegame not owned by the authenticated user.
    """
    sg = await db.get_savegame_by_id(savegame_id, user["id"])
    if not sg:
        raise HTTPException(status_code=404, detail="savegame not found")

    checks = await db.get_checks_for_savegame(savegame_id)
    # Silently ignore stale item_ids (Req 6.4): filter to only known item_ids
    all_valid_ids = content.get_all_item_ids()
    return {item_id: True for item_id in checks if item_id in all_valid_ids}


@router.get("/api/savegames/{savegame_id}/notes")
async def get_notes(savegame_id: int, user: dict = Depends(auth_module.require_user)):
    """Return {note_id: text} for all free-text note fields in the savegame."""
    sg = await db.get_savegame_by_id(savegame_id, user["id"])
    if not sg:
        raise HTTPException(status_code=404, detail="savegame not found")
    return await db.get_notes_for_savegame(savegame_id)


class NoteRequest(BaseModel):
    text: str


@router.put("/api/savegames/{savegame_id}/notes/{note_id:path}")
async def put_note(
    savegame_id: int,
    note_id: str,
    body: NoteRequest,
    user: dict = Depends(auth_module.require_user),
):
    """Store the text of a free-text note field (e.g. P880 section notes)."""
    sg = await db.get_savegame_by_id(savegame_id, user["id"])
    if not sg:
        raise HTTPException(status_code=404, detail="savegame not found")
    # Cap length defensively.
    text = (body.text or "")[:4000]
    try:
        saved_at = await db.upsert_note(savegame_id, note_id, text)
        return {"noteId": note_id, "text": text, "savedAt": saved_at}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="failed to save note") from exc


@router.put("/api/savegames/{savegame_id}/checks/{item_id:path}")
async def put_check(
    savegame_id: int,
    item_id: str,
    body: CheckRequest,
    user: dict = Depends(auth_module.require_user),
):
    """Set or clear a single checklist item's checked state.

    - 404 if savegame not owned by the authenticated user.
    - 400 if item_id is not in the content model (Req 6.4).
    - 500 on DB error so the frontend can revert optimistic UI (Req 6.6).
    """
    sg = await db.get_savegame_by_id(savegame_id, user["id"])
    if not sg:
        raise HTTPException(status_code=404, detail="savegame not found")

    # Validate item_id against content model (Req 6.4 write side)
    all_valid_ids = content.get_all_item_ids()
    if item_id not in all_valid_ids:
        raise HTTPException(status_code=400, detail=f"unknown item id: {item_id}")

    try:
        if body.checked:
            saved_at = await db.upsert_check(savegame_id, item_id)
            return {"itemId": item_id, "checked": True, "savedAt": saved_at}
        else:
            await db.delete_check(savegame_id, item_id)
            return {"itemId": item_id, "checked": False, "savedAt": None}
    except Exception as exc:
        # Surface DB errors so frontend can revert (Req 6.6)
        raise HTTPException(status_code=500, detail="failed to save checklist state") from exc
