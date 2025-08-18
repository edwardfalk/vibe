@echo off
setlocal enabledelayedexpansion

REM Windows-friendly pre-commit hook: scan staged files for ANSI escapes
REM Requires Bun to be installed and available in PATH

REM Ensure Bun is in PATH even when invoked via Git Bash
where bun > NUL 2>&1 || set "PATH=%USERPROFILE%\AppData\Local\bun\bin;%PATH%"
where bun > NUL 2>&1
if errorlevel 1 (
  echo [pre-commit] Bun is not installed or not in PATH. Skipping ANSI scan.
  echo Install Bun from https://bun.sh and re-run: bun run hooks:install
  exit /b 0
)

REM Run the ANSI scanner against staged files (falls back to changes/all if needed)
bun --bun scripts/scan/ansi-scan.js
set EXITCODE=%ERRORLEVEL%

if not "%EXITCODE%"=="0" (
  echo [pre-commit] ANSI escape sequences detected. Commit aborted.
  echo Fix the files listed above or run: bun run scan:ansi --all
  exit /b %EXITCODE%
)

exit /b 0


