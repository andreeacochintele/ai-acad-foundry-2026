"""Guardrail entry point — the only module app/llm.py needs to know about.

Three checkpoints around a single chat() call:
  * check_request() — call parameters (provider, temperature, max_tokens)
  * check_input()    — the user text, before it becomes a prompt
  * check_output()   — the model's reply, before it reaches the caller

Each raises GuardrailViolation with every reason found in one go, rather than
making a caller fix issues one at a time. Detection lives in input_gr.py,
output_gr.py and model_gr.py — this module only decides what to do with what
they find.
"""
from __future__ import annotations

from ..config import settings
from . import input_gr, model_gr, output_gr


class GuardrailViolation(Exception):
    """Raised when a guardrail check fails. `.reasons` holds every reason found."""

    def __init__(self, reasons: list[str]) -> None:
        self.reasons = reasons
        super().__init__("; ".join(reasons))


def _enforce(reasons: list[str]) -> None:
    if reasons and settings.guardrails_enabled:
        raise GuardrailViolation(reasons)


def check_request(provider: str, model: str, temperature: float, max_tokens: int) -> None:
    _enforce(model_gr.run(provider, model, temperature, max_tokens))


def check_input(text: str) -> None:
    _enforce(input_gr.run(text))


def check_output(text: str) -> None:
    _enforce(output_gr.run(text))
