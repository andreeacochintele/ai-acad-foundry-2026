"""Known logins — a lightweight registry so a user who has logged in but not
yet sent a message still shows up in the admin-only Audit and Analytics
views, instead of being invisible until their first saved conversation.

One JSON file, not one-per-user like sessions.py: this is a small index, not
content meant to be individually exported or inspected — there's nothing
here worth a file each.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path

USERS_FILE = Path(__file__).parent / "data" / "users.json"
USERS_FILE.parent.mkdir(parents=True, exist_ok=True)


def _read() -> dict:
    if not USERS_FILE.exists():
        return {}
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write(users: dict) -> None:
    # Same atomic write-then-replace as sessions.py's save_session — two
    # logins landing at once must not interleave into a corrupt file.
    fd, tmp_path = tempfile.mkstemp(dir=USERS_FILE.parent, prefix=".users-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(json.dumps(users, ensure_ascii=False, indent=2))
        os.replace(tmp_path, USERS_FILE)
    except Exception:
        Path(tmp_path).unlink(missing_ok=True)
        raise


def register_login(owner: str, name: str, role: str) -> dict:
    """Record that `owner` (the name::role composite key) has logged in.

    Idempotent and cheap to call on every login: `first_seen` is set once
    and never touched again; `last_seen` just gets bumped on repeat visits.
    """
    users = _read()
    now = time.time() * 1000
    existing = users.get(owner)
    record = {
        "owner": owner,
        "name": name,
        "role": role,
        "first_seen": existing["first_seen"] if existing else now,
        "last_seen": now,
    }
    users[owner] = record
    _write(users)
    return record


def list_users() -> list[dict]:
    """Every known login, most recently seen first."""
    return sorted(_read().values(), key=lambda u: u["last_seen"], reverse=True)
