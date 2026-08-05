#!/usr/bin/env bash
# Create an Azure Key Vault and push the secrets already in .env into it.
#
#   ./08-provision-keyvault.sh [resource-group] [name] [location]
#
# Six settings in app/config.py are secrets rather than plain config:
# AZURE_AI_API_KEY, AZURE_SPEECH_KEY, AZURE_SEARCH_KEY, OPENAI_API_KEY,
# ANTHROPIC_API_KEY, SEARCH_API_KEY. This creates an RBAC-authorized vault,
# grants your signed-in identity write access, and pushes whichever of the
# six are already non-empty in .env under a matching kebab-case secret name
# (OPENAI_API_KEY -> openai-api-key). It never writes a secret value back
# into .env — only prints the one line (AZURE_KEY_VAULT_URL) that points the
# app at the vault; app/keyvault.py reads it back at startup with the same
# DefaultAzureCredential the rest of the app already uses.
#
# Idempotent: every step checks before it creates or overwrites.
set -euo pipefail

RG=${1:-moch-ai-acad}
NAME=${2:-kv-moch-acad}
LOCATION=${3:-swedencentral}

step() { printf '\n\033[36m[%s] %s\033[0m\n' "$1" "$2"; }

# .env key -> secret name in the vault
declare -A SECRET_MAP=(
  [AZURE_AI_API_KEY]=azure-ai-api-key
  [AZURE_SPEECH_KEY]=azure-speech-key
  [AZURE_SEARCH_KEY]=azure-search-key
  [OPENAI_API_KEY]=openai-api-key
  [ANTHROPIC_API_KEY]=anthropic-api-key
  [SEARCH_API_KEY]=search-api-key
)

step 0 "Signed-in identity and subscription"
az account show --query '{user:user.name, subscription:name, id:id}' -o tsv | tr '\t' '\n' | sed 's/^/    /'

step 1 "Resource group '$RG'"
if [ "$(az group exists --name "$RG")" = "true" ]; then
  echo "    exists"
else
  az group create --name "$RG" --location "$LOCATION" -o none
  echo "    created in $LOCATION"
fi

step 2 "Key Vault '$NAME'"
if az keyvault show --name "$NAME" --resource-group "$RG" -o none 2>/dev/null; then
  echo "    exists"
else
  az keyvault create --name "$NAME" --resource-group "$RG" --location "$LOCATION" \
    --enable-rbac-authorization true -o none
  echo "    created"
fi
VAULT_URL="https://$NAME.vault.azure.net/"
VAULT_ID=$(az keyvault show --name "$NAME" --resource-group "$RG" --query id -o tsv)

step 3 "Role: Key Vault Secrets Officer (read + write)"
OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)
HELD=$(az role assignment list --assignee "$OBJECT_ID" --scope "$VAULT_ID" \
         --query "[?roleDefinitionName=='Key Vault Secrets Officer'] | length(@)" -o tsv)
if [ "$HELD" = "0" ]; then
  az role assignment create --assignee "$OBJECT_ID" --role "Key Vault Secrets Officer" \
    --scope "$VAULT_ID" -o none
  echo "    granted — role assignments can take a minute to propagate"
else
  echo "    already granted"
fi

step 4 "Pushing secrets from .env"
ENV_FILE="$(dirname "$0")/../../.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "    no .env found at $ENV_FILE — nothing to push. Copy .env.example first."
else
  pushed=0
  for env_key in "${!SECRET_MAP[@]}"; do
    value=$(grep -E "^${env_key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true)
    [ -z "$value" ] && continue
    secret_name="${SECRET_MAP[$env_key]}"
    az keyvault secret set --vault-name "$NAME" --name "$secret_name" --value "$value" -o none
    echo "    pushed   : $secret_name"
    pushed=$((pushed + 1))
  done
  [ "$pushed" -eq 0 ] && echo "    none of the six secrets are set in .env yet — nothing to push"
fi

step 5 "Configuration — paste into code/backend/.env"
cat <<EOF

  AZURE_KEY_VAULT_URL=$VAULT_URL

  This is the ONLY line to add to .env — the secret values live only in the
  vault from here on. You can now delete the plaintext values from .env.

EOF

step 6 "Next"
cat <<EOF
    Restart the backend — app/keyvault.py fills in any of the six secret
    fields left blank in .env from this vault at startup, using your
    az login (or, in production, the container's managed identity — grant
    it the same "Key Vault Secrets Officer" role granted above). A value
    already set directly in .env always wins; the vault only fills gaps.

    Portal: https://portal.azure.com/#@/resource$VAULT_ID
EOF
