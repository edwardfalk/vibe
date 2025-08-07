# Try PSReadLine 2.4.2-beta2 for Cursor IDE Stability
# Fixed version for Swedish PowerShell and permission issues

param([switch]$Revert)

Write-Host "PSReadLine Beta Trial for Cursor IDE" -ForegroundColor Cyan

if ($Revert) {
    Write-Host "REVERTING: Disabling PSReadLine import..." -ForegroundColor Yellow
    
    # Update profile to skip PSReadLine import
    $profilePath = $PROFILE
    if (Test-Path $profilePath) {
        $content = Get-Content $profilePath -Raw
        $newContent = $content -replace 'Import-Module PSReadLine', '# Import-Module PSReadLine # DISABLED'
        $newContent = $newContent -replace 'if.*PSReadLine.*', '# PSReadLine disabled for stability'
        Set-Content $profilePath -Value $newContent -Force
        Write-Host "SUCCESS: PSReadLine import disabled in profile" -ForegroundColor Green
    }
    
    Write-Host "RESTART PowerShell to run without PSReadLine" -ForegroundColor Yellow
    return
}

# Install latest beta with specific Cursor fixes
Write-Host "Installing PSReadLine 2.4.2-beta2 (Cursor stability fixes)..." -ForegroundColor White
Write-Host "  ✅ Fixes cursor position queries that can crash Cursor" -ForegroundColor Gray
Write-Host "  ✅ Handles buffer changes from Cursor terminal hooks" -ForegroundColor Gray  
Write-Host "  ✅ Prevents initialization crashes in IDE environments" -ForegroundColor Gray

try {
    # Method 1: Try with full version string
    Write-Host "Attempting installation..." -ForegroundColor Gray
    Install-Module PSReadLine -RequiredVersion "2.4.2-beta2" -Force -Scope CurrentUser -AllowClobber -AllowPrerelease -Repository PSGallery
    
    # Verify installation
    $installed = Get-Module PSReadLine -ListAvailable | Where-Object {$_.Version.ToString() -like "2.4.2*"}
    if ($installed) {
        Write-Host "SUCCESS: PSReadLine 2.4.2-beta2 installed!" -ForegroundColor Green
        Write-Host "Installed version: $($installed.Version)" -ForegroundColor Green
    } else {
        throw "Installation verification failed"
    }
    
} catch {
    Write-Host "Method 1 failed: $($_.Exception.Message)" -ForegroundColor Yellow
    
    try {
        # Method 2: Try with AllowClobber first, then specific version
        Write-Host "Trying alternative installation method..." -ForegroundColor Gray
        Install-Module PSReadLine -Force -Scope CurrentUser -AllowClobber -AllowPrerelease -Repository PSGallery
        
        $installed = Get-Module PSReadLine -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
        if ($installed -and $installed.Version.ToString() -like "2.4*") {
            Write-Host "SUCCESS: PSReadLine $($installed.Version) installed!" -ForegroundColor Green
        } else {
            throw "Could not install compatible version"
        }
        
    } catch {
        Write-Host "ERROR: All installation methods failed" -ForegroundColor Red
        Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "FALLBACK: Disabling PSReadLine entirely..." -ForegroundColor Yellow
        
        # Update profile to disable PSReadLine
        $profilePath = $PROFILE
        if (Test-Path $profilePath) {
            $content = Get-Content $profilePath -Raw
            $newContent = $content -replace 'Import-Module PSReadLine', '# Import-Module PSReadLine # DISABLED for stability'
            Set-Content $profilePath -Value $newContent -Force
            Write-Host "PSReadLine import disabled in profile" -ForegroundColor Gray
        }
        
        Write-Host "RESTART PowerShell for stable (basic) experience" -ForegroundColor Gray
        return
    }
}

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Close ALL PowerShell windows completely" -ForegroundColor White
Write-Host "2. Close and restart Cursor IDE completely" -ForegroundColor White
Write-Host "3. Open new PowerShell terminal in Cursor" -ForegroundColor White
Write-Host "4. Test stability for a few days" -ForegroundColor White
Write-Host ""
Write-Host "IF ISSUES PERSIST:" -ForegroundColor Red
Write-Host "Run: bun run powershell:try-beta-revert" -ForegroundColor Gray