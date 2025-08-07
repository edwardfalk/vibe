# Cursor Shell Integration Patcher
# Fixes PowerShell terminal stability issues in Cursor IDE
# Run after each Cursor update or when experiencing terminal problems

param(
    [switch]$Force,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "Cursor Shell Integration Patcher v1.0" -ForegroundColor Cyan
Write-Host "Fixing PowerShell terminal stability issues..." -ForegroundColor Cyan

# Find Cursor installation
$cursorPaths = @(
    "$env:LOCALAPPDATA\Programs\cursor",
    "$env:PROGRAMFILES\Cursor",
    "$env:PROGRAMFILES(X86)\Cursor"
)

$cursorPath = $null
foreach ($path in $cursorPaths) {
    if (Test-Path "$path\Cursor.exe") {
        $cursorPath = $path
        break
    }
}

if (-not $cursorPath) {
    Write-Host "ERROR: Cursor installation not found" -ForegroundColor Red
    exit 1
}

Write-Host "INFO: Found Cursor at: $cursorPath" -ForegroundColor Cyan

# Get shell integration path
$shellIntegrationPath = "$cursorPath\resources\app\out\vs\workbench\contrib\terminal\common\scripts\shellIntegration.ps1"

if (-not (Test-Path $shellIntegrationPath)) {
    Write-Host "WARNING: Shell integration script not found at expected location" -ForegroundColor Yellow
    Write-Host "Expected: $shellIntegrationPath" -ForegroundColor Yellow
    exit 1
}

# Check if already patched
$content = Get-Content $shellIntegrationPath -Raw -ErrorAction SilentlyContinue
if ($content -and $content.Contains("Cursor Shell Integration Patch Applied") -and -not $Force) {
    Write-Host "SUCCESS: Shell integration already patched" -ForegroundColor Green
    Write-Host "Use -Force to re-apply patch" -ForegroundColor Cyan
    exit 0
}

# Create backup
$backupPath = "$shellIntegrationPath.backup"
if (-not (Test-Path $backupPath)) {
    Copy-Item $shellIntegrationPath $backupPath -Force
    Write-Host "INFO: Created backup: $backupPath" -ForegroundColor Cyan
}

# Create patched content
$patchedScript = @'
# ---------------------------------------------------------------------------------------------
#   Copyright (c) Microsoft Corporation. All rights reserved.
#   Licensed under the MIT License. See License.txt in the project root for license information.
# ---------------------------------------------------------------------------------------------

# Cursor Shell Integration Patch Applied
# This file has been patched to fix PowerShell terminal stability issues

# Store original prompt function
$Global:__VSCodeOriginalPrompt = $function:Prompt

# Define clean prompt without escape sequences
function Global:Prompt() {
    return $Global:__VSCodeOriginalPrompt.Invoke()
}

# Clean up VS Code environment variables
$env:VSCODE_NONCE = $null
$env:VSCODE_STABLE = $null
$env:VSCODE_ENV_REPLACE = $null
$env:VSCODE_ENV_PREPEND = $null
$env:VSCODE_ENV_APPEND = $null

# Remove PSReadLine conflicts
if (Get-Module -Name PSReadLine) {
    if ($null -ne $__VSCodeOriginalPSConsoleHostReadLine) {
        $function:PSConsoleHostReadLine = $__VSCodeOriginalPSConsoleHostReadLine
    }
    Remove-PSReadLineKeyHandler -Chord 'F12,e' -ErrorAction SilentlyContinue
    Remove-PSReadLineKeyHandler -Chord 'F12,f' -ErrorAction SilentlyContinue
}

# Set optimal buffer size
try {
    $Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(160, 5000)
} catch {
    # Ignore buffer size errors in non-interactive contexts
}

Write-Host "Cursor Shell Integration Patch Active - Terminal Stability Enhanced" -ForegroundColor Green
'@

# Apply patch
try {
    $patchedScript | Out-File -FilePath $shellIntegrationPath -Encoding UTF8 -Force
    Write-Host "SUCCESS: Shell integration patched successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to patch shell integration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Update PowerShell profile
Write-Host "INFO: Updating PowerShell profile..." -ForegroundColor Cyan

$profileDir = Split-Path $PROFILE -Parent
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

$profileEnhancements = @'

# Cursor Terminal Stability Enhancements
if ($Host.Name -eq "ConsoleHost") {
    if (Get-Module -ListAvailable -Name PSReadLine) {
        Import-Module PSReadLine -ErrorAction SilentlyContinue
        Set-PSReadLineOption -PredictionSource None -ErrorAction SilentlyContinue
        Set-PSReadLineOption -BellStyle None -ErrorAction SilentlyContinue
        Set-PSReadLineOption -EditMode Windows -ErrorAction SilentlyContinue
        Set-PSReadLineKeyHandler -Key Tab -Function Complete -ErrorAction SilentlyContinue
    }
    
    try {
        $Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(160, 5000)
    } catch {
        # Ignore in non-interactive contexts
    }
}
'@

# Check if profile needs updating
$needsProfileUpdate = $true
if (Test-Path $PROFILE) {
    $currentProfile = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
    if ($currentProfile -and $currentProfile.Contains("Cursor Terminal Stability Enhancements")) {
        $needsProfileUpdate = $false
        Write-Host "INFO: PowerShell profile already contains Cursor enhancements" -ForegroundColor Cyan
    }
}

if ($needsProfileUpdate) {
    try {
        $profileEnhancements | Out-File -FilePath $PROFILE -Append -Encoding UTF8
        Write-Host "SUCCESS: PowerShell profile updated" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Could not update PowerShell profile: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Check PSReadLine version
try {
    $psReadLineModule = Get-Module -ListAvailable -Name PSReadLine | Sort-Object Version -Descending | Select-Object -First 1
    if ($psReadLineModule) {
        $version = $psReadLineModule.Version
        Write-Host "INFO: PSReadLine version: $version" -ForegroundColor Cyan
        
        if ($version -lt [System.Version]"2.3.6") {
            Write-Host "WARNING: PSReadLine version is older than recommended 2.3.6" -ForegroundColor Yellow
            Write-Host "Consider updating: Install-Module PSReadLine -AllowPrerelease -Force -Scope CurrentUser" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "WARNING: Could not check PSReadLine version" -ForegroundColor Yellow
}

# Create version marker
$version = "unknown"
try {
    $versionFile = "$cursorPath\resources\app\package.json"
    if (Test-Path $versionFile) {
        $packageJson = Get-Content $versionFile | ConvertFrom-Json
        $version = $packageJson.version
    }
} catch {
    # Ignore version detection errors
}

$markerFile = "$env:TEMP\cursor-shell-patch-$version.marker"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"Patched at $timestamp" | Out-File -FilePath $markerFile -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: Cursor shell integration patched successfully!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart Cursor IDE completely" -ForegroundColor White
Write-Host "  2. Open a new terminal - you should see the green confirmation message" -ForegroundColor White
Write-Host "  3. If issues persist after Cursor updates, run: bun run cursor:fix" -ForegroundColor White
Write-Host "" 