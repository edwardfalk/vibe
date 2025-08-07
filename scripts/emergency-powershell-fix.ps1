# Emergency PowerShell Crash Fix
# Fixes exit code -1073741571 caused by PSReadLine version conflicts

param(
    [switch]$Force,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "Emergency PowerShell Crash Fix" -ForegroundColor Red
Write-Host "Fixing exit code -1073741571 (stack overflow/memory corruption)" -ForegroundColor Yellow

# Step 1: Create minimal safe profile
Write-Host "1. Creating minimal safe PowerShell profile..." -ForegroundColor Cyan

$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent

# Ensure profile directory exists
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Backup existing profile
if (Test-Path $profilePath) {
    $backupPath = "$profilePath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $profilePath $backupPath -Force
    Write-Host "   DONE: Backed up profile to: $backupPath" -ForegroundColor Green
}

# Create minimal stable profile
$minimalProfile = @'
# Minimal PowerShell Profile - Emergency Stability Fix
# This profile avoids PSReadLine conflicts that cause crashes

# Only load if running in console host (not ISE, VS Code terminal, etc.)
if ($Host.Name -eq "ConsoleHost") {
    
    # Set safe buffer size without errors
    try {
        $currentSize = $Host.UI.RawUI.BufferSize
        if ($currentSize.Width -lt 120) {
            $newSize = New-Object System.Management.Automation.Host.Size(160, 3000)
            $Host.UI.RawUI.BufferSize = $newSize
        }
    } catch {
        # Ignore buffer size errors - they're not critical
    }
    
    # Load PSReadLine only with compatible settings
    if (Get-Module -ListAvailable -Name PSReadLine) {
        try {
            Import-Module PSReadLine -ErrorAction SilentlyContinue
            
            # Only use settings that exist in PSReadLine 2.0.0+
            Set-PSReadLineOption -BellStyle None -ErrorAction SilentlyContinue
            Set-PSReadLineOption -EditMode Windows -ErrorAction SilentlyContinue
            
            # Tab completion that works in all versions
            Set-PSReadLineKeyHandler -Key Tab -Function Complete -ErrorAction SilentlyContinue
            
            # Check version before using newer features
            $psReadLineVersion = (Get-Module PSReadLine).Version
            if ($psReadLineVersion -ge [version]"2.1.0") {
                # Only use PredictionSource if version supports it
                Set-PSReadLineOption -PredictionSource None -ErrorAction SilentlyContinue
            }
            
            Write-Host "SUCCESS: PowerShell stability profile loaded (PSReadLine $psReadLineVersion)" -ForegroundColor Green
            
        } catch {
            Write-Host "WARNING: PSReadLine error (non-critical): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# Set working directory to projects if not already there
if ((Get-Location).Path -notlike "*projects*" -and (Test-Path "D:\projects")) {
    Set-Location "D:\projects"
}
'@

# Write minimal profile
$minimalProfile | Out-File -FilePath $profilePath -Encoding UTF8 -Force
Write-Host "   DONE: Created minimal stable profile" -ForegroundColor Green

Write-Host ""
Write-Host "EMERGENCY FIX COMPLETE!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Close ALL PowerShell windows completely" -ForegroundColor White
Write-Host "  2. Close and restart Cursor IDE completely" -ForegroundColor White  
Write-Host "  3. Open a new PowerShell terminal" -ForegroundColor White
Write-Host "  4. You should see: 'SUCCESS: PowerShell stability profile loaded'" -ForegroundColor White
Write-Host ""
Write-Host "If crashes still occur:" -ForegroundColor Yellow
Write-Host "  - Run this script again with -Force" -ForegroundColor White
Write-Host "  - Check Windows Event Viewer for additional error details" -ForegroundColor White
Write-Host ""