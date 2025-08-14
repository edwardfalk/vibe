#!/usr/bin/env pwsh
# Wrapper: delegate to Windows cmd hook for consistency
$cmdPath = Join-Path $PSScriptRoot 'pre-push.cmd'
& cmd.exe /C $cmdPath
exit $LASTEXITCODE
