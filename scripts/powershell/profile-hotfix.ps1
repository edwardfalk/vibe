# Quick hotfix for profile path detection
Write-Host "🔧 Applying profile hotfix..." -ForegroundColor Yellow

# Fix the Get-CurrentProject function
function Get-CurrentProject {
    $currentPath = $PWD.Path.ToLower()
    
    # Cache the last detected project to avoid repeated lookups
    if ($Global:LastPath -eq $currentPath -and $Global:LastProject) {
        return $Global:LastProject
    }
    
    # Find matching project (fixed path matching)
    foreach ($projectKey in $Global:ProjectConfigs.Keys) {
        if ($currentPath -like "*$projectKey*") {  # Removed backslash requirement
            $Global:LastPath = $currentPath
            $Global:LastProject = $projectKey
            return $projectKey
        }
    }
    
    $Global:LastPath = $currentPath
    $Global:LastProject = $null
    return $null
}

# Fix npm/npx functions for current project
$project = Get-CurrentProject
if ($project -eq "vibe") {
    function npm { 
        Write-Host "⚠️  Use 'bun' instead of npm for Vibe project" -ForegroundColor Yellow
        bun $args 
    }
    function npx { 
        Write-Host "⚠️  Use 'bunx' instead of npx for Vibe project" -ForegroundColor Yellow
        bunx $args 
    }
}

# Manually load project profile
Load-ProjectProfile

Write-Host "✅ Hotfix applied! Testing..." -ForegroundColor Green
Write-Host "Current project: $(Get-CurrentProject)" -ForegroundColor Cyan 