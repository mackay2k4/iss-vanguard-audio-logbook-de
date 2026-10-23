"""Auth routes: login, logout, and current-user endpoint."""
from fastapi import APIRouter, Depends, Form, Request

from app import db, auth as auth_module

router = APIRouter()


@router.post("/api/login")
async def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
) -> dict:
    """Log in a user.

    Accepts application/x-www-form-urlencoded with username and password fields.
    On success sets user_id (and optionally active_savegame_id) in the session.
    Always returns a generic error on failure to avoid username enumeration (Req 3.3).
    """
    user = await db.get_user_by_username(username)
    if not user or not auth_module.verify_password(password, user["password_hash"]):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Ungültige Zugangsdaten")

    request.session["user_id"] = user["id"]

    # Auto-select savegame
    savegames = await db.get_savegames_for_user(user["id"])
    if len(savegames) == 1:
        request.session["active_savegame_id"] = savegames[0]["id"]
    elif len(savegames) > 1:
        # Pick the most recently used; if all last_used_at are NULL, pick the
        # most recently created one.
        def _sort_key(sg: dict):
            last_used = sg.get("last_used_at")
            created = sg.get("created_at") or ""
            # Place NULLs last for last_used_at; secondary sort by created_at descending
            return (last_used is None, "" if last_used is None else last_used, created)

        best = max(
            savegames,
            key=lambda sg: (
                sg.get("last_used_at") is not None,
                sg.get("last_used_at") or "",
                sg.get("created_at") or "",
            ),
        )
        request.session["active_savegame_id"] = best["id"]
    # If 0 savegames: leave active_savegame_id unset

    return {"ok": True}


@router.post("/api/logout")
async def logout(request: Request) -> dict:
    """Log out the current user by clearing the session."""
    request.session.clear()
    return {"ok": True}


@router.get("/api/me")
async def me(
    request: Request,
    user: dict = Depends(auth_module.require_user),
) -> dict:
    """Return the currently authenticated user and their savegames."""
    savegames = await db.get_savegames_for_user(user["id"])
    active_savegame_id = auth_module.get_active_savegame_id(request)

    return {
        "username": user["username"],
        "activeSavegameId": active_savegame_id,
        "savegames": [
            {
                "id": sg["id"],
                "name": sg["name"],
                "createdAt": sg["created_at"],
                "lastUsedAt": sg["last_used_at"],
            }
            for sg in savegames
        ],
    }
