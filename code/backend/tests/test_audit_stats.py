from app.analytics import compute_audit_stats


def _bot(answer, augmented, retrieved_count, completion_tokens=100, fact_check=None):
    return {
        "role": "bot",
        "text": answer,
        "data": {
            "answer": answer,
            "augmented": augmented,
            "retrieved": [{"id": str(i)} for i in range(retrieved_count)],
            "usage": {"completion_tokens": completion_tokens},
            "fact_check": fact_check,
        },
    }


def _session(owner, messages):
    return {"owner": owner, "messages": messages}


def _row(result, owner):
    return next(r for r in result["by_owner"] if r["owner"] == owner)


def test_empty_input_gives_no_rows():
    assert compute_audit_stats([]) == {"by_owner": []}


def test_grounded_risk_ungrounded_classified_correctly():
    sessions = [_session("alice::user", [
        _bot("a1", augmented=True, retrieved_count=2),    # grounded
        _bot("a2", augmented=True, retrieved_count=0),    # risk
        _bot("a3", augmented=False, retrieved_count=0),   # ungrounded (RAG off)
    ])]
    row = _row(compute_audit_stats(sessions), "alice::user")
    assert row["messages"] == 3
    assert row["grounded"] == 1
    assert row["risk"] == 1
    assert row["ungrounded"] == 1
    assert row["grounded_pct"] == round(100 / 3, 1)


def test_answer_length_and_retrieved_and_tokens_are_averaged():
    sessions = [_session("bob::admin", [
        _bot("12345", augmented=True, retrieved_count=2, completion_tokens=100),
        _bot("1234567890", augmented=True, retrieved_count=4, completion_tokens=200),
    ])]
    row = _row(compute_audit_stats(sessions), "bob::admin")
    assert row["avg_answer_chars"] == round((5 + 10) / 2)
    assert row["avg_retrieved"] == 3.0
    assert row["avg_completion_tokens"] == 150


def test_fact_check_verdicts_are_counted():
    sessions = [_session("alice::user", [
        _bot("a1", True, 1, fact_check={"verdict": "supported"}),
        _bot("a2", True, 1, fact_check={"verdict": "contradicted"}),
        _bot("a3", True, 1, fact_check={"verdict": "unclear"}),
        _bot("a4", True, 1, fact_check=None),
    ])]
    row = _row(compute_audit_stats(sessions), "alice::user")
    assert row["fact_checked"] == 3
    assert row["fact_supported"] == 1
    assert row["fact_contradicted"] == 1
    assert row["fact_unclear"] == 1


def test_conversation_with_no_answered_turns_still_counted():
    # A brand-new conversation with only a user message (nothing answered
    # yet) must still show up with its conversation count, not vanish.
    sessions = [_session("alice::user", [{"role": "user", "text": "hi"}])]
    row = _row(compute_audit_stats(sessions), "alice::user")
    assert row["conversations"] == 1
    assert row["messages"] == 0
    assert row["avg_answer_chars"] == 0


def test_conversations_counted_per_owner_across_multiple_sessions():
    sessions = [
        _session("alice::user", [_bot("a1", True, 1)]),
        _session("alice::user", [_bot("a2", True, 1)]),
        _session("bob::admin", [_bot("b1", True, 1)]),
    ]
    result = compute_audit_stats(sessions)
    assert _row(result, "alice::user")["conversations"] == 2
    assert _row(result, "bob::admin")["conversations"] == 1


def test_owners_are_kept_separate():
    sessions = [
        _session("alice::user", [_bot("a1", True, 1)]),
        _session("bob::admin", [_bot("b1", False, 0)]),
    ]
    result = compute_audit_stats(sessions)
    assert {r["owner"] for r in result["by_owner"]} == {"alice::user", "bob::admin"}


def test_known_owner_with_no_sessions_still_appears_zeroed():
    sessions = [_session("alice::user", [_bot("a1", True, 1)])]
    result = compute_audit_stats(sessions, known_owners=["alice::user", "carol::user"])
    row = _row(result, "carol::user")
    assert row["conversations"] == 0
    assert row["messages"] == 0
    assert row["avg_answer_chars"] == 0


def test_response_never_contains_the_actual_question_or_answer_text():
    # The whole point of this endpoint: an admin gets signals, never content.
    secret_answer = "the customer's actual sensitive answer text"
    sessions = [_session("alice::user", [_bot(secret_answer, True, 1)])]
    result = compute_audit_stats(sessions)
    dumped = str(result)
    assert secret_answer not in dumped
    assert "answer" not in result["by_owner"][0]
    assert "question" not in result["by_owner"][0]
