import json

import app.users as users


def test_register_login_creates_a_new_entry(tmp_path, monkeypatch):
    monkeypatch.setattr(users, "USERS_FILE", tmp_path / "users.json")
    record = users.register_login("alice::user", "Alice", "user")
    assert record["owner"] == "alice::user"
    assert record["name"] == "Alice"
    assert record["role"] == "user"
    assert record["first_seen"] == record["last_seen"]


def test_repeat_login_keeps_first_seen_but_bumps_last_seen(tmp_path, monkeypatch):
    monkeypatch.setattr(users, "USERS_FILE", tmp_path / "users.json")
    first = users.register_login("alice::user", "Alice", "user")
    second = users.register_login("alice::user", "Alice", "user")
    assert second["first_seen"] == first["first_seen"]
    assert second["last_seen"] >= first["last_seen"]


def test_list_users_sorted_most_recent_first(tmp_path, monkeypatch):
    monkeypatch.setattr(users, "USERS_FILE", tmp_path / "users.json")
    users.register_login("alice::user", "Alice", "user")
    users.register_login("bob::admin", "Bob", "admin")
    result = users.list_users()
    assert [u["owner"] for u in result] == ["bob::admin", "alice::user"]


def test_write_is_atomic_no_leftover_tmp_file(tmp_path, monkeypatch):
    monkeypatch.setattr(users, "USERS_FILE", tmp_path / "users.json")
    users.register_login("alice::user", "Alice", "user")
    files = list(tmp_path.iterdir())
    assert files == [tmp_path / "users.json"]
    assert json.loads((tmp_path / "users.json").read_text(encoding="utf-8"))
