"""GET/DELETE/export /sessions/{id} enforce the owner query param when it's
passed, closing the gap where only the /sessions list was scoped by login
identity. Uses the real app + real session files on disk (pure file I/O, no
LLM/Azure calls), cleaned up after each test.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def a_session():
    resp = client.post("/sessions", json={
        "title": "test", "agent": "default", "messages": [{"role": "user", "text": "hi"}],
        "owner": "alice::user",
    })
    session_id = resp.json()["id"]
    yield session_id
    client.delete(f"/sessions/{session_id}")   # best-effort cleanup, ignores 404


def test_get_without_owner_param_still_works(a_session):
    resp = client.get(f"/sessions/{a_session}")
    assert resp.status_code == 200


def test_get_with_matching_owner_works(a_session):
    resp = client.get(f"/sessions/{a_session}", params={"owner": "alice::user"})
    assert resp.status_code == 200


def test_get_with_wrong_owner_is_404(a_session):
    resp = client.get(f"/sessions/{a_session}", params={"owner": "bob::admin"})
    assert resp.status_code == 404


def test_delete_with_wrong_owner_is_404_and_does_not_delete(a_session):
    resp = client.delete(f"/sessions/{a_session}", params={"owner": "bob::admin"})
    assert resp.status_code == 404
    # still there afterwards -- the mismatched delete must not have gone through
    assert client.get(f"/sessions/{a_session}").status_code == 200


def test_delete_with_matching_owner_works(a_session):
    resp = client.delete(f"/sessions/{a_session}", params={"owner": "alice::user"})
    assert resp.status_code == 200
    assert client.get(f"/sessions/{a_session}").status_code == 404


def test_export_with_wrong_owner_is_404(a_session):
    resp = client.get(f"/sessions/{a_session}/export", params={"owner": "bob::admin"})
    assert resp.status_code == 404
