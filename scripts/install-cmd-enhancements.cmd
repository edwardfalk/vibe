@echo off
setlocal ENABLEEXTENSIONS

echo ============================================
echo  Vibe cmd.exe Enhancements Installer (Clink)
echo ============================================
echo.

REM Resolve important paths
set "USER_HOME=%USERPROFILE%"
set "CLINK_DIR=%USER_HOME%\clink"
set "CLINK_BAT=%CLINK_DIR%\clink.bat"
set "CLINK_PROFILE_DIR=%USER_HOME%\.clink"
set "REPO_ROOT=%~dp0.."
set "REPO_CLINK_INIT=%REPO_ROOT%\.cmd-config\init.lua"

REM Ensure profile directory exists
if not exist "%CLINK_PROFILE_DIR%" (
  mkdir "%CLINK_PROFILE_DIR%" >NUL 2>&1
)

REM Copy init.lua from repo if present
if exist "%REPO_CLINK_INIT%" (
  copy /Y "%REPO_CLINK_INIT%" "%CLINK_PROFILE_DIR%\init.lua" >NUL 2>&1
  echo Installed Clink profile: %CLINK_PROFILE_DIR%\init.lua
) else (
  echo Repo Clink profile not found at .cmd-config\init.lua. Skipping copy.
)

REM Check if AutoRun already contains clink injection
set "AUTORUN_VALUE="
for /f "tokens=3,*" %%A in ('reg query "HKCU\Software\Microsoft\Command Processor" /v AutoRun 2^>NUL ^| findstr /I AutoRun') do set "AUTORUN_VALUE=%%B"
set "AUTORUN_HAS_CLINK=0"
if defined AUTORUN_VALUE (
  echo %AUTORUN_VALUE% | findstr /I "clink" >NUL && set "AUTORUN_HAS_CLINK=1"
)

REM Resolve a clink launcher (prefer clink.exe on PATH, then known locations, then clink.bat in user dir)
set "CLINK_LAUNCHER="

REM Try user portable clink.bat
if exist "%CLINK_BAT%" set "CLINK_LAUNCHER=%CLINK_BAT%"

REM Try PATH for clink.exe
if not defined CLINK_LAUNCHER (
  for /f "usebackq delims=" %%P in (`where clink.exe 2^>NUL`) do (
    set "CLINK_LAUNCHER=%%P"
    goto :found_launcher
  )
)

REM Try Program Files locations
if not defined CLINK_LAUNCHER (
  if exist "%ProgramFiles%\clink\clink.exe" set "CLINK_LAUNCHER=%ProgramFiles%\clink\clink.exe"
)
if not defined CLINK_LAUNCHER (
  if exist "%ProgramFiles(x86)%\clink\clink.exe" set "CLINK_LAUNCHER=%ProgramFiles(x86)%\clink\clink.exe"
)
if not defined CLINK_LAUNCHER (
  if exist "%ProgramFiles%\clink\clink.bat" set "CLINK_LAUNCHER=%ProgramFiles%\clink\clink.bat"
)
if not defined CLINK_LAUNCHER (
  if exist "%ProgramFiles(x86)%\clink\clink.bat" set "CLINK_LAUNCHER=%ProgramFiles(x86)%\clink\clink.bat"
)

:found_launcher

if not defined CLINK_LAUNCHER (
  if "%AUTORUN_HAS_CLINK%"=="1" (
    echo Detected existing Clink AutoRun. Profile has been installed.
    echo Open a NEW terminal to use the updated profile.
    exit /b 0
  ) else (
    echo Clink not found on this system.
    echo Expected one of:
    echo   - %CLINK_BAT%
    echo   - clink.exe available on PATH
    echo   - %ProgramFiles%\clink\clink.exe
    echo   - %ProgramFiles(x86)%\clink\clink.exe
    echo.
    echo Download portable ZIP: https://github.com/chrisant996/clink/releases
    echo Extract to: %USER_HOME%\clink  (so clink.bat or clink.exe exists)
    echo Then re-run: scripts\install-cmd-enhancements.cmd
    exit /b 1
  )
)

REM Register AutoRun to inject Clink with our profile
set "AUTORUN_CMD=\"%CLINK_LAUNCHER%\" inject --profile \"%CLINK_PROFILE_DIR%\""
reg add "HKCU\Software\Microsoft\Command Processor" /v AutoRun /t REG_SZ /d "%AUTORUN_CMD%" /f >NUL 2>&1
if %errorlevel% neq 0 (
  echo Failed to set AutoRun in HKCU. You can set it manually:
  echo   reg add "HKCU\Software\Microsoft\Command Processor" /v AutoRun /t REG_SZ /d "%AUTORUN_CMD%" /f
  exit /b 1
)

echo Clink AutoRun configured for current user.

REM Set default console code page to UTF-8 (65001) for new sessions
echo Setting default console code page to UTF-8 (65001) for new terminals...
reg add "HKCU\Console" /v CodePage /t REG_DWORD /d 65001 /f >NUL 2>&1
if %errorlevel% neq 0 (
  echo Failed to set HKCU\Console\CodePage. You can run:
  echo   reg add "HKCU\Console" /v CodePage /t REG_DWORD /d 65001 /f
)

echo Open a NEW terminal (Cursor/Windows Terminal) to activate UTF-8.
echo Done.
exit /b 0


