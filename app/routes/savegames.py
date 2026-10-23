"""Savegame routes — full implementation (Task 3.3)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app import db, auth as auth_module, content

router = APIRouter()


class CreateSavegameRequest(BaseModel):
    name: str


@router.get("/api/savegames")
async def list_savegames(user: dict = Depends(auth_module.require_user)):
    """Return [{id, name, createdAt, lastUsedAt}] for the current user."""
    savegames = await db.get_savegames_for_user(user["id"])
    return [
        {
            "id": sg["id"],
            "name": sg["name"],
            "createdAt": sg["created_at"],
            "lastUsedAt": sg["last_used_at"],
        }
        for sg in savegames
    ]


@router.post("/api/savegames", status_code=201)
async def create_savegame(
    body: CreateSavegameRequest,
    user: dict = Depends(auth_module.require_user),
):
    """Create a new savegame for the current user.

    Returns 409 if a savegame with that name already exists (Req 5.6).
    """
    try:
        sg = await db.create_savegame(user["id"], body.name)
    except ValueError:
        raise HTTPException(status_code=409, detail="savegame name already exists")
    return {
        "id": sg["id"],
        "name": sg["name"],
        "createdAt": sg["created_at"],
        "lastUsedAt": sg["last_used_at"],
    }


@router.delete("/api/savegames/{savegame_id}")
async def delete_savegame(
    savegame_id: int,
    request: Request,
    user: dict = Depends(auth_module.require_user),
):
    """Delete a savegame (cascades checklist_state). Returns 404 if not owned by user."""
    sg = await db.get_savegame_by_id(savegame_id, user["id"])
    if not sg:
        raise HTTPException(status_code=404, detail="savegame not found")
    deleted = await db.delete_savegame(savegame_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="savegame not found")
    # Clear from session if it was the active one
    if auth_module.get_active_savegame_id(request) == savegame_id:
        auth_module.set_active_savegame_id(request, None)
    return {"ok": True}


@router.post("/api/savegames/{savegame_id}/select")
async def select_savegame(
    savegame_id: int,
    request: Request,
    user: dict = Depends(auth_module.require_user),
):
    """Set the active savegame in the session and update last_used_at.

    Returns 404 if the savegame is not owned by the current user.
    """
    sg = await db.get_savegame_by_id(savegame_id, user["id"])
    if not sg:
        raise HTTPException(status_code=404, detail="savegame not found")
    await db.update_savegame_last_used(savegame_id)
    auth_module.set_active_savegame_id(request, savegame_id)
    return {"ok": True, "activeSavegameId": savegame_id}


@router.get("/api/savegames/{savegame_id}/progress")
async def get_savegame_progress(
    savegame_id: int,
    user: dict = Depends(auth_module.require_user),
):
    """Return every TRACKABLE protocol (≥ 1 checklist item) with its items and
    current checked state, so the Fortschritt page can render a grid of "Log N"
    entries whose boxes are the SAME check items as the protocol view.

    Shape: [{ id, number, title, items: [{ itemId, label, checked }] }],
    sorted by protocol number. Protocols without any checklist item are omitted
    (no more generic "Erledigt" box). Returns 404 if the savegame is not owned
    by the current user.
    """
    sg = await db.get_savegame_by_id(savegame_id, user["id"])
    if not sg:
        raise HTTPException(status_code=404, detail="savegame not found")

    checks = await db.get_checks_for_savegame(savegame_id)
    checked_ids = set(checks.keys())

    trackable = []
    for proto in content.get_all_protocols():
        full_proto = content.get_protocol_by_id(proto["id"])
        if not full_proto:
            continue
        checklist = full_proto.get("checklist", [])
        if not checklist:
            continue
        items = [
            {
                "itemId": item["itemId"],
                "label": item.get("label", ""),
                "checked": item["itemId"] in checked_ids,
                # Primary protocol reference (if any) lets the Fortschritt page
                # show a short "Lies Protokoll N" instead of a long sentence.
                "reference": item.get("reference"),
            }
            for item in checklist
        ]
        trackable.append(
            {
                "id": proto["id"],
                "number": proto["number"],
                "title": proto["title"],
                "items": items,
            }
        )
    trackable.sort(key=lambda p: (p["number"], p["id"]))
    return trackable
