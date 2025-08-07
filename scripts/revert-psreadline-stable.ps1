# Revert PSReadLine to Stable Version
# Use this if beta version causes issues

Write-Host "Reverting PSReadLine to stable 2.3.6..." -ForegroundColor Yellow

try {
    # Force install stable version
    Install-Module PSReadLine -RequiredVersion "2.3.6" -Force -Scope CurrentUser -AllowClobber
    
    # Verify
    $stable = Get-Module PSReadLine -ListAvailable | Where-Object {$_.Version -eq [version]"2.3.6"}
    if ($stable) {
        Write-Host "SUCCESS: Reverted to PSReadLine 2.3.6 (stable)" -ForegroundColor Green
        Write-Host "RESTART PowerShell to use stable version" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Failed to revert: $($_.Exception.Message)" -ForegroundColor Red
}