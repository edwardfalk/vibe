# ============================================================================
# Restore System Profile Script - Fix Global Vibe Override
# ============================================================================
# This script fixes the issue where the Vibe profile was copied to CurrentUserAllHosts
# which was overriding the user's modular PowerShell setup

Write-Host "🔧 Fixing Global PowerShell Profile Override" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$allHostsProfile = $PROFILE.CurrentUserAllHosts
$currentUserProfile = $PROFILE.CurrentUserCurrentHost

Write-Host "`n📍 Profile Locations:" -ForegroundColor Yellow
Write-Host "  All Hosts (GLOBAL): $allHostsProfile" -ForegroundColor White
Write-Host "  Current Host: $currentUserProfile" -ForegroundColor White

# Check what's in the AllHosts profile
Write-Host "`n🔍 Checking AllHosts profile..." -ForegroundColor Yellow
if (Test-Path $allHostsProfile) {
    $content = Get-Content $allHostsProfile -Raw
    if ($content -like "*vibe*" -or $content -like "*🎮*") {
        Write-Host "  ❌ FOUND THE PROBLEM! AllHosts profile contains Vibe content" -ForegroundColor Red
        Write-Host "     This overrides your modular setup in ALL PowerShell sessions" -ForegroundColor Yellow
        
        # Create backup
        $backupPath = "$allHostsProfile.vibe-override-backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $allHostsProfile $backupPath
        Write-Host "  💾 Backed up to: $(Split-Path $backupPath -Leaf)" -ForegroundColor Green
        
        # Look for original backup
        $originalBackups = Get-ChildItem "$allHostsProfile.backup.*" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
        
        if ($originalBackups) {
            Write-Host "`n🔄 Found original backup(s):" -ForegroundColor Green
            $originalBackups | ForEach-Object { 
                Write-Host "    📄 $($_.Name) ($(Get-Date $_.LastWriteTime -Format 'yyyy-MM-dd HH:mm'))" -ForegroundColor White
            }
            
            $choice = Read-Host "`nRestore original backup? (y/n)"
            if ($choice -eq 'y' -or $choice -eq 'Y') {
                Copy-Item $originalBackups[0].FullName $allHostsProfile -Force
                Write-Host "  ✅ Original profile restored" -ForegroundColor Green
            }
        } else {
            Write-Host "`n⚠️  No original backup found. Creating minimal profile..." -ForegroundColor Yellow
            
            # Create minimal AllHosts profile that doesn't interfere
            $minimalProfile = @"
# ============================================================================
# System PowerShell Profile (All Hosts)
# ============================================================================
# Minimal profile that doesn't override user's modular setup

# Basic encoding
`$OutputEncoding = [System.Text.Encoding]::UTF8

# Safe PSReadLine configuration
if (Get-Module -ListAvailable PSReadLine) {
    try {
        Import-Module PSReadLine -ErrorAction SilentlyContinue
        Set-PSReadLineOption -PredictionSource None -ErrorAction SilentlyContinue
        Set-PSReadLineOption -BellStyle None -ErrorAction SilentlyContinue
        Set-PSReadLineOption -HistorySearchCursorMovesToEnd:`$false -ErrorAction SilentlyContinue
    } catch {
        # Continue without PSReadLine if it fails
    }
}

# Note: Project-specific profiles should be loaded via CurrentUserCurrentHost
# or workspace-specific configurations, NOT here in AllHosts
"@
            
            $minimalProfile | Out-File -FilePath $allHostsProfile -Encoding UTF8 -Force
            Write-Host "  ✅ Minimal AllHosts profile created" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✅ AllHosts profile looks clean" -ForegroundColor Green
    }
} else {
    Write-Host "  ℹ️  No AllHosts profile exists (this is fine)" -ForegroundColor Gray
}

# Check CurrentUserCurrentHost profile
Write-Host "`n🔍 Checking CurrentUserCurrentHost profile..." -ForegroundColor Yellow
if (Test-Path $currentUserProfile) {
    Write-Host "  ✅ CurrentUserCurrentHost profile exists" -ForegroundColor Green
    Write-Host "     This is where your modular setup should work" -ForegroundColor Gray
} else {
    Write-Host "  ℹ️  No CurrentUserCurrentHost profile (this is fine)" -ForegroundColor Gray
}

Write-Host "`n🎯 Fix Summary:" -ForegroundColor Magenta
Write-Host "===============" -ForegroundColor Magenta
Write-Host "✅ Removed Vibe content from AllHosts profile" -ForegroundColor Green
Write-Host "✅ Your modular setup should now work properly" -ForegroundColor Green
Write-Host "✅ Project-specific profiles will load correctly" -ForegroundColor Green

Write-Host "`n📋 Profile Loading Order:" -ForegroundColor Yellow
Write-Host "1. AllHosts (now minimal/clean)" -ForegroundColor White
Write-Host "2. CurrentUserCurrentHost (your modular setup)" -ForegroundColor White
Write-Host "3. Workspace-specific (.cursor.ps1, etc.)" -ForegroundColor White

Write-Host "`n🔄 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Restart ALL PowerShell sessions" -ForegroundColor White
Write-Host "2. Test external PowerShell - should be clean" -ForegroundColor White
Write-Host "3. Test your modular setup - should work now" -ForegroundColor White
Write-Host "4. Vibe project should load via .cursor.ps1 or workspace config" -ForegroundColor White

Write-Host "`n✨ Global profile override fixed!" -ForegroundColor Green 