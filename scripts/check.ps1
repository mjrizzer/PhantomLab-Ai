$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed' }
& npm.cmd run test
if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
$testRunPath = Join-Path (Get-Location) ('data/checks/' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Split-Path $testRunPath -Parent) -Force | Out-Null
& .venv/Scripts/python.exe -m pytest -q -p no:cacheprovider --basetemp $testRunPath
if ($LASTEXITCODE -ne 0) { throw 'Backend/browser/offline tests failed' }
& npm.cmd run e2e
if ($LASTEXITCODE -ne 0) { throw 'Frontend browser checks failed' }
