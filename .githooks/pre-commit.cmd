@echo off
REM Vibe pre-commit hook (cmd.exe + Bun)
REM Fails commit on policy/lint violations

call bun --version >NUL 2>&1 || (
  echo ⚠️ Bun not found on PATH. Install Bun and retry.
  exit /b 1
)

call bun run scan:bashisms || exit /b 1
call bun run lint || exit /b 1

echo ✅ pre-commit checks passed.
exit /b 0
