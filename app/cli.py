"""CLI entry point for user management.

Usage:
    python -m app.cli <command> [args]

Commands:
    create-user <username> [--force]    Create a new user (prompts for password)
    delete-user <username>              Delete a user and all their data
    list-users                          List all users
"""
import asyncio
import getpass
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Force-update helper (bypasses create_user's duplicate-check)
# ---------------------------------------------------------------------------

async def _update_user_password(username: str, password_hash: str) -> bool:
    """Update password hash for an existing user. Returns True if a row was updated."""
    import aiosqlite
    from app import config

    Path(config.DATA_DB).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(config.DATA_DB) as conn:
        await conn.execute("PRAGMA foreign_keys = ON")
        cursor = await conn.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (password_hash, username),
        )
        await conn.commit()
        return cursor.rowcount > 0


# ---------------------------------------------------------------------------
# Command implementations
# ---------------------------------------------------------------------------

async def cmd_create_user(args: list[str]) -> None:
    from app import db, auth as auth_module

    await db.init_db()

    # Parse positional + flag args
    force = "--force" in args
    positional = [a for a in args if not a.startswith("--")]

    if not positional:
        print("Usage: python -m app.cli create-user <username> [--force]", file=sys.stderr)
        sys.exit(1)

    username = positional[0]

    # Prompt for password (hidden input)
    try:
        password = getpass.getpass(f"Password for '{username}': ")
        confirm = getpass.getpass("Confirm password: ")
    except (KeyboardInterrupt, EOFError):
        print("\nAborted.", file=sys.stderr)
        sys.exit(1)

    if password != confirm:
        print("Error: passwords do not match.", file=sys.stderr)
        sys.exit(1)

    if not password:
        print("Error: password must not be empty.", file=sys.stderr)
        sys.exit(1)

    password_hash = auth_module.hash_password(password)

    if force:
        # Update existing user's password without touching savegames
        updated = await _update_user_password(username, password_hash)
        if updated:
            print(f"Password updated for user '{username}'.")
        else:
            # User doesn't exist yet — fall through to create
            try:
                await db.create_user(username, password_hash)
                print(f"User '{username}' created.")
            except Exception as exc:
                print(f"Error: {exc}", file=sys.stderr)
                sys.exit(1)
    else:
        try:
            await db.create_user(username, password_hash)
            print(f"User '{username}' created.")
        except ValueError:
            print(
                f"Error: username '{username}' is already taken. "
                "Use --force to update the password.",
                file=sys.stderr,
            )
            sys.exit(1)
        except Exception as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(1)


async def cmd_delete_user(args: list[str]) -> None:
    from app import db

    await db.init_db()

    if not args:
        print("Usage: python -m app.cli delete-user <username>", file=sys.stderr)
        sys.exit(1)

    username = args[0]

    # Ask for confirmation
    try:
        answer = input(f"Delete user '{username}' and all their savegames? [y/N]: ")
    except (KeyboardInterrupt, EOFError):
        print("\nAborted.")
        sys.exit(0)

    if answer.strip().lower() != "y":
        print("Aborted.")
        sys.exit(0)

    try:
        deleted = await db.delete_user(username)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    if not deleted:
        print(f"Error: user '{username}' not found.", file=sys.stderr)
        sys.exit(1)

    print(f"User '{username}' deleted.")


async def cmd_list_users() -> None:
    from app import db

    await db.init_db()

    try:
        users = await db.list_users()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    if not users:
        print("No users found.")
        return

    # Simple table: username | created_at
    col_user = max(len("username"), max(len(u["username"]) for u in users))
    col_date = max(len("created_at"), max(len(str(u.get("created_at", ""))) for u in users))

    header = f"{'username':<{col_user}}  {'created_at':<{col_date}}"
    separator = "-" * len(header)
    print(header)
    print(separator)
    for user in users:
        print(f"{user['username']:<{col_user}}  {str(user.get('created_at', '')):<{col_date}}")


# ---------------------------------------------------------------------------
# Usage / dispatch
# ---------------------------------------------------------------------------

def print_usage() -> None:
    print("Usage: python -m app.cli <command> [args]")
    print("Commands:")
    print("  create-user <username> [--force]")
    print("  delete-user <username>")
    print("  list-users")


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print_usage()
        sys.exit(1)

    command = args[0]
    if command == "create-user":
        asyncio.run(cmd_create_user(args[1:]))
    elif command == "delete-user":
        asyncio.run(cmd_delete_user(args[1:]))
    elif command == "list-users":
        asyncio.run(cmd_list_users())
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print_usage()
        sys.exit(1)


if __name__ == "__main__":
    main()
