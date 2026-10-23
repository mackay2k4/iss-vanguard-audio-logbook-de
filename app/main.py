"""FastAPI application factory for the ISS Vanguard Logbook Web App."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app import config, content, db
from app.routes import audio, auth, checks, content as content_routes, savegames

logger = logging.getLogger(__name__)

# Absolute path to the static directory (co-located with this package)
_STATIC_DIR = Path(__file__).parent / "static"
_INDEX_HTML = _STATIC_DIR / "index.html"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: load content model and initialise the DB on startup."""
    logger.info("Starting up — loading content model from %s", config.CONTENT_PATH)
    content.load_content(config.CONTENT_PATH)
    logger.info("Initialising database at %s", config.DATA_DB)
    await db.init_db()
    yield
    logger.info("Shutting down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    application = FastAPI(
        title="ISS Vanguard Logbook",
        lifespan=lifespan,
    )

    # Trust the X-Forwarded-Proto header set by Traefik so HTTPS is recognised
    # behind the reverse proxy.
    application.add_middleware(
        SessionMiddleware,
        secret_key=config.SESSION_SECRET,
        session_cookie="session",
        https_only=False,   # Traefik terminates TLS; uvicorn sees plain HTTP
        same_site="lax",
    )

    # Register API routers
    application.include_router(auth.router)
    application.include_router(content_routes.router)
    application.include_router(savegames.router)
    application.include_router(checks.router)
    application.include_router(audio.router)

    # Serve frontend static assets (JS, CSS, etc.) at /static
    if _STATIC_DIR.exists():
        application.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

    # SPA fallback — serve index.html for the root and any client-side route
    # (so a hard reload / deep link like /planet/beta-tarsoni works). API and
    # /static requests are handled by their own routes/mount above; anything
    # that isn't an /api or /static path falls through to the SPA shell.
    @application.get("/")
    async def root() -> FileResponse:
        return FileResponse(str(_INDEX_HTML))

    @application.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # Never shadow the API or static assets.
        if full_path.startswith("api/") or full_path.startswith("static/") \
           or full_path.startswith("audiofiles/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(str(_INDEX_HTML))

    return application


# Module-level app instance used by uvicorn
app = create_app()
