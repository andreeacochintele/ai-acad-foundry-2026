"""Token/cost analytics — aggregated from saved chat sessions.

No new instrumentation needed: every bot message already carries its full
/ask response (`ChatMessage.data`), including `usage` (prompt/completion
tokens, estimated_cost_usd from app/cost.py). This module just walks what
`sessions.list_sessions()` already returns and adds it up a few different
ways. Pure function, no I/O, easy to test — main.py owns reading the files.
"""
from __future__ import annotations

import time
from collections import defaultdict


def _day(epoch_ms: float) -> str:
    return time.strftime("%Y-%m-%d", time.localtime(epoch_ms / 1000))


def _empty_bucket() -> dict:
    return {"messages": 0, "prompt_tokens": 0, "completion_tokens": 0, "cost_usd": 0.0}


def _add(bucket: dict, usage: dict) -> None:
    bucket["messages"] += 1
    bucket["prompt_tokens"] += usage.get("prompt_tokens") or 0
    bucket["completion_tokens"] += usage.get("completion_tokens") or 0
    if usage.get("estimated_cost_usd") is not None:
        bucket["cost_usd"] += usage["estimated_cost_usd"]


def compute_usage_analytics(sessions: list[dict]) -> dict:
    by_day: dict[str, dict] = defaultdict(_empty_bucket)
    by_agent: dict[str, dict] = defaultdict(_empty_bucket)
    by_model: dict[str, dict] = defaultdict(_empty_bucket)
    by_owner: dict[str, dict] = defaultdict(_empty_bucket)

    total = _empty_bucket()
    messages_without_cost = 0
    conversations_with_usage = 0

    for session in sessions:
        owner = session.get("owner") or "(unknown)"
        session_had_usage = False

        for message in session.get("messages", []):
            if message.get("role") != "bot":
                continue
            data = message.get("data") or {}
            usage = data.get("usage")
            if not usage:
                continue
            session_had_usage = True

            day = _day(session.get("updated_at") or session.get("created_at") or 0)
            agent_name = ((data.get("agent") or {}).get("display_name")
                          or (data.get("agent") or {}).get("name") or "(unknown)")
            model_key = f"{data.get('provider', '?')} · {data.get('model', '?')}"

            _add(total, usage)
            _add(by_day[day], usage)
            _add(by_agent[agent_name], usage)
            _add(by_model[model_key], usage)
            _add(by_owner[owner], usage)

            if usage.get("estimated_cost_usd") is None:
                messages_without_cost += 1

        if session_had_usage:
            conversations_with_usage += 1

    def _to_sorted_list(buckets: dict[str, dict], key_name: str, sort_key: str = "cost_usd") -> list[dict]:
        return sorted(
            ({key_name: k, **v} for k, v in buckets.items()),
            key=lambda row: row[sort_key], reverse=True,
        )

    return {
        "total_conversations": conversations_with_usage,
        "total_messages": total["messages"],
        "total_prompt_tokens": total["prompt_tokens"],
        "total_completion_tokens": total["completion_tokens"],
        "total_estimated_cost_usd": round(total["cost_usd"], 6),
        "messages_without_cost_estimate": messages_without_cost,
        "by_day": sorted(_to_sorted_list(by_day, "day", "day"), key=lambda r: r["day"]),
        "by_agent": _to_sorted_list(by_agent, "agent"),
        "by_model": _to_sorted_list(by_model, "model"),
        "by_owner": _to_sorted_list(by_owner, "owner"),
    }
