"""Regression tests for the model/provider allowlist.

Written after discovering that every configured default model for two of the
four supported providers (anthropic's claude-sonnet-5, lmstudio's
google/gemma-3-4b) was being rejected by the guardrail meant to approve them.
"""
from app.guardrails import model_gr


def test_azure_default_model_is_approved():
    assert model_gr.check_model("azure", "gpt-5.1") == []


def test_openai_default_model_is_approved():
    assert model_gr.check_model("openai", "gpt-5.4-nano") == []


def test_anthropic_sonnet_is_approved():
    assert model_gr.check_model("anthropic", "claude-sonnet-5") == []


def test_anthropic_haiku_is_approved():
    assert model_gr.check_model("anthropic", "claude-haiku-4-5") == []


def test_anthropic_opus_is_approved():
    assert model_gr.check_model("anthropic", "claude-opus-5") == []


def test_lmstudio_any_local_model_is_approved():
    # lmstudio is local/offline -- the caller already fully controls what's
    # loaded, so the allowlist doesn't apply to it at all.
    assert model_gr.check_model("lmstudio", "google/gemma-3-4b") == []
    assert model_gr.check_model("lmstudio", "mistral-7b-instruct") == []


def test_unapproved_cloud_model_is_rejected():
    reasons = model_gr.check_model("openai", "text-davinci-003")
    assert len(reasons) == 1
    assert "not on the approved list" in reasons[0]


def test_unsupported_provider_is_rejected():
    assert model_gr.check_provider("cohere") != []
    assert model_gr.check_provider("azure") == []


def test_temperature_bounds():
    assert model_gr.check_temperature(0.2) == []
    assert model_gr.check_temperature(2.0) == []
    assert model_gr.check_temperature(2.1) != []
    assert model_gr.check_temperature(-0.1) != []


def test_max_tokens_bounds():
    assert model_gr.check_max_tokens(2500) == []
    assert model_gr.check_max_tokens(0) != []
    assert model_gr.check_max_tokens(-10) != []
    assert model_gr.check_max_tokens(model_gr.MAX_TOKENS_CEILING + 1) != []


def test_run_combines_every_check():
    # A request that's wrong on every axis at once should report all of them,
    # not just the first one found.
    reasons = model_gr.run("carrier-pigeon", "gpt-1", -5, -5)
    assert len(reasons) == 4
