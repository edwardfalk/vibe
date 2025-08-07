# Cursor Shell Setup Script
# One-time setup for stable PowerShell terminal in Cursor

Write-Host "🔧 Setting up Cursor PowerShell terminal stability..." -ForegroundColor Cyan

# Run the patcher
$patcherPath = Join-Path $PSScriptRoot "patch-cursor-shell.ps1"
if (Test-Path $patcherPath) {
    Write-Host "Running shell integration patcher..." -ForegroundColor Yellow
    & $patcherPath -Force
} else {
    Write-Error "Patcher script not found at: $patcherPath"
    exit 1
}

# Add to package.json scripts if not already present
$packageJsonPath = Join-Path (Split-Path $PSScriptRoot -Parent) "package.json"
if (Test-Path $packageJsonPath) {
    try {
        $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
        
        # Ensure scripts section exists
        if (-not $packageJson.scripts) {
            $packageJson | Add-Member -Type NoteProperty -Name "scripts" -Value @{}
        }
        
        # Add cursor:fix script if not present
        if (-not $packageJson.scripts."cursor:fix") {
            $packageJson.scripts | Add-Member -Type NoteProperty -Name "cursor:fix" -Value "powershell -ExecutionPolicy Bypass -File scripts/patch-cursor-shell.ps1"
            
            # Convert back to JSON and save
            $packageJson | ConvertTo-Json -Depth 10 | Out-File $packageJsonPath -Encoding UTF8
            Write-Host "✓ Added 'bun run cursor:fix' script to package.json" -ForegroundColor Green
        } else {
            Write-Host "ℹ 'cursor:fix' script already exists in package.json" -ForegroundColor Cyan
        }
    } catch {
        Write-Warning "Could not update package.json: $_"
    }
}

Write-Host "`n✨ Setup complete!" -ForegroundColor Green
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart Cursor IDE" -ForegroundColor White
Write-Host "  2. Open a new terminal - you should see a green confirmation message" -ForegroundColor White
Write-Host "  3. If you experience issues after Cursor updates, run: bun run cursor:fix" -ForegroundColor White
Write-Host "`n🔄 The patcher will auto-run daily to catch updates" -ForegroundColor Cyan 