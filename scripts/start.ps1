$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path dist/index.html)) { throw 'Run ./scripts/install.ps1 first.' }
Write-Host 'Open http://127.0.0.1:8765 — keep this terminal running for background experiments.'
& .venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8765
