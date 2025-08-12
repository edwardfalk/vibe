@echo off
setlocal enabledelayedexpansion

echo 🔎 Lint
bun run lint
if errorlevel 1 goto :fail

echo 🔍 Consistency scan
bun run scan:consistency
if errorlevel 1 goto :fail

echo 🎵 Validate sounds
bun run validate:sounds
if errorlevel 1 goto :fail

rem Optional: docs links (non-blocking)
rem bun run docs:check-links || goto :success

:success
endlocal
exit /b 0

:fail
echo ❌ Hook failed
endlocal
exit /b 1
