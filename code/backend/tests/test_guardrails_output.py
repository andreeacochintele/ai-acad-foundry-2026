from app.guardrails import output_gr


def test_normal_answer_is_clean():
    answer = "The Standard Mortgage requires a 15 percent minimum down payment for a first home."
    assert output_gr.run(answer) == []


def test_empty_output_is_flagged():
    assert output_gr.check_empty("") != []
    assert output_gr.check_empty("   ") != []
    assert output_gr.check_empty("An answer.") == []


def test_pii_leak_reuses_input_patterns():
    assert output_gr.check_pii_leak("Send your confirmation to andreea@example.com.") != []


def test_blocked_terms_placeholder_list_is_empty_by_default():
    # BLOCKED_TERMS is a placeholder for a real moderation list -- until one
    # is configured, nothing should ever match.
    assert output_gr.check_blocked_terms("literally anything, even a slur") == []
