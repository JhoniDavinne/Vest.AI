# Clona (ou atualiza) o CatVTON oficial em apps/tryon/vendor/CatVTON e pina o commit auditado.
# Fonte: https://github.com/Zheng-Chong/CatVTON (branch padrao `edited`). Licenca: CC BY-NC-SA 4.0 (nao comercial).
$ErrorActionPreference = "Stop"

$Repo   = "https://github.com/Zheng-Chong/CatVTON.git"
$Commit = "7818397f25613beedb3d861a34769f607cfcf3b1"
$Root   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Target = Join-Path $Root "vendor\CatVTON"

if (-not (Test-Path (Join-Path $Target ".git"))) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
    git clone --quiet $Repo $Target
}
Push-Location $Target
try {
    git fetch --quiet origin
    git checkout --quiet $Commit
    Write-Host "CatVTON em $Target @ $(git rev-parse --short HEAD)"
} finally {
    Pop-Location
}
