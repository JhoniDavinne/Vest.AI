# Baixa o avatar humano CC0 usado pelo provador 3D.
# Origem: https://github.com/BoQsc/Godot-3D-Male-Base-Mesh (CC0 1.0)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "apps\web\public\models\avatar"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$glb = "https://raw.githubusercontent.com/BoQsc/Godot-3D-Male-Base-Mesh/main/Original/male_base_mesh.glb"
$lic = "https://raw.githubusercontent.com/BoQsc/Godot-3D-Male-Base-Mesh/main/LICENSE"

curl.exe -L --fail -o (Join-Path $dest "avatar_base.glb") $glb
curl.exe -L --fail -o (Join-Path $dest "LICENSE") $lic
Write-Host "OK:" (Join-Path $dest "avatar_base.glb")
