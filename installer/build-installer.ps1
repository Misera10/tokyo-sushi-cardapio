$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repoRoot "printer-agent\TokyoSushi.PrintAgent.csproj"
$publish = Join-Path $repoRoot "printer-agent\publish"
$dotnet = if ($env:TOKYO_PRINT_DOTNET_PATH) {
    $env:TOKYO_PRINT_DOTNET_PATH
} else {
    (Get-Command dotnet -ErrorAction SilentlyContinue)?.Source
}
$compilerCandidates = @(
    $env:TOKYO_PRINT_ISCC_PATH,
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    (Join-Path $env:LOCALAPPDATA "TokyoSushi\BuildTools\inno-6.7.3\ISCC.exe")
) | Where-Object { $_ -and (Test-Path $_) }
$compiler = $compilerCandidates | Select-Object -First 1
$script = Join-Path $PSScriptRoot "TokyoSushiPrint.iss"

if ([string]::IsNullOrWhiteSpace($dotnet) -or -not (Test-Path $dotnet)) { throw "dotnet não encontrado. Defina TOKYO_PRINT_DOTNET_PATH ou instale o SDK do .NET." }
if (-not $compiler) { throw "Inno Setup não encontrado. Defina TOKYO_PRINT_ISCC_PATH ou instale o Inno Setup." }

& $dotnet publish $project --configuration Release --runtime win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true --output $publish
if ($LASTEXITCODE -ne 0) { throw "Falha ao publicar o agente." }
if (-not (Test-Path (Join-Path $publish "TokyoSushi.PrintAgent.exe"))) { throw "O executável publicado não foi encontrado." }

& $compiler $script
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o instalador Inno Setup." }

$installer = Join-Path $PSScriptRoot "output\TokyoPrintSetup-v0.4.1.exe"
if (-not (Test-Path $installer)) { throw "O instalador não foi encontrado após a compilação." }
Write-Host "Instalador criado em: $installer"
