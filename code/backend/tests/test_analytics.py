from app.analytics import compute_usage_analytics


def _bot_message(provider, model, agent_name, prompt_tokens, completion_tokens, cost):
    return {
        "role": "bot",
        "text": "answer",
        "data": {
            "provider": provider,
            "model": model,
            "agent": {"name": agent_name, "display_name": agent_name},
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "estimated_cost_usd": cost,
            },
        },
    }


def _session(owner, updated_at, messages):
    return {"owner": owner, "created_at": updated_at, "updated_at": updated_at, "messages": messages}


def test_empty_input_gives_zeroed_totals():
    result = compute_usage_analytics([])
    assert result["total_conversations"] == 0
    assert result["total_messages"] == 0
    assert result["total_estimated_cost_usd"] == 0
    assert result["by_day"] == []


def test_totals_sum_across_sessions():
    sessions = [
        _session("alice::user", 1_735_000_000_000, [
            _bot_message("azure", "gpt-5.1", "default", 100, 50, 0.001),
        ]),
        _session("bob::admin", 1_735_100_000_000, [
            _bot_message("azure", "gpt-5.1", "default", 200, 100, 0.002),
        ]),
    ]
    result = compute_usage_analytics(sessions)
    assert result["total_conversations"] == 2
    assert result["total_messages"] == 2
    assert result["total_prompt_tokens"] == 300
    assert result["total_completion_tokens"] == 150
    assert round(result["total_estimated_cost_usd"], 3) == 0.003


def test_user_role_messages_are_ignored_not_bot():
    sessions = [_session("alice::user", 1_735_000_000_000, [
        {"role": "user", "text": "hello"},
        _bot_message("azure", "gpt-5.1", "default", 100, 50, 0.001),
    ])]
    result = compute_usage_analytics(sessions)
    assert result["total_messages"] == 1


def test_messages_without_usage_are_skipped_not_counted():
    sessions = [_session("alice::user", 1_735_000_000_000, [
        {"role": "bot", "text": "answer", "data": {"provider": "azure", "model": "gpt-5.1"}},
    ])]
    result = compute_usage_analytics(sessions)
    assert result["total_messages"] == 0
    assert result["total_conversations"] == 0


def test_missing_cost_estimate_is_counted_separately_not_treated_as_zero_spend():
    sessions = [_session("alice::user", 1_735_000_000_000, [
        _bot_message("azure", "some-unrecognized-model", "default", 100, 50, None),
    ])]
    result = compute_usage_analytics(sessions)
    assert result["total_messages"] == 1
    assert result["messages_without_cost_estimate"] == 1
    assert result["total_estimated_cost_usd"] == 0


def test_breakdown_by_agent_separates_personas():
    sessions = [_session("alice::user", 1_735_000_000_000, [
        _bot_message("azure", "gpt-5.1", "default", 100, 50, 0.001),
        _bot_message("azure", "gpt-5.1", "lyrical", 200, 100, 0.002),
    ])]
    result = compute_usage_analytics(sessions)
    agents = {row["agent"]: row for row in result["by_agent"]}
    assert agents["default"]["cost_usd"] == 0.001
    assert agents["lyrical"]["cost_usd"] == 0.002


def test_breakdown_by_owner_and_by_day_and_sorted_by_cost_desc():
    # 5 days apart -- guaranteed to land on different calendar days regardless
    # of local timezone, unlike a same-day-ish gap of a few hours.
    sessions = [
        _session("alice::user", 1_735_000_000_000, [
            _bot_message("azure", "gpt-5.1", "default", 100, 50, 0.001),
        ]),
        _session("bob::admin", 1_735_000_000_000 + 5 * 86_400_000, [
            _bot_message("azure", "gpt-5.1", "default", 1000, 500, 0.010),
        ]),
    ]
    result = compute_usage_analytics(sessions)
    owners = [row["owner"] for row in result["by_owner"]]
    assert owners[0] == "bob::admin"   # higher cost sorts first
    assert len(result["by_day"]) == 2  # two distinct calendar days
