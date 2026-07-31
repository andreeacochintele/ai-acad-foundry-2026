"""Output-side checks — what we look at before a model's reply reaches a caller.

Same shape as input_gr.py: pure detection, list of reasons, no raising. Reuses
input_gr's PII patterns so a leak flowing out is held to the same bar as a
mistake flowing in.
"""
from __future__ import annotations

from .input_gr import PII_PATTERNS

# Placeholder keyword list — swap in a real moderation call (or a bigger list)
# for anything beyond a classroom demo. Kept here so callers have one place
# to extend without touching app/llm.py.
BLOCKED_TERMS: list[str] = []


def check_empty(text: str) -> list[str]:
    if not text or not text.strip():
        return ["model returned an empty response"]
    return []


def check_pii_leak(text: str) -> list[str]:
    return [f"possible {name} leaked in output" for name, p in PII_PATTERNS.items() if p.search(text)]


def check_blocked_terms(text: str) -> list[str]:
    lowered = text.lower()
    return [f"blocked term '{term}' found in output" for term in BLOCKED_TERMS if term in lowered]


def run(text: str) -> list[str]:
    return check_empty(text) + check_pii_leak(text) + check_blocked_terms(text)
