@echo off
echo 🚀 Vibe Game - Windows Environment Setup (Batch Alternative)
echo ============================================================

echo.
echo 🔍 Checking PowerShell availability...
powershell -Command "Write-Host '✅ PowerShell is available'" 2>nul
if %errorlevel% neq 0 (
    echo ❌ PowerShell not found. Please install PowerShell 7+
    pause
    exit /b 1
)

echo.
echo 🔧 Running PowerShell environment setup...
powershell -ExecutionPolicy Bypass -File setup-windows-environment.ps1

if %errorlevel% equ 0 (
    echo.
    echo ✅ Environment setup completed successfully!
    echo.
    echo 🚀 Next steps:
    echo    1. Run: bun run dev
    echo    2. Run: bun run test:enhanced
    echo    3. Open: http://localhost:5500
) else (
    echo.
    echo ❌ Environment setup encountered issues.
    echo    Please check the output above and fix any problems.
)

echo.
pause 