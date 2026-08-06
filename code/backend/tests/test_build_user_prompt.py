from app.agents.local_agent import build_user_prompt


def test_plain_question_with_nothing_attached():
    assert build_user_prompt("What is the rate?", []) == "What is the rate?"


def test_attached_document_gets_its_own_labelled_block():
    prompt = build_user_prompt("Summarize this.", [], attached_document="Loan amount: 100000 EUR.")
    assert "ATTACHED DOCUMENT" in prompt
    assert "Loan amount: 100000 EUR." in prompt
    assert "QUESTION:\nSummarize this." in prompt


def test_attached_document_is_not_mixed_into_retrieved_context():
    chunks = [{"score": 0.9, "text": "Standard down payment is 15%."}]
    prompt = build_user_prompt("Compare these.", chunks, attached_document="My statement says 20%.")
    # Both sections exist, and the attached text never gets a fake similarity score
    assert "CONTEXT — retrieved passages" in prompt
    assert "ATTACHED DOCUMENT" in prompt
    assert "(score 0.9) Standard down payment is 15%." in prompt
    assert "(score" not in prompt.split("ATTACHED DOCUMENT")[1].split("CONTEXT")[0]


def test_attached_document_alone_triggers_the_non_empty_prompt_path():
    # No chunks, no history -- attached_document alone must still stop the
    # early-return-just-the-question shortcut.
    prompt = build_user_prompt("What does this say?", [], attached_document="Some file content.")
    assert prompt != "What does this say?"
    assert "Some file content." in prompt


def test_history_attached_document_and_chunks_all_present_together():
    history = [{"role": "user", "text": "hi"}, {"role": "bot", "text": "hello"}]
    chunks = [{"score": 0.5, "text": "chunk text"}]
    prompt = build_user_prompt("follow-up", chunks, history=history, attached_document="doc text")
    assert "PRIOR CONVERSATION" in prompt
    assert "ATTACHED DOCUMENT" in prompt
    assert "CONTEXT — retrieved passages" in prompt
    # order: history, then attached document, then retrieved context, then question
    assert prompt.index("PRIOR CONVERSATION") < prompt.index("ATTACHED DOCUMENT")
    assert prompt.index("ATTACHED DOCUMENT") < prompt.index("CONTEXT")
    assert prompt.index("CONTEXT") < prompt.index("QUESTION:")
