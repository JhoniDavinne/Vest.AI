# Pipeline de testes para Windows PowerShell.
# Uso:  pwsh -File pipelines/tests/run_all.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\..")
python pipelines/tests/run_all.py @args
exit $LASTEXITCODE
