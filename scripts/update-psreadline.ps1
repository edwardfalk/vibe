# Update PSReadLine to Modern Stable Version
# Improves PowerShell functionality after fixing crashes

param([switch]$Force)

Write-Host "Updating PSReadLine to modern version..." -ForegroundColor Cyan

# Check current version
$current = Get-Module PSReadLine -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
if ($current) {
    Write-Host "Current PSReadLine version: $($current.Version)" -ForegroundColor White
} else {
    Write-Host "PSReadLine not found" -ForegroundColor Yellow
}

# Install modern stable version
try {
    Write-Host "Installing PSReadLine 2.3.6 (stable)..." -ForegroundColor White
    Install-Module PSReadLine -RequiredVersion "2.3.6" -Force -Scope CurrentUser -AllowClobber
    
    # Verify
    $updated = Get-Module PSReadLine -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
    if ($updated -and $updated.Version -ge [version]"2.3.6") {
        Write-Host "SUCCESS: PSReadLine updated to $($updated.Version)" -ForegroundColor Green
        Write-Host "You can now use modern features like prediction and better tab completion" -ForegroundColor Cyan
    }
} catch {
    Write-Host "WARNING: PSReadLine update failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "The crash fix will still work with the old version" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "RESTART PowerShell to use the new version" -ForegroundColor Yellow