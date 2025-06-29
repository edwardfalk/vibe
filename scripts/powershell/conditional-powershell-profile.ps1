# ============================================================================
# Multi-Project PowerShell Profile
# ============================================================================

# PSReadLine Hotfix for IDE Terminal
# Always disable PSReadLine in Cursor/VSCode terminals to prevent buffer overflow errors
Remove-Module -Name PSReadLine -ErrorAction SilentlyContinue

# Set PowerShell to UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ============================================================================
# Common Setup (All Projects)
# ============================================================================

# Enhanced File Operations
Set-Alias -Name cat -Value bat -Force
Set-Alias -Name grep -Value rg -Force
Set-Alias -Name find -Value fd -Force
Set-Alias -Name ls -Value eza -Force
Set-Alias -Name ll -Value "eza -la" -Force

# Git Shortcuts
function gs { git status }
function ga { git add $args }
function gc { git commit -m $args }
function gp { git push }
function gl { git pull }
function gd { git diff }
function gb { git branch $args }
function gco { git checkout $args }
function glog { git log --oneline --graph --decorate }

# Project Navigation
function proj { Set-Location "D:\projects" }

# ============================================================================
# Project Detection and Loading
# ============================================================================

function Load-ProjectProfile {
    $currentPath = $PWD.Path
    
    # Detect project type
    if ($currentPath -like "*\vibe*") {
        Load-VibeProfile
    }
    elseif ($currentPath -like "*\cursor-ai-intelligence*") {
        Load-CursorAIProfile
    }
    else {
        Load-DefaultProfile
    }
}

function Load-VibeProfile {
    Write-Host "🎮 Loading Vibe Game Development Profile..." -ForegroundColor Magenta
    
    # Vibe-specific aliases and functions
    function vibe { Set-Location "D:\projects\vibe" }
    function start-vibe { bun run dev }
    function test-vibe { bun run test:comprehensive }
    function lint-vibe { bun run lint }
    function fix-vibe { bun run lint:fix }
    function clean-vibe { bun run clean }
    function fresh-vibe { bun run fresh }
    
    # Package management with warnings
    function npm { 
        Write-Host "⚠️  Use 'bun' instead of npm for Vibe project" -ForegroundColor Yellow
        bun $args 
    }
    function npx { 
        Write-Host "⚠️  Use 'bunx' instead of npx for Vibe project" -ForegroundColor Yellow
        bunx $args 
    }
    
    # Testing functions
    function test-enhanced { bun run test:enhanced }
    function test-mcp { bun run test:mcp }
    function test-playwright { bun run test:playwright }
    
    # Status function
    function vibe-status {
        Write-Host "🎮 Vibe Game Development Status" -ForegroundColor Magenta
        Write-Host "==============================" -ForegroundColor Magenta
        
        # Git status
        Write-Host "`n📁 Git Status:" -ForegroundColor Yellow
        $gitStatus = git status --porcelain
        if ($gitStatus) {
            $gitStatus | ForEach-Object { Write-Host "  $_" }
        } else {
            Write-Host "  Clean working directory" -ForegroundColor Green
        }
        
        # Development servers
        Write-Host "`n🌐 Development Servers:" -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:5500" -Method Head -TimeoutSec 2
            Write-Host "  ✅ Dev server running on port 5500" -ForegroundColor Green
        } catch {
            Write-Host "  ❌ Dev server not running on port 5500" -ForegroundColor Red
        }
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -TimeoutSec 2
            Write-Host "  ✅ Ticket API running on port 3001" -ForegroundColor Green
        } catch {
            Write-Host "  ❌ Ticket API not running on port 3001" -ForegroundColor Red
        }
    }
    
    # Set environment
    $env:PREFERRED_PACKAGE_MANAGER = "bun"
    
    Write-Host "🎮 Vibe commands: start-vibe, test-vibe, lint-vibe, vibe-status" -ForegroundColor Cyan
}

