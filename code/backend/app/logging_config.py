"""Logging setup — one place to configure it, so nothing before this ran silent.

Plain stdlib `logging` to stderr. No handler previously existed anywhere in
this app: guardrail violations, agent failures, and unexpected errors were
only ever surfaced as an HTTP response, with no server-side trail once that
response left the process.
"""
from __future__ import annotations

import logging

from .config import settings


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
