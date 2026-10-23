"""Audio route: serves OGG files from the audio volume with range request support."""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app import config
from app import auth as auth_module

router = APIRouter()


@router.get("/audiofiles/{filename:path}")
async def serve_audio(
    filename: str,
    user: dict = Depends(auth_module.require_user),
) -> FileResponse:
    """Serve an audio file with range request support.

    Sanitizes the filename to prevent path traversal, then serves the file
    from AUDIO_DIR. Returns 404 if the file does not exist.
    Starlette's FileResponse handles Range headers natively.
    """
    audio_dir = Path(config.AUDIO_DIR)
    # Strip any directory components to prevent path traversal
    safe_filename = Path(filename).name
    file_path = audio_dir / safe_filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="audio file not found")

    return FileResponse(
        str(file_path),
        media_type="audio/ogg",
        headers={"Accept-Ranges": "bytes"},
    )
