"""Content model loader and in-memory cache for the logbook JSON."""
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Module-level content cache; populated by load_content()
_content: dict[str, Any] | None = None


def load_content(path: str) -> None:
    """Load and cache the logbook content model from a JSON file.

    Must be called once at startup (e.g. from the app lifespan). Raises
    FileNotFoundError if the file is missing (fast-fail on misconfiguration).
    """
    global _content
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(
            f"Content model not found at {path!r}. "
            "Run the extractor (dev/extract_content.py) to generate it."
        )
    with p.open(encoding="utf-8") as fh:
        _content = json.load(fh)
    protocol_count = len(_content.get("protocols", []))
    logger.info("Loaded content model: %d protocols from %s", protocol_count, path)


def _require_content() -> dict[str, Any]:
    if _content is None:
        raise RuntimeError("Content model not loaded. Call load_content() first.")
    return _content


def get_all_protocols() -> list[dict[str, Any]]:
    """Return the lightweight index of all protocols (id, number, variant, order,
    title, hasAudio). Suitable for the navigation/jump-box endpoint."""
    content = _require_content()
    return [
        {
            "id": p["id"],
            "number": p["number"],
            "variant": p.get("variant"),
            "order": p["order"],
            "title": p["title"],
            "hasAudio": p.get("hasAudio", False),
        }
        for p in content.get("protocols", [])
    ]


def get_protocol_by_id(protocol_id: str) -> dict[str, Any] | None:
    """Return the full protocol object for the given id, or None if not found."""
    content = _require_content()
    for p in content.get("protocols", []):
        if p["id"] == protocol_id:
            return p
    return None


def get_all_item_ids() -> set[str]:
    """Return the set of all checklist item ids across all protocols.

    Used to validate PUT /checks/{itemId} requests against the content model.
    """
    content = _require_content()
    ids: set[str] = set()
    for p in content.get("protocols", []):
        for item in p.get("checklist", []):
            ids.add(item["itemId"])
    return ids
