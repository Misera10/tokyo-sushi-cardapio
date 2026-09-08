param(
  [string]$ProjectName = "tokyo-sushi"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Preparando build de producao em dist/..." -ForegroundColor Cyan

if (Test-Path dist) {
  Remove-Item -Recurse -Force dist
}
New-Item -ItemType Directory -Path dist | Out-Null

$files = @(
  'index.html', 'admin.html', 'app.js', 'admin.js', 'db.js', 'config.js',
  'menu-data.js', 'schedule.js', 'styles.css', 'admin.css', 'icon.svg',
  'manifest.webmanifest', 'admin-manifest.webmanifest', '_headers',
  'sw.js', 'sw-v20260908.js', 'sw-v20260817.js'
)

foreach ($f in $files) {
  if (Test-Path $f) {
    Copy-Item -Path $f -Destination "dist/$f"
  }
}

if (Test-Path assets) {
  Copy-Item -Path assets -Destination dist/assets -Recurse
}

Write-Host "Publicando no Cloudflare Pages (projeto: $ProjectName)..." -ForegroundColor Cyan
npx wrangler pages deploy dist --project-name=$ProjectName --commit-dirty=true

Write-Host "Deploy finalizado com sucesso!" -ForegroundColor Green
