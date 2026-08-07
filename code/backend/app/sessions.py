"""Chat sessions — one JSON file per conversation, saved to disk instead of the browser.

Mirrors `app/agents/persona.py`'s file-per-record convention: every conversation is a
plain JSON file, human-readable, and inspectable outside the app. Unlike personas these
are written by the API itself (the console saves on every turn), not hand-edited.
"""
from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import time
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)

SESSIONS_DIR = Path(__file__).parent / "data" / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,100}$")


class SessionNotFound(Exception):
    def __init__(self, id: str) -> None:
        self.id = id
        super().__init__(f"No session '{id}' in {SESSIONS_DIR}")


class InvalidSessionId(Exception):
    def __init__(self, id: str) -> None:
        self.id = id
        super().__init__(f"'{id}' is not a valid session id")


def _path(id: str) -> Path:
    # Session ids become filenames AND path parameters — validated, never trusted.
    if not _SAFE_ID.match(id):
        raise InvalidSessionId(id)
    return SESSIONS_DIR / f"{id}.json"


def list_sessions(owner: str | None = None) -> list[dict]:
    """Every saved conversation, newest first.

    `owner` (a login's name+role, set by the console on save) keeps a `user`
    login and an `admin` login from seeing each other's conversation history
    when they share this backend — pass it to see only that owner's sessions,
    omit it for the old unscoped behaviour.
    """
    sessions = []
    for p in SESSIONS_DIR.glob("*.json"):
        try:
            sessions.append(json.loads(p.read_text(encoding="utf-8")))
        except json.JSONDecodeError as e:
            # One bad file (e.g. from a non-atomic write racing with another
            # save of the same id) must not take every user's session list
            # down with it — skip it and keep serving the rest.
            logger.warning("Skipping unreadable session file %s: %s", p.name, e)
    if owner is not None:
        sessions = [s for s in sessions if s.get("owner", "") == owner]
    sessions.sort(key=lambda s: s.get("updated_at", 0), reverse=True)
    return sessions


def load_session(id: str) -> dict:
    path = _path(id)
    if not path.exists():
        raise SessionNotFound(id)
    return json.loads(path.read_text(encoding="utf-8"))


def save_session(payload: dict) -> dict:
    id = payload.get("id") or uuid.uuid4().hex
    now = time.time() * 1000  # epoch ms, matching Date.now() on the frontend
    record = {
        **payload,
        "id": id,
        "created_at": payload.get("created_at") or now,
        "updated_at": now,
    }
    path = _path(id)
    # Write to a temp file in the same directory, then atomically replace the
    # target. A plain write_text() truncates-then-writes in two separate
    # steps — two saves for the same id racing (e.g. a duplicated request)
    # can interleave into a half-written, corrupt file. os.replace() is a
    # single atomic filesystem operation on both POSIX and Windows, so the
    # file is always either the old, complete record or the new one.
    fd, tmp_path = tempfile.mkstemp(dir=path.parent, prefix=f".{path.stem}-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False, indent=2))
        os.replace(tmp_path, path)
    except Exception:
        Path(tmp_path).unlink(missing_ok=True)
        raise
    return record


def delete_session(id: str) -> None:
    path = _path(id)
    if not path.exists():
        raise SessionNotFound(id)
    path.unlink()


def _fmt_time(ms: float) -> str:
    return time.strftime("%Y-%m-%d %H:%M", time.localtime(ms / 1000))


def export_markdown(id: str) -> str:
    s = load_session(id)
    title = s.get("title") or "New conversation"
    lines = [
        f"# {title}",
        "",
        f"_agent: {s.get('agent', '—')} · mode: {s.get('mode', '—')} · "
        f"created {_fmt_time(s.get('created_at', 0))} · updated {_fmt_time(s.get('updated_at', 0))}_",
        "",
        "---",
    ]
    for m in s.get("messages", []):
        role = m.get("role")
        if role == "user":
            lines += ["", "## You", "", m.get("text", "")]
        elif role == "err":
            lines += ["", "## Error", "", m.get("text", "")]
        else:
            data = m.get("data") or {}
            who = (data.get("agent") or {}).get("display_name") or "Assistant"
            lines += ["", f"## {who}", "", data.get("answer", "")]
            fc = data.get("fact_check")
            if fc:
                lines += ["", f"*fact-check: {fc.get('verdict')} ({fc.get('confidence')} confidence, "
                              f"via {fc.get('evidence_from')})*"]
            retrieved = data.get("retrieved") or []
            if retrieved:
                lines += ["", f"*{len(retrieved)} retrieved passage(s) used.*"]
    return "\n".join(lines) + "\n"
