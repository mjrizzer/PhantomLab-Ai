$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24 LTS first: https://nodejs.org/' }
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw 'Install Python 3.14 first: https://python.org/downloads/' }
if (-not (Test-Path .venv/Scripts/python.exe)) { py -3.14 -m venv .venv }
& .venv/Scripts/python.exe -m pip install -r requirements.lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
& npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
& node scripts/fonts.mjs
if ($LASTEXITCODE -ne 0) { throw 'Font setup failed' }
& .venv/Scripts/python.exe -m playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
Write-Host 'PhantomLab installed. Run ./scripts/start.ps1. Optional: ollama pull qwen3.5:4b'
