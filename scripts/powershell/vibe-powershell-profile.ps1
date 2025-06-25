# ============================================================================
# Enhanced PowerShell Profile for Vibe Game Development
# ============================================================================

# Set PowerShell to UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ============================================================================
# PSReadLine Configuration (Fix for Buffer Overflow Issues)
# ============================================================================

# Import PSReadLine with error handling
try {
    Import-Module PSReadLine -Force -ErrorAction SilentlyContinue
    
    # Configure PSReadLine to prevent buffer overflow issues
    Set-PSReadLineOption -PredictionSource None
    Set-PSReadLineOption -HistorySearchCursorMovesToEnd:$false
    Set-PSReadLineOption -ShowToolTips:$false
    Set-PSReadLineOption -BellStyle None
    Set-PSReadLineOption -EditMode Windows
    
    # Disable problematic features that cause cursor positioning errors
    Set-PSReadLineKeyHandler -Key Tab -Function Complete
    Set-PSReadLineKeyHandler -Key Ctrl+d -Function DeleteChar
    Set-PSReadLineKeyHandler -Key Ctrl+w -Function BackwardDeleteWord
    
    Write-Host "✅ PSReadLine configured successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PSReadLine configuration failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   Continuing with basic PowerShell functionality..." -ForegroundColor Yellow
}

# ============================================================================
# Environment Setup
# ============================================================================

# Set preferred package manager
$env:PREFERRED_PACKAGE_MANAGER = "bun"

# Add Git to PATH (avoid npm paths to prevent conflicts)
$env:PATH += ";C:\Program Files\Git\cmd"

# ============================================================================
# Development Aliases
# ============================================================================

# Package Management (with warnings for npm usage)
function npm { 
    Write-Host "⚠️  Use 'bun' instead of npm for Vibe project" -ForegroundColor Yellow
    bun $args 
}
function npx { 
    Write-Host "⚠️  Use 'bunx' instead of npx for Vibe project" -ForegroundColor Yellow
    bunx $args 
}

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

# Project root environment variable for portability
if (-not $env:VIBE_PROJECTS_ROOT) {
    $env:VIBE_PROJECTS_ROOT = "D:\projects"
}

# Project Navigation
function proj { Set-Location $env:VIBE_PROJECTS_ROOT }
function vibe { Set-Location (Join-Path $env:VIBE_PROJECTS_ROOT 'vibe') }

# ============================================================================
# Vibe Game Development Functions
# ============================================================================

# Development server management
function start-vibe {
    Write-Host "🎮 Starting Vibe development environment..." -ForegroundColor Cyan
    bun run dev
}

function test-vibe {
    Write-Host "🧪 Running Vibe tests..." -ForegroundColor Cyan
    bun run test:comprehensive
}

function lint-vibe {
    Write-Host "🔍 Linting Vibe code..." -ForegroundColor Yellow
    bun run lint
}

function fix-vibe {
    Write-Host "🔧 Auto-fixing Vibe code issues..." -ForegroundColor Green
    bun run lint:fix
}

# Ticket system management
function ticket-api-status {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -TimeoutSec 5
        Write-Host "✅ Ticket API is running - Status: $($response.status)" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Ticket API is not running on port 3001" -ForegroundColor Red
    }
}

function dev-server-status {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5500" -Method Head -TimeoutSec 5
        Write-Host "✅ Dev server is running on port 5500" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Dev server is not running on port 5500" -ForegroundColor Red
    }
}

# Enhanced testing functions
function test-enhanced {
    Write-Host "🚀 Running enhanced Vibe testing system..." -ForegroundColor Cyan
    bun run test:enhanced
}

function test-mcp {
    Write-Host "🔧 Running MCP tests..." -ForegroundColor Cyan
    bun run test:mcp
}

function test-playwright {
    Write-Host "🎭 Running Playwright tests..." -ForegroundColor Cyan
    bun run test:playwright
}

# Build and cleanup
function clean-vibe {
    Write-Host "🧹 Cleaning Vibe project..." -ForegroundColor Yellow
    bun run clean
    Write-Host "✅ Cleanup complete!" -ForegroundColor Green
}

function fresh-vibe {
    Write-Host "🔄 Fresh install for Vibe..." -ForegroundColor Yellow
    bun run fresh
}

# Quick project status
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
    dev-server-status
    ticket-api-status
    
    # Dependencies
    Write-Host "`n📦 Dependencies:" -ForegroundColor Yellow
    $hasNodeModules = Test-Path "node_modules"
    $hasBunLock = Test-Path "bun.lock"
    if ($hasNodeModules -and $hasBunLock) {
        Write-Host "  ✅ Dependencies installed" -ForegroundColor Green
    } elseif ($hasBunLock) {
        Write-Host "  ⚠️  Lock file exists but node_modules missing" -ForegroundColor Yellow
    } else {
        Write-Host "  ❌ Dependencies not installed" -ForegroundColor Red
    }
    
    # Recent tickets
    Write-Host "`n🎫 Recent Tickets:" -ForegroundColor Yellow
    if (Test-Path "tests/bug-reports") {
        $recentTickets = Get-ChildItem "tests/bug-reports" -Filter "*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 3
        if ($recentTickets) {
            $recentTickets | ForEach-Object { 
                $ticket = Get-Content $_.FullName | ConvertFrom-Json
                Write-Host "  📋 $($ticket.id): $($ticket.title)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "  No recent tickets" -ForegroundColor Gray
        }
    }
}

