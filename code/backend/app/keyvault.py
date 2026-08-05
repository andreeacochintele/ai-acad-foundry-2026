"""Azure Key Vault — an optional, keyless source for the secrets that would
otherwise sit in plaintext in .env.

Pull-based and additive: this never touches .env and never overrides a value
you set locally — it only fills in the ones you left blank, and only when
AZURE_KEY_VAULT_URL is configured. Same DefaultAzureCredential the rest of
the app already uses for Azure Foundry, so there's no separate key or client
secret to manage for the vault itself (a managed identity in production, your
`az login` locally).

Provision a vault and push your current .env secrets into it with
scripts/azure/08-provision-keyvault.ps1 (or .sh) — see that script's own
comment header, and README.md § Credentials.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# settings attribute -> secret name in the vault. Explicit and short rather
# than "every field ending in _key" — this is every secret the app has, and
# it should stay obvious exactly which ones the vault is ever asked for.
SECRET_FIELDS: dict[str, str] = {
    "azure_ai_api_key": "azure-ai-api-key",
    "azure_speech_key": "azure-speech-key",
    "azure_search_key": "azure-search-key",
    "openai_api_key": "openai-api-key",
    "anthropic_api_key": "anthropic-api-key",
    "search_api_key": "search-api-key",
}


def apply_key_vault_secrets(settings) -> None:
    """Fill in any of `SECRET_FIELDS` still empty on `settings`, from the
    vault named by `settings.azure_key_vault_url`. No-op if that's unset —
    the app works exactly as before for anyone not using a vault."""
    if not settings.azure_key_vault_url:
        return

    from azure.identity import DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient

    client = SecretClient(
        vault_url=settings.azure_key_vault_url, credential=DefaultAzureCredential(),
    )

    for attr, secret_name in SECRET_FIELDS.items():
        if getattr(settings, attr):
            continue  # .env (or the environment) already set this one — it wins
        try:
            setattr(settings, attr, client.get_secret(secret_name).value)
            logger.info("Loaded '%s' from Key Vault", secret_name)
        except Exception as e:
            # A vault with only some secrets populated is normal (e.g. you
            # only ever configured Azure, never Anthropic) — this is not
            # fatal, the field just stays empty like it would with no vault.
            logger.debug("Could not load '%s' from Key Vault: %s", secret_name, e)
