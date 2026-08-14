param(
  [string]$ProjectRef = "gbeiwxqrtohogmkzdoql",
  [string]$OutputRoot = (Join-Path (Get-Location) "backups")
)

$ErrorActionPreference = "Stop"
$serviceKey = $env:TKS_SUPABASE_SERVICE_ROLE_KEY
if ([string]::IsNullOrWhiteSpace($serviceKey)) {
  throw "Defina TKS_SUPABASE_SERVICE_ROLE_KEY apenas no ambiente local/seguro antes de exportar. Nunca coloque a chave no Git."
}

$baseUrl = "https://$ProjectRef.supabase.co/rest/v1"
$backupId = "{0}-{1}" -f $ProjectRef, (Get-Date -Format "yyyyMMdd-HHmmss")
$backupDir = Join-Path $OutputRoot $backupId
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$headers = @{
  apikey = $serviceKey
  Authorization = "Bearer $serviceKey"
  Prefer = "count=exact"
}

$tables = [ordered]@{
  tks_products = "id"
  tks_complements = "id"
  tks_promos = "id"
  tks_settings = "key"
  tks_orders = "id"
  tks_expenses = "id"
  tks_finance_daily_revenues = "id"
  tks_cash_sessions = "id"
  tks_cash_movements = "id"
  tks_push_subscriptions = "id"
  tks_admins = "user_id"
}

$manifestTables = @()
foreach ($table in $tables.Keys) {
  $primaryKey = $tables[$table]
  $rows = @()
  $offset = 0
  do {
    $uri = "$baseUrl/$table?select=*&order=$primaryKey.asc&limit=1000&offset=$offset"
    $response = Invoke-WebRequest -Uri $uri -Headers $headers -UseBasicParsing
    $page = @($response.Content | ConvertFrom-Json)
    $rows += $page
    $offset += $page.Count
  } while ($page.Count -eq 1000)

  $rows | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath (Join-Path $backupDir "$table.json") -Encoding utf8
  $manifestTables += [pscustomobject]@{ table = $table; rows = $rows.Count; file = "$table.json" }
}

$manifest = [pscustomobject]@{
  format = "tokyo-sushi-tks-backup-v1"
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  project_ref = $ProjectRef
  tables = $manifestTables
  note = "Dados tks_* exportados via REST autenticado. A chave usada não é armazenada no backup."
}
$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $backupDir "backup-manifest.json") -Encoding utf8
Write-Output "Backup criado em: $backupDir"