# ============================================================================
# Enhanced Prompt with Git Integration
# ============================================================================

function prompt {
    $currentPath = $PWD.Path
    $gitBranch = ""
    $gitStatus = ""
    
    # Get Git information if in a Git repository
    if (git rev-parse --git-dir 2>$null) {
        $branch = git rev-parse --abbrev-ref HEAD 2>$null
        if ($branch) {
            $gitBranch = " $branch"
            
            # Get Git status indicators
            $status = git status --porcelain 2>$null
            if ($status) {
                $gitStatus = " ●"
            }
        }
    }
    
    # Shorten path if in projects directory
    $displayPath = $currentPath -replace [regex]::Escape("D:\projects\\"), ""
    if ($displayPath.Length -lt $currentPath.Length) {
        $displayPath = " $displayPath"
    } else {
        $displayPath = " $currentPath"
    }
    
    # Build prompt with Vibe-specific indicators
    Write-Host $displayPath -NoNewline -ForegroundColor Cyan
    if ($gitBranch) {
        Write-Host $gitBranch -NoNewline -ForegroundColor Green
        if ($gitStatus) {
            Write-Host $gitStatus -NoNewline -ForegroundColor Red
        }
    }
    
    # Add Vibe project indicator
    if ($currentPath.Contains("vibe")) {
        Write-Host " 🎮" -NoNewline -ForegroundColor Magenta
    }
    
    # Add timestamp and shell indicator
    $timestamp = Get-Date -Format "HH:mm"
    Write-Host "  $timestamp" -NoNewline -ForegroundColor DarkGray
    Write-Host "  pwsh" -NoNewline -ForegroundColor Blue
    
    return "`n❯ "
}

# ============================================================================
# Startup Messages
# ============================================================================

Clear-Host
Write-Host "🎮 Vibe Game Development Environment" -ForegroundColor Magenta
Write-Host "====================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "📁 Navigation Commands:" -ForegroundColor Yellow
Write-Host "  vibe         - Navigate to Vibe project"
Write-Host "  proj         - Navigate to projects folder"
Write-Host ""
Write-Host "🎮 Development Commands:" -ForegroundColor Yellow
Write-Host "  start-vibe   - Start development servers"
Write-Host "  vibe-status  - Show project status"
Write-Host "  test-vibe    - Run comprehensive tests"
Write-Host "  lint-vibe    - Check code quality"
Write-Host "  fix-vibe     - Auto-fix code issues"
Write-Host ""
Write-Host "🧪 Testing Commands:" -ForegroundColor Yellow
Write-Host "  test-enhanced    - Enhanced testing system"
Write-Host "  test-mcp         - MCP tests"
Write-Host "  test-playwright  - Playwright tests"
Write-Host ""
Write-Host "🔧 Maintenance Commands:" -ForegroundColor Yellow
Write-Host "  clean-vibe   - Clean project"
Write-Host "  fresh-vibe   - Fresh install"
Write-Host ""
Write-Host "🔧 Git Commands:" -ForegroundColor Yellow
Write-Host "  gs, ga, gc, gp, gl, gd, gb, gco, glog - Git shortcuts"
Write-Host ""

# Auto-navigate to Vibe project if not already there
if (-not $PWD.Path.Contains("vibe") -and (Test-Path "D:\projects\vibe")) {
    vibe
    Write-Host "📍 Auto-navigated to Vibe project" -ForegroundColor Green
}

# Check development servers on startup
if ($PWD.Path.Contains("vibe")) {
    Write-Host "🔍 Checking Vibe development environment..." -ForegroundColor Cyan
    dev-server-status
    ticket-api-status
}

# ============================================================================
# PATH Clean-up (run once per session, keep it short & deterministic)
# ============================================================================
try {
    $segments = $Env:PATH -split ';' | Where-Object { $_.Trim() } | Select-Object -Unique
    $Env:PATH = ($segments -join ';')
} catch {
    Write-Host "⚠️  PATH de-duplication skipped: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ============================================================================
# Quick Aliases – deterministic test & Bun cleanup
# ============================================================================
Set-Alias -Name testv  -Value "bun run test:orchestrated" -Force
Set-Alias -Name killbun -Value { taskkill /IM bun.exe /F } -Force

# Optional: Bun PowerShell completions (silent failure if Bun upgrades)
try {
    Invoke-Expression (& "$Env:USERPROFILE\.bun\bin\bun.exe" completions powershell) | Out-Null
} catch {} 