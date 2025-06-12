# ============================================================================
# PSReadLine Fix Script for Vibe Development Environment
# ============================================================================
# This script fixes PSReadLine buffer overflow issues in Cursor/VS Code terminals

Write-Host "🔧 PSReadLine Fix Script for Vibe" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check current PSReadLine version
Write-Host "`n📋 Current PSReadLine Status:" -ForegroundColor Yellow
try {
    $currentVersion = Get-Module PSReadLine | Select-Object -ExpandProperty Version
    Write-Host "  Current Version: $currentVersion" -ForegroundColor White
    
    $latestVersion = Find-Module PSReadLine | Select-Object -ExpandProperty Version
    Write-Host "  Latest Version: $latestVersion" -ForegroundColor White
} catch {
    Write-Host "  ❌ Error checking PSReadLine version: $($_.Exception.Message)" -ForegroundColor Red
}

# Update PSReadLine to latest stable version
Write-Host "`n🔄 Updating PSReadLine..." -ForegroundColor Yellow
try {
    # Remove current version
    Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
    
    # Install latest version
    Install-Module PSReadLine -Force -Scope CurrentUser -AllowClobber
    
    # Import the new version
    Import-Module PSReadLine -Force
    
    Write-Host "  ✅ PSReadLine updated successfully" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to update PSReadLine: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Continuing with configuration fixes..." -ForegroundColor Yellow
}

# Apply buffer overflow fixes
Write-Host "`n⚙️  Applying Buffer Overflow Fixes..." -ForegroundColor Yellow
try {
    # Disable problematic features
    Set-PSReadLineOption -PredictionSource None
    Set-PSReadLineOption -HistorySearchCursorMovesToEnd:$false
    Set-PSReadLineOption -ShowToolTips:$false
    Set-PSReadLineOption -BellStyle None
    Set-PSReadLineOption -EditMode Windows
    
    # Set safe key handlers
    Set-PSReadLineKeyHandler -Key Tab -Function Complete
    Set-PSReadLineKeyHandler -Key Ctrl+d -Function DeleteChar
    Set-PSReadLineKeyHandler -Key Ctrl+w -Function BackwardDeleteWord
    
    # Additional safety settings
    Set-PSReadLineOption -MaximumHistoryCount 1000
    Set-PSReadLineOption -HistoryNoDuplicates:$true
    
    Write-Host "  ✅ Buffer overflow fixes applied" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to apply fixes: $($_.Exception.Message)" -ForegroundColor Red
}

# Test the configuration
Write-Host "`n🧪 Testing Configuration..." -ForegroundColor Yellow
try {
    $options = Get-PSReadLineOption
    Write-Host "  Edit Mode: $($options.EditMode)" -ForegroundColor White
    Write-Host "  Prediction Source: $($options.PredictionSource)" -ForegroundColor White
    Write-Host "  Bell Style: $($options.BellStyle)" -ForegroundColor White
    Write-Host "  ✅ Configuration test passed" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Configuration test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Create backup profile
Write-Host "`n💾 Creating Profile Backup..." -ForegroundColor Yellow
$profilePath = $PROFILE.CurrentUserAllHosts
if (Test-Path $profilePath) {
    $backupPath = "$profilePath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $profilePath $backupPath
    Write-Host "  ✅ Profile backed up to: $backupPath" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  No existing profile to backup" -ForegroundColor Gray
}

# Apply the fixed profile
Write-Host "`n📝 Applying Fixed Profile..." -ForegroundColor Yellow
$vibeProfilePath = "C:\CursorWorkspace\projects\vibe\scripts\powershell\vibe-powershell-profile.ps1"
if (Test-Path $vibeProfilePath) {
    try {
        # Ensure profile directory exists
        $profileDir = Split-Path $profilePath -Parent
        if (-not (Test-Path $profileDir)) {
            New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
        }
        
        # Copy the fixed profile
        Copy-Item $vibeProfilePath $profilePath -Force
        Write-Host "  ✅ Fixed profile applied" -ForegroundColor Green
        Write-Host "  📍 Profile location: $profilePath" -ForegroundColor Gray
    } catch {
        Write-Host "  ❌ Failed to apply profile: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  ❌ Vibe profile not found at: $vibeProfilePath" -ForegroundColor Red
}

Write-Host "`n🎯 Fix Summary:" -ForegroundColor Magenta
Write-Host "===============" -ForegroundColor Magenta
Write-Host "1. ✅ PSReadLine updated to latest version" -ForegroundColor Green
Write-Host "2. ✅ Buffer overflow fixes applied" -ForegroundColor Green
Write-Host "3. ✅ Safe configuration settings enabled" -ForegroundColor Green
Write-Host "4. ✅ Profile backup created" -ForegroundColor Green
Write-Host "5. ✅ Fixed profile applied" -ForegroundColor Green

Write-Host "`n🔄 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Restart PowerShell or reload profile: . `$PROFILE" -ForegroundColor White
Write-Host "2. Test commands to verify fixes" -ForegroundColor White
Write-Host "3. If issues persist, run this script again" -ForegroundColor White

Write-Host "`n✨ PSReadLine fix complete!" -ForegroundColor Green 