function Load-CursorAIProfile {
    Write-Host "🤖 Loading Cursor AI Intelligence Profile..." -ForegroundColor Blue
    
    # Cursor AI specific functions
    function cai { Set-Location "D:\projects\cursor-ai-intelligence" }
    function start-hub { 
        Set-Location packages/service-hub
        Start-Process pwsh -ArgumentList "-NoExit", "-Command", "bun start"
        Set-Location ../..
    }
    function hub-status {
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:54321/health" -Method Get -TimeoutSec 5
            Write-Host "✅ ServiceHub is running - Status: $($response.status)" -ForegroundColor Green
        } catch {
            Write-Host "❌ ServiceHub is not running" -ForegroundColor Red
        }
    }
    function test-all { bun packages/testing-tools/src/enhanced-system-tester.js }
    function build-all {
        Get-ChildItem packages -Directory | ForEach-Object {
            if (Test-Path "$($_.FullName)/package.json") {
                $packageJson = Get-Content "$($_.FullName)/package.json" | ConvertFrom-Json
                if ($packageJson.scripts.build) {
                    Write-Host "Building $($_.Name)..." -ForegroundColor Cyan
                    Set-Location $_.FullName
                    bun run build
                    Set-Location ../..
                }
            }
        }
    }
    
    # Package management
    Set-Alias -Name npm -Value bun -Force
    Set-Alias -Name npx -Value bunx -Force
    
    Write-Host "🤖 Cursor AI commands: cai, start-hub, hub-status, test-all, build-all" -ForegroundColor Cyan
}

function Load-DefaultProfile {
    Write-Host "📁 Loading Default Development Profile..." -ForegroundColor Gray
    
    # Basic package management
    $env:PREFERRED_PACKAGE_MANAGER = "bun"
    
    Write-Host "📁 Basic development environment loaded" -ForegroundColor Gray
}

# ============================================================================
# Enhanced Prompt with Project Detection
# ============================================================================

function prompt {
    $currentPath = $PWD.Path
    $gitBranch = ""
    $gitStatus = ""
    $projectIndicator = ""
    
    # Get Git information
    if (git rev-parse --git-dir 2>$null) {
        $branch = git rev-parse --abbrev-ref HEAD 2>$null
        if ($branch) {
            $gitBranch = " $branch"
            $status = git status --porcelain 2>$null
            if ($status) {
                $gitStatus = " ●"
            }
        }
    }
    
    # Project-specific indicators
    if ($currentPath -like "*\vibe*") {
        $projectIndicator = " 🎮"
    }
    elseif ($currentPath -like "*\cursor-ai-intelligence*") {
        $projectIndicator = " 🤖"
    }
    
    # Shorten path
    $displayPath = $currentPath -replace [regex]::Escape("D:\projects\\"), ""
    if ($displayPath.Length -lt $currentPath.Length) {
        $displayPath = " $displayPath"
    } else {
        $displayPath = " $currentPath"
    }
    
    # Build prompt
    Write-Host $displayPath -NoNewline -ForegroundColor Cyan
    if ($gitBranch) {
        Write-Host $gitBranch -NoNewline -ForegroundColor Green
        if ($gitStatus) {
            Write-Host $gitStatus -NoNewline -ForegroundColor Red
        }
    }
    
    if ($projectIndicator) {
        Write-Host $projectIndicator -NoNewline -ForegroundColor Magenta
    }
    
    $timestamp = Get-Date -Format "HH:mm"
    Write-Host "  $timestamp" -NoNewline -ForegroundColor DarkGray
    Write-Host "  pwsh" -NoNewline -ForegroundColor Blue
    
    return "`n❯ "
}

# ============================================================================
# Auto-reload on directory change
# ============================================================================

# Override Set-Location to reload profile when changing directories
$originalSetLocation = Get-Command Set-Location
function Set-Location {
    & $originalSetLocation @args
    Load-ProjectProfile
}

# ============================================================================
# Startup
# ============================================================================

Clear-Host
Write-Host "🚀 Multi-Project Development Environment" -ForegroundColor Magenta
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host ""

# Load appropriate profile based on current location
Load-ProjectProfile 