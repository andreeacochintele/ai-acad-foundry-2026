"""Guardrails — input, output and request-shape checks around every LLM call.

app/llm.py is the only caller that matters: every provider funnels through
`LLM.chat()`, so hooking the three checkpoints there covers the whole app.
"""
from .guardrails import GuardrailViolation, check_input, check_output, check_request  # noqa: F401
