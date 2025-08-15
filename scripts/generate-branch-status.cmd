@echo off
setlocal enabledelayedexpansion

REM Generate a sanitized (ANSI-free) branch status snapshot into docs/BRANCH_STATUS.md

cd /d %~dp0\..\

for /f "usebackq tokens=*" %%B in (`git rev-parse --abbrev-ref HEAD 2^>NUL`) do set BRANCH=%%B
if "%BRANCH%"=="" (
  echo Not a Git repository or git not available.
  exit /b 1
)

set OUT=docs\BRANCH_STATUS.md
(
  echo # Branch Status
  echo
  echo **Branch**: %BRANCH%
  echo
  echo \`\`\`
  git --no-pager branch -vv --no-color 2^>NUL
  echo \`\`\`
) > "%OUT%"

echo Wrote %OUT%
exit /b 0


