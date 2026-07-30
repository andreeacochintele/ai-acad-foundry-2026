"""Chat sessions — one JSON file per conversation, saved to disk instead of the browser.

Mirrors `app/agents/persona.py`'s file-per-record convention: every conversation is a
plain JSON file, human-readable, and inspectable outside the app. Unlike personas these
are written by the API itself (the console saves on every turn), not hand-edited.
"""
from __future__ import annotations

import json
import re
import time
import uuid
from pathlib import Path

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


def list_sessions() -> list[dict]:
    sessions = [json.loads(p.read_text(encoding="utf-8")) for p in SESSIONS_DIR.glob("*.json")]
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
    _path(id).write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
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
