"""Auth utilities: password hashing and session management."""
from passlib.context import CryptContext
from fastapi import Request, HTTPException

# Use argon2 with bcrypt fallback
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password for storage."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against its hash."""
    return pwd_context.verify(plain, hashed)


async def require_user(request: Request) -> dict:
    """FastAPI dependency: returns the authenticated user row, or raises 401.

    Reads user_id from the session (set at login). Returns user dict from DB.
    Returns dict with keys: id, username, password_hash, created_at.
    """
    from app import db
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await db.get_user_by_id(user_id)
    if not user:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def get_active_savegame_id(request: Request) -> int | None:
    """Return the active savegame id from the session, or None."""
    return request.session.get("active_savegame_id")


def set_active_savegame_id(request: Request, savegame_id: int | None) -> None:
    """Set or clear the active savegame id in the session."""
    if savegame_id is None:
        request.session.pop("active_savegame_id", None)
    else:
        request.session["active_savegame_id"] = savegame_id
