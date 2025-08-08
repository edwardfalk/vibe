#!/usr/bin/env pwsh
# Pre-commit hook (PowerShell) for Windows devs
$ErrorActionPreference = 'Stop'

Write-Host "🔎 Lint" -ForegroundColor Cyan
bun run lint | Out-Host

Write-Host "🔍 Consistency scan" -ForegroundColor Cyan
bun run scan:consistency | Out-Host

Write-Host "🎵 Validate sounds" -ForegroundColor Cyan
bun run validate:sounds | Out-Host

exit 0
