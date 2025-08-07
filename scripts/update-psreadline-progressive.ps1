# Progressive PSReadLine Update Strategy
# Step 1: Install stable 2.3.6, Step 2: Optionally try 2.4.2-beta2

param(
    [switch]$StableOnly,
    [switch]$Beta,
    [switch]$Force
)

Write-Host "Progressive PSReadLine Update Strategy" -ForegroundColor Cyan
Write-Host "Current version crashes fixed, now upgrading for better features..." -ForegroundColor Yellow

# Check current version
$current = Get-Module PSReadLine -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
if ($current) {
    Write-Host "Current PSReadLine: $($current.Version)" -ForegroundColor White
} else {
    Write-Host "PSReadLine not found" -ForegroundColor Red
}

if (-not $Beta) {
    # Step 1: Install stable version (recommended first step)
    Write-Host ""
    Write-Host "STEP 1: Installing PSReadLine 2.3.6 (STABLE)" -ForegroundColor Green
    Write-Host "  - 2.98M downloads" -ForegroundColor Cyan
    Write-Host "  - Proven stability" -ForegroundColor Cyan
    Write-Host "  - All modern features" -ForegroundColor Cyan
    
    try {
        Install-Module PSReadLine -RequiredVersion "2.3.6" -Force -Scope CurrentUser -AllowClobber
        
        # Verify installation
        $updated = Get-Module PSReadLine -ListAvailable | Where-Object {$_.Version -eq [version]"2.3.6"}
        if ($updated) {
            Write-Host "SUCCESS: PSReadLine 2.3.6 installed" -ForegroundColor Green
            Write-Host ""
            Write-Host "Features now available:" -ForegroundColor Cyan
            Write-Host "  - PredictionSource (inline suggestions)" -ForegroundColor White
            Write-Host "  - Better tab completion" -ForegroundColor White
            Write-Host "  - Enhanced history search" -ForegroundColor White
            Write-Host "  - Improved error handling" -ForegroundColor White
            Write-Host ""
            Write-Host "RESTART PowerShell to use new version" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Optional STEP 2:" -ForegroundColor Cyan
            Write-Host "  After testing 2.3.6, try beta: bun run powershell:update-beta" -ForegroundColor White
        }
    } catch {
        Write-Host "ERROR: Failed to install PSReadLine 2.3.6: $($_.Exception.Message)" -ForegroundColor Red
    }
    
} else {
    # Step 2: Install beta version (optional, for adventurous users)
    Write-Host ""
    Write-Host "STEP 2: Installing PSReadLine 2.4.2-beta2 (BETA)" -ForegroundColor Yellow
    Write-Host "  - Latest features" -ForegroundColor Cyan
    Write-Host "  - Experimental improvements" -ForegroundColor Cyan
    Write-Host "  - May have new bugs" -ForegroundColor Yellow
    
    $choice = Read-Host "Are you sure you want to install BETA version? (y/N)"
    if ($choice -eq 'y' -or $choice -eq 'Y') {
        try {
            Install-Module PSReadLine -RequiredVersion "2.4.2-beta2" -AllowPrerelease -Force -Scope CurrentUser -AllowClobber
            
            # Verify installation
            $updated = Get-Module PSReadLine -ListAvailable | Where-Object {$_.Version -eq [version]"2.4.2"}
            if ($updated) {
                Write-Host "SUCCESS: PSReadLine 2.4.2-beta2 installed" -ForegroundColor Green
                Write-Host ""
                Write-Host "Beta features (2.4.x):" -ForegroundColor Cyan
                Write-Host "  - Enhanced prediction engine" -ForegroundColor White
                Write-Host "  - Better performance" -ForegroundColor White
                Write-Host "  - Latest bug fixes" -ForegroundColor White
                Write-Host ""
                Write-Host "RESTART PowerShell to use beta version" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "If beta causes issues:" -ForegroundColor Yellow
                Write-Host "  Run: bun run powershell:revert-stable" -ForegroundColor White
            }
        } catch {
            Write-Host "ERROR: Failed to install PSReadLine beta: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Beta may not be compatible with your PowerShell version" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Beta installation cancelled" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "Pro tip: After upgrading, enable inline predictions:" -ForegroundColor Cyan
Write-Host '  Set-PSReadLineOption -PredictionSource History' -ForegroundColor White