# ============================================================================
# Minimal Bootstrap PowerShell Profile (Vibe)
# Purpose: Set UTF-8, load PSReadLine safely, and load per-project profile once
# ============================================================================

# 1) UTF-8 console encoding
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding           = [Text.Encoding]::UTF8

# 2) PSReadLine – load highest available version (preview allowed)
if (-not (Get-Module PSReadLine)) {
    try {
        Import-Module PSReadLine -AllowPrerelease -ErrorAction SilentlyContinue
    } catch {
        # PSReadLine not installed – continue without it
    }
}

# 3) One-time Set-Location patch to auto-load project profile
if (-not $global:SetLocationPatched) {
    $global:OriginalSetLocation = Get-Command Set-Location
    function Set-Location {
        & $global:OriginalSetLocation @args
        if (Get-Command -Name Load-ProjectProfile -ErrorAction SilentlyContinue) {
            Load-ProjectProfile
        }
    }
    $global:SetLocationPatched = $true
}

# 4) Minimal Vibe helpers (optional convenience)
function vibe       { Set-Location 'D:\projects\vibe' }
function start-vibe { bun run dev }

# 5) Immediately load profile for current directory (first run)
if (Get-Command -Name Load-ProjectProfile -ErrorAction SilentlyContinue) {
    Load-ProjectProfile
} 