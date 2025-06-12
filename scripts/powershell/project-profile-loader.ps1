# ============================================================================
# Project Profile Loader
# Usage: . .\project-profile-loader.ps1
# ============================================================================

param(
    [string]$ProjectName = ""
)

function Load-ProjectProfile {
    param([string]$Project)
    
    $profilesPath = "C:\CursorWorkspace\profiles"
    
    # Auto-detect project if not specified
    if (-not $Project) {
        $currentPath = $PWD.Path
        if ($currentPath -like "*\vibe*") {
            $Project = "vibe"
        }
        elseif ($currentPath -like "*\cursor-ai-intelligence*") {
            $Project = "cursor-ai"
        }
        else {
            $Project = "default"
        }
    }
    
    $profilePath = "$profilesPath\$Project-profile.ps1"
    
    if (Test-Path $profilePath) {
        Write-Host "🔄 Loading $Project profile..." -ForegroundColor Cyan
        . $profilePath
    }
    else {
        Write-Host "⚠️  Profile not found: $profilePath" -ForegroundColor Yellow
        Write-Host "Available profiles:" -ForegroundColor Gray
        Get-ChildItem "$profilesPath\*-profile.ps1" | ForEach-Object { 
            Write-Host "  - $($_.BaseName -replace '-profile', '')" -ForegroundColor Gray
        }
    }
}

# Create profiles directory if it doesn't exist
$profilesPath = "C:\CursorWorkspace\profiles"
if (-not (Test-Path $profilesPath)) {
    New-Item -ItemType Directory -Path $profilesPath -Force | Out-Null
}

# Load the appropriate profile
Load-ProjectProfile -Project $ProjectName 