$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repoRoot "printer-agent\TokyoSushi.PrintAgent.csproj"
$publish = Join-Path $repoRoot "printer-agent\publish"
$compiler = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
$script = Join-Path $PSScriptRoot "TokyoSushiPrint.iss"

if (-not (Test-Path $compiler)) { throw "Inno Setup não encontrado em $compiler" }

& dotnet publish $project --configuration Release --runtime win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true --output $publish
if ($LASTEXITCODE -ne 0) { throw "Falha ao publicar o agente." }

& $compiler $script
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o instalador Inno Setup." }

$installer = Join-Path $PSScriptRoot "output\TokyoPrintSetup.exe"
Write-Host "Instalador criado em: $installer"
