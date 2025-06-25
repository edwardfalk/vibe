# ============================================================================
# Optimized Multi-Project PowerShell Profile
# ============================================================================

# Set PowerShell to UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ============================================================================
# PSReadLine Configuration (Fix Console Errors)
# ============================================================================

# Import and configure PSReadLine to prevent console errors
if (Get-Module -ListAvailable PSReadLine) {
    try {
        Import-Module PSReadLine -Force -ErrorAction SilentlyContinue
        
        # Core settings to prevent buffer errors
        Set-PSReadLineOption -PredictionSource History -ErrorAction SilentlyContinue
        Set-PSReadLineOption -EditMode Windows -ErrorAction SilentlyContinue
        Set-PSReadLineOption -BellStyle None -ErrorAction SilentlyContinue
        Set-PSReadLineOption -ViModeIndicator None -ErrorAction SilentlyContinue
        
        # Set console buffer size to prevent overflow
        try {
            $host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(120, 3000)
        } catch {
            # Ignore if can't set buffer size
        }
        
        # Configure colors
        Set-PSReadLineOption -Colors @{
            Command            = 'Cyan'
            Parameter          = 'Gray'
            String             = 'Yellow'
            InlinePrediction   = 'DarkGray'
        } -ErrorAction SilentlyContinue
        
    } catch {
        # Silently continue if PSReadLine configuration fails
    }
}

# ============================================================================
# Common Setup (All Projects) - Loaded Once
# ============================================================================

# Enhanced File Operations
Set-Alias -Name cat -Value bat -Force -ErrorAction SilentlyContinue
Set-Alias -Name grep -Value rg -Force -ErrorAction SilentlyContinue
Set-Alias -Name find -Value fd -Force -ErrorAction SilentlyContinue
Set-Alias -Name ls -Value eza -Force -ErrorAction SilentlyContinue
Set-Alias -Name ll -Value "eza -la" -Force -ErrorAction SilentlyContinue

# Git Shortcuts (Global)
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
# Project Configuration Registry (Scalable)
# ============================================================================

$Global:ProjectConfigs = @{
    "vibe" = @{
        Name = "Vibe Game"
        Icon = "🎮"
        Color = "Magenta"
        PackageManager = "bun"
        DevPorts = @(5500, 3001)
        Commands = @{
            "start" = "bun run dev"
            "test" = "bun run test:comprehensive"
            "lint" = "bun run lint"
            "fix" = "bun run lint:fix"
            "clean" = "bun run clean"
            "fresh" = "bun run fresh"
        }
        TestCommands = @{
            "enhanced" = "bun run test:enhanced"
            "mcp" = "bun run test:mcp"
            "playwright" = "bun run test:playwright"
        }
    }
    "cursor-ai-intelligence" = @{
        Name = "Cursor AI Intelligence"
        Icon = "🤖"
        Color = "Blue"
        PackageManager = "bun"
        DevPorts = @(54321)
        Commands = @{
            "start" = "start-hub"
            "test" = "test-all"
            "build" = "build-all"
        }
    }
    # Easy to add more projects:
    # "my-next-project" = @{
    #     Name = "My Next Project"
    #     Icon = "🚀"
    #     Color = "Green"
    #     PackageManager = "npm"
    #     DevPorts = @(3000)
    #     Commands = @{
    #         "start" = "npm run dev"
    #         "test" = "npm test"
    #     }
    # }
}

# ============================================================================
# Dynamic Project Detection (Optimized)
# ============================================================================

function Get-CurrentProject {
    $currentPath = $PWD.Path.ToLower()
    
    # Cache the last detected project to avoid repeated lookups
    if ($Global:LastPath -eq $currentPath -and $Global:LastProject) {
        return $Global:LastProject
    }
    
    # Find matching project (optimized lookup)
    foreach ($projectKey in $Global:ProjectConfigs.Keys) {
        # SECURITY: Only use trusted config values for dynamic code execution below.
        # If $projectKey is ever user-controlled, sanitize it to prevent code injection.
        if ($currentPath -match "[\\/]$projectKey([\\/]|$)") {
            $Global:LastPath = $currentPath
            $Global:LastProject = $projectKey
            return $projectKey
        }
    }
    
    $Global:LastPath = $currentPath
    $Global:LastProject = $null
    return $null
}

# ============================================================================
# Dynamic Function Generation (Lazy Loading)
# ============================================================================

