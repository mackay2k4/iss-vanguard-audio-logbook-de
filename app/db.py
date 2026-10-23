"""SQLite database access layer using aiosqlite."""
from __future__ import annotations

from pathlib import Path

import aiosqlite

from app import config


def _db_path() -> Path:
    return Path(config.DATA_DB)


async def _connect() -> aiosqlite.Connection:
    """Open a connection with foreign keys enabled."""
    db = await aiosqlite.connect(_db_path())
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def init_db() -> None:
    """Create tables if they don't exist. Safe to call on a populated DB."""
    _db_path().parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        await db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id            INTEGER PRIMARY KEY,
              username      TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS savegames (
              id           INTEGER PRIMARY KEY,
              user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              name         TEXT NOT NULL,
              created_at   TEXT NOT NULL DEFAULT (datetime('now')),
              last_used_at TEXT,
              UNIQUE (user_id, name)
            );

            CREATE TABLE IF NOT EXISTS checklist_state (
              savegame_id INTEGER NOT NULL REFERENCES savegames(id) ON DELETE CASCADE,
              item_id     TEXT NOT NULL,
              checked     INTEGER NOT NULL DEFAULT 1,
              updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (savegame_id, item_id)
            );

            CREATE TABLE IF NOT EXISTS note_state (
              savegame_id INTEGER NOT NULL REFERENCES savegames(id) ON DELETE CASCADE,
              note_id     TEXT NOT NULL,
              text        TEXT NOT NULL DEFAULT '',
              updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (savegame_id, note_id)
            );
            """
        )
        await db.commit()


# ---------------------------------------------------------------------------
# User helpers
# ---------------------------------------------------------------------------


async def get_user_by_username(username: str) -> dict | None:
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        # Username match is case-insensitive (COLLATE NOCASE) so e.g. "Sheppard"
        # and "sheppard" log in to the same account.
        async with db.execute(
            "SELECT id, username, password_hash, created_at "
            "FROM users WHERE username = ? COLLATE NOCASE",
            (username,),
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def get_user_by_id(user_id: int) -> dict | None:
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        async with db.execute(
            "SELECT id, username, password_hash, created_at FROM users WHERE id = ?",
            (user_id,),
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def create_user(username: str, password_hash: str) -> int:
    """Insert a new user. Raises ValueError if the username already exists
    (case-insensitively — "Sheppard" collides with an existing "sheppard")."""
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        # Reject case-insensitive duplicates so logins stay unambiguous.
        async with db.execute(
            "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE", (username,)
        ) as cursor:
            if await cursor.fetchone():
                raise ValueError(f"Username '{username}' already exists")
        try:
            async with db.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, password_hash),
            ) as cursor:
                new_id = cursor.lastrowid
            await db.commit()
            return new_id
        except aiosqlite.IntegrityError:
            raise ValueError(f"Username '{username}' already exists")


async def delete_user(username: str) -> bool:
    """Delete user by username (cascades to savegames/checklist_state).

    Returns True if a row was deleted, False if not found.
    """
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        async with db.execute(
            "DELETE FROM users WHERE username = ?", (username,)
        ) as cursor:
            deleted = cursor.rowcount > 0
        await db.commit()
        return deleted


async def list_users() -> list[dict]:
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        async with db.execute(
            "SELECT id, username, created_at FROM users ORDER BY id"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Savegame helpers
# ---------------------------------------------------------------------------


async def create_savegame(user_id: int, name: str) -> dict:
    """Create a savegame for a user. Raises ValueError on duplicate name."""
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        try:
            async with db.execute(
                "INSERT INTO savegames (user_id, name) VALUES (?, ?)",
                (user_id, name),
            ) as cursor:
                new_id = cursor.lastrowid
            await db.commit()
        except aiosqlite.IntegrityError:
            raise ValueError(
                f"Savegame name '{name}' already exists for user {user_id}"
            )
        async with db.execute(
            "SELECT id, user_id, name, created_at, last_used_at FROM savegames WHERE id = ?",
            (new_id,),
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row)


async def get_savegames_for_user(user_id: int) -> list[dict]:
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        async with db.execute(
            """SELECT id, user_id, name, created_at, last_used_at
               FROM savegames WHERE user_id = ?
               ORDER BY id""",
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def get_savegame_by_id(savegame_id: int, user_id: int) -> dict | None:
    """Return savegame row only if it belongs to user_id."""
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        async with db.execute(
            """SELECT id, user_id, name, created_at, last_used_at
               FROM savegames WHERE id = ? AND user_id = ?""",
            (savegame_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def delete_savegame(savegame_id: int, user_id: int) -> bool:
    """Delete savegame if owned by user_id. Returns True if deleted."""
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        async with db.execute(
            "DELETE FROM savegames WHERE id = ? AND user_id = ?",
            (savegame_id, user_id),
        ) as cursor:
            deleted = cursor.rowcount > 0
        await db.commit()
        return deleted


async def update_savegame_last_used(savegame_id: int) -> None:
    """Set last_used_at to now for the given savegame."""
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        await db.execute(
            "UPDATE savegames SET last_used_at = datetime('now') WHERE id = ?",
            (savegame_id,),
        )
        await db.commit()


# ---------------------------------------------------------------------------
# Checklist state helpers
# ---------------------------------------------------------------------------


async def upsert_check(savegame_id: int, item_id: str) -> str:
    """Mark item as checked (INSERT OR REPLACE). Returns the updated_at timestamp."""
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        await db.execute(
            """INSERT OR REPLACE INTO checklist_state (savegame_id, item_id, checked, updated_at)
               VALUES (?, ?, 1, datetime('now'))""",
            (savegame_id, item_id),
        )
        await db.commit()
        async with db.execute(
            "SELECT updated_at FROM checklist_state WHERE savegame_id = ? AND item_id = ?",
            (savegame_id, item_id),
        ) as cursor:
            row = await cursor.fetchone()
            return row["updated_at"]


async def delete_check(savegame_id: int, item_id: str) -> None:
    """Remove a check row (absence = unchecked)."""
    async with aiosqlite.connect(_db_path()) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        await db.execute(
            "DELETE FROM checklist_state WHERE savegame_id = ? AND item_id = ?",
            (savegame_id, item_id),
        )
        await db.commit()


async def get_checks_for_savegame(savegame_id: int) -> dict[str, bool]:
    """Return {item_id: True} for all checked items (absence = unchecked)."""
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        async with db.execute(
            "SELECT item_id FROM checklist_state WHERE savegame_id = ?",
            (savegame_id,),
        ) as cursor:
            rows = await cursor.fetchall()
            return {row["item_id"]: True for row in rows}


# ---------------------------------------------------------------------------
# Note (free-text field) state helpers
# ---------------------------------------------------------------------------


async def upsert_note(savegame_id: int, note_id: str, text: str) -> str:
    """Set the text for a note field. Returns the updated_at timestamp."""
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        await db.execute(
            """INSERT OR REPLACE INTO note_state (savegame_id, note_id, text, updated_at)
               VALUES (?, ?, ?, datetime('now'))""",
            (savegame_id, note_id, text),
        )
        await db.commit()
        async with db.execute(
            "SELECT updated_at FROM note_state WHERE savegame_id = ? AND note_id = ?",
            (savegame_id, note_id),
        ) as cursor:
            row = await cursor.fetchone()
            return row["updated_at"]


async def get_notes_for_savegame(savegame_id: int) -> dict[str, str]:
    """Return {note_id: text} for all stored notes in the savegame."""
    async with aiosqlite.connect(_db_path()) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        async with db.execute(
            "SELECT note_id, text FROM note_state WHERE savegame_id = ?",
            (savegame_id,),
        ) as cursor:
            rows = await cursor.fetchall()
            return {row["note_id"]: row["text"] for row in rows}
