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


def compute_usage_analytics(sessions: list[dict], known_owners: list[str] | None = None) -> dict:
    """`known_owners`, if given, makes sure every one of them appears in
    `by_owner` — even a login that has never sent a message yet — instead of
    only owners who happen to have usage recorded (see app/users.py)."""
    by_day: dict[str, dict] = defaultdict(_empty_bucket)
    by_agent: dict[str, dict] = defaultdict(_empty_bucket)
    by_model: dict[str, dict] = defaultdict(_empty_bucket)
    by_owner: dict[str, dict] = defaultdict(_empty_bucket)
    for owner in known_owners or []:
        by_owner[owner]  # noqa: B018 — touch to materialize an empty bucket

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


# --- audit: per-user answer-quality signals, never the raw text -------------
#
# The Audit console view exists so an admin can spot a user getting bad
# (hallucinated, ungrounded) answers without reading anyone's actual
# questions or answers — on a shared class console, that content is the
# other person's business, not the admin's. So this aggregates entirely on
# the server: only counts, lengths and percentages ever cross into the
# response; the question/answer strings themselves never leave this
# function's stack frame.

def _empty_audit_bucket() -> dict:
    return {
        "messages": 0, "answer_chars": 0, "retrieved": 0, "completion_tokens": 0,
        "grounded": 0, "risk": 0, "ungrounded": 0,
        "fact_checked": 0, "fact_supported": 0, "fact_contradicted": 0, "fact_unclear": 0,
    }


def _classify_grounding(data: dict) -> str:
    """grounded = RAG on and at least one passage retrieved; risk = RAG on but
    nothing came back above the score threshold (the model still had to
    answer, with nothing to ground it — the highest hallucination risk);
    ungrounded = RAG was off for this question, by design."""
    if not data.get("augmented"):
        return "ungrounded"
    if not data.get("retrieved"):
        return "risk"
    return "grounded"


def compute_audit_stats(sessions: list[dict], known_owners: list[str] | None = None) -> dict:
    """`known_owners`, if given, makes sure every one of them appears in the
    result — even a login that has never sent a message yet (see
    app/users.py) — with all-zero stats rather than being absent."""
    by_owner: dict[str, dict] = defaultdict(_empty_audit_bucket)
    conversations: dict[str, int] = defaultdict(int)
    for owner in known_owners or []:
        conversations[owner]  # noqa: B018 — touch to materialize a zero entry

    for session in sessions:
        owner = session.get("owner") or "(unknown)"
        conversations[owner] += 1
        for message in session.get("messages", []):
            if message.get("role") != "bot":
                continue
            data = message.get("data") or {}
            answer = data.get("answer")
            if not answer:
                continue

            b = by_owner[owner]
            b["messages"] += 1
            b["answer_chars"] += len(answer)
            b["retrieved"] += len(data.get("retrieved") or [])
            b["completion_tokens"] += (data.get("usage") or {}).get("completion_tokens") or 0
            b[_classify_grounding(data)] += 1

            fc = data.get("fact_check")
            if fc and fc.get("verdict") not in (None, "unavailable"):
                b["fact_checked"] += 1
                verdict = fc.get("verdict")
                if verdict == "supported":
                    b["fact_supported"] += 1
                elif verdict == "contradicted":
                    b["fact_contradicted"] += 1
                elif verdict == "unclear":
                    b["fact_unclear"] += 1

    def _finalize(owner: str, b: dict) -> dict:
        n = b["messages"] or 1
        return {
            "owner": owner,
            "conversations": conversations.get(owner, 0),
            "messages": b["messages"],
            "avg_answer_chars": round(b["answer_chars"] / n),
            "avg_retrieved": round(b["retrieved"] / n, 1),
            "avg_completion_tokens": round(b["completion_tokens"] / n),
            "grounded": b["grounded"],
            "risk": b["risk"],
            "ungrounded": b["ungrounded"],
            "grounded_pct": round(100 * b["grounded"] / n, 1),
            "risk_pct": round(100 * b["risk"] / n, 1),
            "ungrounded_pct": round(100 * b["ungrounded"] / n, 1),
            "fact_checked": b["fact_checked"],
            "fact_supported": b["fact_supported"],
            "fact_contradicted": b["fact_contradicted"],
            "fact_unclear": b["fact_unclear"],
        }

    # A brand-new conversation with no answered turns yet has a conversation
    # count but no bucket in by_owner (only created on the first bot message)
    # — union the two so it still shows up, with all-zero answer stats.
    all_owners = set(conversations) | set(by_owner)
    rows = [_finalize(owner, by_owner[owner]) for owner in all_owners]
    rows.sort(key=lambda r: r["messages"], reverse=True)
    return {"by_owner": rows}
