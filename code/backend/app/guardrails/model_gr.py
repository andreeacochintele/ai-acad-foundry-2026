"""Request-shape checks — the call parameters, not the text itself.

Stops a bad `temperature`/`max_tokens`/`provider` (a stray request, or a
caller with too much control over what it passes in) from turning into an
expensive or malformed call, before anything is sent to a provider SDK.
"""
from __future__ import annotations

import re

MIN_TEMPERATURE = 0.0
MAX_TEMPERATURE = 2.0
MAX_TOKENS_CEILING = 4000  # highest persona/request today asks for 2500 — leaves headroom

SUPPORTED_PROVIDERS = {"lmstudio", "openai", "anthropic", "azure"}

# Model families cleared for use, regardless of provider — matched against the
# deployment/model string, not an exact-name list, so "gpt-5.4-nano" and
# "gpt-5.1" both pass under "gpt-5x" without listing every point release.
# Covers every Claude tier (opus/sonnet/haiku/fable), not just two of four —
# "claude-sonnet-5" and "claude-haiku-4-5" are this project's own configured
# anthropic_model/default and were previously rejected by every single call.
APPROVED_MODEL_PATTERN = re.compile(r"gpt-4|gpt-5|opus|sonnet|haiku|fable", re.I)


def check_provider(provider: str) -> list[str]:
    if provider not in SUPPORTED_PROVIDERS:
        return [f"unsupported provider '{provider}'"]
    return []


def check_model(provider: str, model: str) -> list[str]:
    # lmstudio is a local/offline model the caller already fully controls —
    # there is no vendor cost or compliance exposure to police, unlike a
    # cloud provider. Policing it just blocked the local lane's own default
    # ("google/gemma-3-4b") outright.
    if provider == "lmstudio":
        return []
    if not APPROVED_MODEL_PATTERN.search(model):
        return [f"model '{model}' is not on the approved list "
                f"(gpt-4x, gpt-5x, claude opus/sonnet/haiku/fable)"]
    return []


def check_temperature(temperature: float) -> list[str]:
    if not (MIN_TEMPERATURE <= temperature <= MAX_TEMPERATURE):
        return [f"temperature {temperature} out of range [{MIN_TEMPERATURE}, {MAX_TEMPERATURE}]"]
    return []


def check_max_tokens(max_tokens: int) -> list[str]:
    if max_tokens <= 0:
        return ["max_tokens must be positive"]
    if max_tokens > MAX_TOKENS_CEILING:
        return [f"max_tokens {max_tokens} exceeds ceiling {MAX_TOKENS_CEILING}"]
    return []


def run(provider: str, model: str, temperature: float, max_tokens: int) -> list[str]:
    return (
        check_provider(provider)
        + check_model(provider, model)
        + check_temperature(temperature)
        + check_max_tokens(max_tokens)
    )
