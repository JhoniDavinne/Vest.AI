# Converte um avatar humano (GLB/GLTF/FBX) para apps/web/public/models/avatar/avatar_base.glb
# sem Blender. Prefere ferramentas CLI: assimp, FBX2glTF, gltf-transform.
#
# Uso:
#   .\scripts\convert_avatar.ps1 -InputPath .\meu_avatar.fbx
#   .\scripts\convert_avatar.ps1 -InputPath .\meu_avatar.glb

param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$destDir = Join-Path $root "apps\web\public\models\avatar"
$dest = Join-Path $destDir "avatar_base.glb"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

if (-not (Test-Path $InputPath)) {
    throw "Arquivo nao encontrado: $InputPath"
}

$ext = [IO.Path]::GetExtension($InputPath).ToLowerInvariant()
$resolved = (Resolve-Path $InputPath).Path

function Find-Cmd([string]$name) {
    return Get-Command $name -ErrorAction SilentlyContinue
}

if ($ext -eq ".glb") {
    Copy-Item -Force $resolved $dest
    Write-Host "Copiado GLB para $dest"
    exit 0
}

if ($ext -eq ".gltf") {
    $gltfTransform = Find-Cmd "gltf-transform"
    if ($gltfTransform) {
        & gltf-transform copy $resolved $dest
        Write-Host "Convertido via gltf-transform: $dest"
        exit 0
    }
    $assimp = Find-Cmd "assimp"
    if ($assimp) {
        & assimp export $resolved $dest
        Write-Host "Convertido via assimp: $dest"
        exit 0
    }
    throw "GLTF encontrado, mas nem gltf-transform nem assimp estao no PATH. Instale um deles ou exporte GLB na origem."
}

if ($ext -eq ".fbx") {
    $fbx2gltf = Find-Cmd "FBX2glTF"
    if (-not $fbx2gltf) { $fbx2gltf = Find-Cmd "fbx2gltf" }
    if ($fbx2gltf) {
        $tmp = Join-Path $env:TEMP ("veste-avatar-" + [guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        & $fbx2gltf.Source --binary --input $resolved --output (Join-Path $tmp "out")
        $produced = Get-ChildItem $tmp -Filter "*.glb" | Select-Object -First 1
        if (-not $produced) { throw "FBX2glTF nao gerou GLB." }
        Copy-Item -Force $produced.FullName $dest
        Write-Host "Convertido via FBX2glTF: $dest"
        exit 0
    }
    $assimp = Find-Cmd "assimp"
    if ($assimp) {
        & assimp export $resolved $dest
        Write-Host "Convertido via assimp: $dest"
        exit 0
    }
    throw "FBX encontrado, mas FBX2glTF e assimp nao estao no PATH. Nao use Blender neste fluxo: instale assimp ou FBX2glTF."
}

throw "Extensao nao suportada ($ext). Use .glb, .gltf ou .fbx."
