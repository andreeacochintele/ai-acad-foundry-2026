"""Input-side checks — what we look at before a user's text becomes a prompt.

Pure detection: every function returns the list of reasons it found something
wrong (empty list = clean), never raises. app/guardrails/guardrails.py decides
what to do with those reasons — this module only spots them.
"""
from __future__ import annotations

import re

# check_input() runs on the FULLY composed prompt (question + retrieved chunks
# + history + an attached document — see local_agent.build_user_prompt), not
# just the raw question, which already has its own max_length=8000 at the API
# boundary (schemas.AskRequest). This cap needs headroom for all of that
# combined — a 20k-char attached document alone would blow past a tighter
# limit set only with a bare question in mind.
MAX_INPUT_CHARS = 40000

# Heuristic phrasing used to try to override the system prompt. Regex over an
# LLM call is cheap and catches the common cases; it will never be complete,
# but "some coverage before the model sees it" beats "none".
_INJECTION_PATTERNS = [
    re.compile(r"ignore (all|any|the) (previous|prior|above) instructions", re.I),
    re.compile(r"disregard (all|any|the) (previous|prior|above)", re.I),
    re.compile(r"reveal (your|the) (system prompt|instructions)", re.I),
    re.compile(r"you are now (in )?(dan|developer mode|jailbreak)", re.I),
    re.compile(r"pretend (you have no|there are no) (rules|restrictions|guardrails)", re.I),
]

# Coarse PII patterns — good enough to flag "this looks like a card/IBAN/CNP",
# not a validator. Shared with output_gr.py so a leak is caught the same way
# on the way out as a mistake is caught on the way in.
PII_PATTERNS = {
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "iban": re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b"),
    "card_number": re.compile(r"\b(?:\d[ -]?){13,19}\b"),
    "cnp": re.compile(r"\b[1-8]\d{12}\b"),  # Romanian personal numeric code
}


def check_length(text: str) -> list[str]:
    if len(text) > MAX_INPUT_CHARS:
        return [f"input is {len(text)} chars, exceeds limit of {MAX_INPUT_CHARS}"]
    return []


def check_injection(text: str) -> list[str]:
    return [
        f"possible prompt injection (matched: {p.pattern})"
        for p in _INJECTION_PATTERNS if p.search(text)
    ]


def check_pii(text: str) -> list[str]:
    return [f"possible {name} in input" for name, p in PII_PATTERNS.items() if p.search(text)]


def run(text: str) -> list[str]:
    return check_length(text) + check_injection(text) + check_pii(text)
