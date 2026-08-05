<#
.SYNOPSIS
  Create an Azure Key Vault and push the secrets already sitting in your .env
  into it, RBAC-authorized, keyless to read back.

.DESCRIPTION
  Six settings in app/config.py are secrets (API keys) rather than plain
  configuration: AZURE_AI_API_KEY, AZURE_SPEECH_KEY, AZURE_SEARCH_KEY,
  OPENAI_API_KEY, ANTHROPIC_API_KEY, SEARCH_API_KEY. Today they sit in
  plaintext in .env, which is fine for a local `az login` dev loop but not
  what you'd want in a shared or deployed environment.

  This script creates the vault (RBAC-authorized, not the older access-policy
  model), grants your signed-in identity the "Key Vault Secrets Officer" role
  so you can write to it, and — for each of the six settings that has a
  non-empty value in your .env — pushes it into the vault under a matching
  kebab-case name (e.g. OPENAI_API_KEY -> openai-api-key). It never writes a
  secret value back into .env; the only line it offers to add is
  AZURE_KEY_VAULT_URL, which points the app at the vault. See
  app/keyvault.py for the read side: it fills in any of those six fields
  still blank in .env from the vault, using the same DefaultAzureCredential
  the rest of the app already uses — no separate key to manage.

  Idempotent: every step checks before it creates or overwrites.

.EXAMPLE
  ./08-provision-keyvault.ps1
  ./08-provision-keyvault.ps1 -ResourceGroup rg-ai-course -Name kv-ana
#>
param(
    [string]$ResourceGroup = "moch-ai-acad",
    [string]$Name          = "kv-moch-acad",
    [string]$Location      = "swedencentral"
)

$ErrorActionPreference = "Stop"
function Step($n, $t) { Write-Host "`n[$n] $t" -ForegroundColor Cyan }

# settings key (as it appears in .env) -> secret name in the vault
$SecretMap = [ordered]@{
    "AZURE_AI_API_KEY"  = "azure-ai-api-key"
    "AZURE_SPEECH_KEY"  = "azure-speech-key"
    "AZURE_SEARCH_KEY"  = "azure-search-key"
    "OPENAI_API_KEY"    = "openai-api-key"
    "ANTHROPIC_API_KEY" = "anthropic-api-key"
    "SEARCH_API_KEY"    = "search-api-key"
}

# --- 0 · who are we -----------------------------------------------------------
Step 0 "Signed-in identity and subscription"
$account = az account show -o json | ConvertFrom-Json
Write-Host "    user         : $($account.user.name)"
Write-Host "    subscription : $($account.name)  ($($account.id))"

# --- 1 · the resource group ---------------------------------------------------
Step 1 "Resource group '$ResourceGroup'"
if ((az group exists --name $ResourceGroup) -eq "true") {
    Write-Host "    exists" -ForegroundColor DarkGray
} else {
    az group create --name $ResourceGroup --location $Location -o none
    Write-Host "    created in $Location" -ForegroundColor Green
}

# --- 2 · the vault --------------------------------------------------------------
# --enable-rbac-authorization: roles via Azure RBAC (az role assignment), not the
# older vault-local access-policy model — one permission system for everything,
# same as the rest of this course's resources.
Step 2 "Key Vault '$Name'"
$existing = az keyvault show --name $Name --resource-group $ResourceGroup -o json 2>$null
if ($existing) {
    Write-Host "    exists" -ForegroundColor DarkGray
} else {
    az keyvault create --name $Name --resource-group $ResourceGroup --location $Location `
        --enable-rbac-authorization true -o none
    Write-Host "    created" -ForegroundColor Green
}
$vaultUrl = "https://$Name.vault.azure.net/"
$vaultId  = az keyvault show --name $Name --resource-group $ResourceGroup --query id -o tsv

# --- 3 · permission to write secrets -------------------------------------------
Step 3 "Role: Key Vault Secrets Officer (read + write)"
$objectId = az ad signed-in-user show --query id -o tsv
$held = az role assignment list --assignee $objectId --scope $vaultId `
           --query "[?roleDefinitionName=='Key Vault Secrets Officer'] | length(@)" -o tsv
if ($held -eq "0") {
    az role assignment create --assignee $objectId --role "Key Vault Secrets Officer" `
        --scope $vaultId -o none
    Write-Host "    granted — role assignments can take a minute to propagate" -ForegroundColor Green
} else {
    Write-Host "    already granted" -ForegroundColor DarkGray
}

# --- 4 · push whatever secrets .env already has --------------------------------
Step 4 "Pushing secrets from .env"
$envFile = Join-Path $PSScriptRoot "..\..\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "    no .env found at $envFile — nothing to push. Copy .env.example first." -ForegroundColor Yellow
} else {
    $lines = Get-Content $envFile
    $pushed = 0
    foreach ($envKey in $SecretMap.Keys) {
        $match = $lines | Where-Object { $_ -match "^$envKey=(.+)$" }
        if (-not $match) { continue }
        $value = ($match -replace "^$envKey=", "").Trim()
        if (-not $value) { continue }
        $secretName = $SecretMap[$envKey]
        az keyvault secret set --vault-name $Name --name $secretName --value $value -o none
        Write-Host "    pushed   : $secretName" -ForegroundColor Green
        $pushed++
    }
    if ($pushed -eq 0) {
        Write-Host "    none of the six secrets are set in .env yet — nothing to push" -ForegroundColor DarkGray
    }
}

# --- 5 · point the app at the vault ---------------------------------------------
Step 5 "Configuration"
Write-Host ""
Write-Host "  AZURE_KEY_VAULT_URL=$vaultUrl"
Write-Host ""
Write-Host "  This is the ONLY line that gets written to .env — the actual secret" -ForegroundColor DarkGray
Write-Host "  values live only in the vault from here on." -ForegroundColor DarkGray

if (Test-Path $envFile) {
    $answer = Read-Host "Write AZURE_KEY_VAULT_URL into $((Resolve-Path $envFile).Path)? [y/N]"
    if ($answer -eq "y") {
        $lines = Get-Content $envFile
        $pattern = "^AZURE_KEY_VAULT_URL="
        if ($lines -match $pattern) { $lines = $lines -replace "$pattern.*", "AZURE_KEY_VAULT_URL=$vaultUrl" }
        else                        { $lines += "AZURE_KEY_VAULT_URL=$vaultUrl" }
        Set-Content -Path $envFile -Value $lines -Encoding utf8
        Write-Host "    written" -ForegroundColor Green
    }
}

# --- 6 · next -------------------------------------------------------------------
Step 6 "Next"
Write-Host @"
    Restart the backend — app/keyvault.py fills in any of the six secret
    fields left blank in .env from this vault at startup, using your
    `az login` (or, in production, the container's managed identity — grant
    it the same "Key Vault Secrets Officer" role this script just granted
    you). A value already set directly in .env always wins; the vault only
    fills gaps.

    You can now safely delete the plaintext values from .env — they're in
    the vault. Keep AZURE_KEY_VAULT_URL, drop the rest.

    Portal: https://portal.azure.com/#@/resource$vaultId
"@
