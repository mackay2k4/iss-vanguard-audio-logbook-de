"""Settings loaded from environment variables."""
import os

# Path to the SQLite database file
DATA_DB: str = os.getenv("DATA_DB", "/data/db/app.sqlite")

# Path to the content model JSON. Defaults to the final model (curated text +
# cropped instruction images). Set CONTENT_PATH to override.
CONTENT_PATH: str = os.getenv("CONTENT_PATH", "/app/content/logbook.de.final.json")

# Base URL for the app (used for any absolute links)
ISS_VANGUARD_URL: str = os.getenv("ISS_VANGUARD_URL", "http://localhost:8080")

# Secret key for signing session cookies — required in production
SESSION_SECRET: str = os.getenv("SESSION_SECRET", "")

# Path to the directory containing audio files
AUDIO_DIR: str = os.getenv("AUDIO_DIR", "/data/audiofiles")