function Load-ProjectProfile {
    $project = Get-CurrentProject
    
    if (-not $project) {
        return
    }
    
    $config = $Global:ProjectConfigs[$project]
    if (-not $config) {
        return
    }
    
    # Only load if not already loaded for this project
    if ($Global:LoadedProject -eq $project) {
        return
    }
    
    Write-Host "$($config.Icon) Loading $($config.Name) Profile..." -ForegroundColor $config.Color
    
    # Clear previous project functions
    if ($Global:LoadedProject) {
        Clear-ProjectFunctions
    }
    
    # Generate navigation function
    $navFunction = "function global:$project { Set-Location \`"D:\projects\$project\`" }"
    # SECURITY: Only use trusted config values for dynamic code execution below.
    Invoke-Expression $navFunction
    
    # Generate project commands dynamically
    foreach ($cmdName in $config.Commands.Keys) {
        $cmdValue = $config.Commands[$cmdName]
        $functionName = "$project-$cmdName"
        
        # Create function in global scope
        $functionDef = "function global:$functionName { $cmdValue }"
        Invoke-Expression $functionDef
        
        # Create short aliases for current project
        $shortName = "$cmdName-$($project.Split('-')[0])"  # e.g., "start-vibe"
        $aliasDef = "function global:$shortName { $cmdValue }"
        Invoke-Expression $aliasDef
    }
    
    # Generate test commands if they exist
    if ($config.TestCommands) {
        foreach ($testName in $config.TestCommands.Keys) {
            $testValue = $config.TestCommands[$testName]
            $functionName = "test-$testName"
            $functionDef = "function global:$functionName { $testValue }"
            Invoke-Expression $functionDef
        }
    }
    
    # Set package manager preferences
    if ($config.PackageManager -eq "bun") {
        function global:npm { 
            Write-Host "⚠️  Use 'bun' instead of npm for $($config.Name)" -ForegroundColor Yellow
            bun $args 
        }
        function global:npx { 
            Write-Host "⚠️  Use 'bunx' instead of npx for $($config.Name)" -ForegroundColor Yellow
            bunx $args 
        }
        $env:PREFERRED_PACKAGE_MANAGER = "bun"
    }
    
    # Generate status function
    $statusFunction = @"
function $project-status {
    Write-Host "$($config.Icon) $($config.Name) Status" -ForegroundColor $($config.Color)
    Write-Host "$('=' * ($($config.Name).Length + 8))" -ForegroundColor $($config.Color)
    
    # Git status
    Write-Host "``n📁 Git Status:" -ForegroundColor Yellow
    `$gitStatus = git status --porcelain
    if (`$gitStatus) {
        `$gitStatus | ForEach-Object { Write-Host "  `$_" }
    } else {
        Write-Host "  Clean working directory" -ForegroundColor Green
    }
    
    # Check development servers
    Write-Host "``n🌐 Development Servers:" -ForegroundColor Yellow
"@
    
    # Add port checks for each configured port
    foreach ($port in $config.DevPorts) {
        $statusFunction += @"
    try {
        `$response = Invoke-WebRequest -Uri "http://localhost:$port" -Method Head -TimeoutSec 2
        Write-Host "  ✅ Server running on port $port" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Server not running on port $port" -ForegroundColor Red
    }
"@
    }
    
    $statusFunction += "`n}"
    Invoke-Expression $statusFunction
    
    $Global:LoadedProject = $project
    
    # Show available commands
    $commands = ($config.Commands.Keys | ForEach-Object { "$project-$_" }) -join ", "
    Write-Host "$($config.Icon) Available commands: $commands" -ForegroundColor Cyan
}

function Clear-ProjectFunctions {
    # Remove dynamically created functions (optional cleanup)
    # This prevents function pollution but requires more complex tracking
    # For most use cases, function overriding is sufficient
}

# ============================================================================
# Enhanced Prompt (Optimized)
# ============================================================================

function prompt {
    $currentPath = $PWD.Path
    $project = Get-CurrentProject
    $config = if ($project) { $Global:ProjectConfigs[$project] } else { $null }
    
    # Git info (cached for performance)
    $gitBranch = ""
    $gitStatus = ""
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
    
    if ($config) {
        Write-Host " $($config.Icon)" -NoNewline -ForegroundColor $config.Color
    }
    
    $timestamp = Get-Date -Format "HH:mm"
    Write-Host "  $timestamp" -NoNewline -ForegroundColor DarkGray
    Write-Host "  pwsh" -NoNewline -ForegroundColor Blue
    
    return "`n❯ "
}

# ============================================================================
# Auto-reload on directory change (Optimized)
# ============================================================================

$originalSetLocation = Get-Command Set-Location
function Set-Location {
    & $originalSetLocation @args
    
    # Only reload if we've actually changed projects
    $newProject = Get-CurrentProject
    if ($newProject -ne $Global:LoadedProject) {
        Load-ProjectProfile
    }
}

# ============================================================================
# Startup
# ============================================================================

Clear-Host
Write-Host "🚀 Multi-Project Development Environment" -ForegroundColor Magenta
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "📊 Configured Projects: $($Global:ProjectConfigs.Count)" -ForegroundColor Gray

# Load appropriate profile based on current location
Load-ProjectProfile 