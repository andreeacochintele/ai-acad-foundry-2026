"""Access control for hosted agents on the shared Foundry project.

An agent stamped with `created_by` (set at creation time, see
foundry_agent.deploy) is exclusively that owner's. An unstamped agent
(created before this existed, or via the CLI/portal) falls back to the same
visibility heuristic the agent picker uses: your own local personas, plus
whatever FOUNDRY_VISIBLE_EXTRA allow-lists.
"""
from types import SimpleNamespace
from unittest.mock import patch

from app.main import _may_access_hosted, _visible_hosted_names


def _persona(name):
    return SimpleNamespace(name=name)


def test_visible_hosted_names_includes_local_personas_and_extra(monkeypatch):
    monkeypatch.setattr("app.main.settings.foundry_visible_extra", "shared-one, shared-two")
    with patch("app.main.list_personas", return_value=[_persona("default"), _persona("lyrical")]):
        assert _visible_hosted_names() == {"default", "lyrical", "shared-one", "shared-two"}


def test_stamped_agent_accessible_only_by_its_creator(monkeypatch):
    monkeypatch.setattr("app.main.settings.foundry_visible_extra", "")
    with patch("app.main.list_personas", return_value=[]):
        agent = {"name": "helper", "created_by": "alice::user"}
        assert _may_access_hosted(agent, "alice::user") is True
        assert _may_access_hosted(agent, "bob::admin") is False
        assert _may_access_hosted(agent, None) is False


def test_stamped_agent_ignores_the_visibility_fallback():
    # A different creator's stamp wins even if the name matches a local persona
    # you happen to have -- name-matching is not a substitute for the stamp.
    with patch("app.main.list_personas", return_value=[_persona("helper")]):
        agent = {"name": "helper", "created_by": "alice::user"}
        assert _may_access_hosted(agent, "bob::admin") is False


def test_unstamped_agent_falls_back_to_local_persona_visibility(monkeypatch):
    monkeypatch.setattr("app.main.settings.foundry_visible_extra", "")
    with patch("app.main.list_personas", return_value=[_persona("helper")]):
        assert _may_access_hosted({"name": "helper", "created_by": None}, "anyone") is True
        assert _may_access_hosted({"name": "other", "created_by": None}, "anyone") is False


def test_unstamped_agent_visible_via_foundry_visible_extra(monkeypatch):
    monkeypatch.setattr("app.main.settings.foundry_visible_extra", "classmates-agent")
    with patch("app.main.list_personas", return_value=[]):
        agent = {"name": "classmates-agent", "created_by": None}
        assert _may_access_hosted(agent, None) is True
