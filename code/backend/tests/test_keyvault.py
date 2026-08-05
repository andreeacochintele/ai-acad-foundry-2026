from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.keyvault import SECRET_FIELDS, apply_key_vault_secrets


def _settings(**overrides):
    base = {"azure_key_vault_url": "", **{attr: "" for attr in SECRET_FIELDS}}
    base.update(overrides)
    return SimpleNamespace(**base)


def test_noop_when_no_vault_url_configured():
    settings = _settings()
    with patch("azure.keyvault.secrets.SecretClient") as MockClient:
        apply_key_vault_secrets(settings)
    MockClient.assert_not_called()


def test_fills_in_an_empty_secret_from_the_vault():
    settings = _settings(azure_key_vault_url="https://kv-test.vault.azure.net/")
    with patch("azure.identity.DefaultAzureCredential"), \
         patch("azure.keyvault.secrets.SecretClient") as MockClient:
        MockClient.return_value.get_secret.return_value = MagicMock(value="sk-from-vault")
        apply_key_vault_secrets(settings)
    assert settings.openai_api_key == "sk-from-vault"


def test_does_not_override_a_value_already_set_locally():
    settings = _settings(azure_key_vault_url="https://kv-test.vault.azure.net/",
                          openai_api_key="sk-from-dotenv")
    with patch("azure.identity.DefaultAzureCredential"), \
         patch("azure.keyvault.secrets.SecretClient") as MockClient:
        MockClient.return_value.get_secret.return_value = MagicMock(value="sk-from-vault")
        apply_key_vault_secrets(settings)
    assert settings.openai_api_key == "sk-from-dotenv"
    requested = [c.args[0] for c in MockClient.return_value.get_secret.call_args_list]
    assert "openai-api-key" not in requested


def test_requests_every_known_secret_by_its_vault_name():
    settings = _settings(azure_key_vault_url="https://kv-test.vault.azure.net/")
    with patch("azure.identity.DefaultAzureCredential"), \
         patch("azure.keyvault.secrets.SecretClient") as MockClient:
        MockClient.return_value.get_secret.return_value = MagicMock(value="x")
        apply_key_vault_secrets(settings)
    requested = {c.args[0] for c in MockClient.return_value.get_secret.call_args_list}
    assert requested == set(SECRET_FIELDS.values())


def test_a_secret_missing_from_the_vault_does_not_crash_startup():
    settings = _settings(azure_key_vault_url="https://kv-test.vault.azure.net/")
    with patch("azure.identity.DefaultAzureCredential"), \
         patch("azure.keyvault.secrets.SecretClient") as MockClient:
        MockClient.return_value.get_secret.side_effect = Exception("SecretNotFound")
        apply_key_vault_secrets(settings)   # must not raise
    assert settings.openai_api_key == ""
