from app.cost import estimate_cost_usd


def test_lmstudio_is_always_free():
    assert estimate_cost_usd("lmstudio", "google/gemma-3-4b", 10_000, 10_000) == 0.0


def test_known_model_computes_a_positive_cost():
    cost = estimate_cost_usd("azure", "gpt-5.1", 1000, 500)
    assert cost is not None
    assert cost > 0


def test_cheaper_model_costs_less_for_the_same_usage():
    nano = estimate_cost_usd("openai", "gpt-5.4-nano", 1000, 500)
    full = estimate_cost_usd("openai", "gpt-5.1", 1000, 500)
    assert nano < full


def test_unrecognized_model_returns_none_not_a_guess():
    assert estimate_cost_usd("azure", "some-future-deployment-name", 1000, 500) is None


def test_no_usage_reported_returns_none():
    assert estimate_cost_usd("azure", "gpt-5.1", None, None) is None


def test_matches_claude_tiers_distinctly():
    haiku = estimate_cost_usd("anthropic", "claude-haiku-4-5", 1000, 1000)
    sonnet = estimate_cost_usd("anthropic", "claude-sonnet-5", 1000, 1000)
    opus = estimate_cost_usd("anthropic", "claude-opus-5", 1000, 1000)
    assert haiku < sonnet < opus
