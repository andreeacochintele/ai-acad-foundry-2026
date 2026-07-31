"""Rough per-call cost estimation from token usage.

The app already tracked `prompt_tokens`/`completion_tokens` but never turned
them into a dollar figure. This is a small, static price list matched by
substring against the model/deployment name — good enough to show *relative*
cost between a question with and without RAG, or between personas, which is
the point of a teaching console. It is NOT a billing-grade rate card: prices
move, this list will go stale, and an unmatched or self-hosted model (Azure
deployments are free to rename) correctly returns `None` rather than a
guessed number.

Rates are USD per 1,000,000 tokens (input, output), approximate as of the
models this project ships with. lmstudio is always free — the tokens run on
the caller's own machine.
"""
from __future__ import annotations

# Longest/most specific pattern first — checked in order, first match wins.
_RATES_PER_MILLION: list[tuple[str, float, float]] = [
    ("gpt-5.4-nano", 0.05, 0.40),
    ("gpt-5-nano", 0.05, 0.40),
    ("gpt-5-mini", 0.25, 2.00),
    ("gpt-5.1", 1.25, 10.00),
    ("gpt-5", 1.25, 10.00),
    ("gpt-4o-mini", 0.15, 0.60),
    ("gpt-4o", 2.50, 10.00),
    ("gpt-4", 2.50, 10.00),
    ("claude-opus", 15.00, 75.00),
    ("claude-sonnet", 3.00, 15.00),
    ("claude-haiku", 0.80, 4.00),
    ("claude-fable", 3.00, 15.00),
    ("text-embedding-3-small", 0.02, 0.0),
    ("text-embedding-3-large", 0.13, 0.0),
]


def estimate_cost_usd(provider: str, model: str,
                       prompt_tokens: int | None, completion_tokens: int | None) -> float | None:
    """Best-effort estimate in USD, or None when the model isn't in the table
    (never guess a rate for a model we don't recognize)."""
    if provider == "lmstudio":
        return 0.0
    if prompt_tokens is None and completion_tokens is None:
        return None

    lowered = model.lower()
    for pattern, in_rate, out_rate in _RATES_PER_MILLION:
        if pattern in lowered:
            cost = (prompt_tokens or 0) / 1_000_000 * in_rate
            cost += (completion_tokens or 0) / 1_000_000 * out_rate
            return round(cost, 6)
    return None
