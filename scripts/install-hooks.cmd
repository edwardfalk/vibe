@echo off
setlocal enabledelayedexpansion

REM Install Git hooks path to use our Windows-friendly hooks under scripts/git-hooks

if not exist ".git" goto :notgit

git config core.hooksPath scripts/git-hooks
if errorlevel 1 goto :gitfail

echo Git hooks path set to scripts\git-hooks
echo Pre-commit hook will scan for ANSI sequences and block offending commits.
exit /b 0

:notgit
echo This does not appear to be a Git repository (no .git directory found).
exit /b 1

:gitfail
echo Failed to set core.hooksPath. Ensure Git is installed and available in PATH.
exit /b 1


