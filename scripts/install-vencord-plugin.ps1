param(
    [string]$VencordDir = "",
    [string]$PluginDirName = "questTracker",
    [switch]$Build
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not $VencordDir) {
    $VencordDir = Join-Path $repoRoot "..\Vencord"
}

if (-not (Test-Path $VencordDir)) {
    Write-Error "Vencord directory not found: $VencordDir`nClone it first:`n  git clone https://github.com/Vendicated/Vencord `"$VencordDir`""
    exit 1
}

$dest = Join-Path $VencordDir "src\userplugins\$PluginDirName"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

foreach ($file in @("index.tsx", "quests.ts", "i18n.ts")) {
    $source = Join-Path $repoRoot "src\$file"
    if (-not (Test-Path $source)) {
        throw "Missing source file: $source"
    }
    Copy-Item $source (Join-Path $dest $file) -Force
}

Write-Host "QuestTracker copied to: $dest"
Write-Host "Important:"
Write-Host "  - The folder name must be camelCase (example: questTracker)"
Write-Host "  - Vencord must be built from source"
Write-Host "  - This plugin is read-only and does not automate Discord activity"

if ($Build) {
    Write-Host "Building Vencord from source..."
    Push-Location $VencordDir
    try {
        pnpm install --frozen-lockfile
        pnpm build
        pnpm inject
    }
    finally {
        Pop-Location
    }
    Write-Host "Done. Restart Discord and open Settings -> Vencord -> Plugins."
}
