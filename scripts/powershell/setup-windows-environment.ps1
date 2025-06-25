# Windows Development Environment Setup for Vibe Game
# Fixes bash/PowerShell path issues and ensures proper Windows development environment

param(
    [switch]$Verbose,
    [switch]$FixPaths,
    [switch]$TestOnly
)

# Enhanced logging with emojis
function Write-LogMessage {
    param(
        [string]$Category,
        [string]$Message,
        [string]$Level = "Info"
    )
    
    $emojis = @{
        "check" = "🔍"
        "pass" = "✅"
        "fail" = "❌"
        "warn" = "⚠️"
        "info" = "ℹ️"
        "fix" = "🔧"
        "test" = "🧪"
        "env" = "🌐"
        "path" = "📁"
        "tool" = "🛠️"
        "success" = "🎉"
    }
    
    $emoji = $emojis[$Category] ?? "📝"
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    switch ($Level) {
        "Error" { Write-Host "$emoji [$timestamp] $Message" -ForegroundColor Red }
        "Warning" { Write-Host "$emoji [$timestamp] $Message" -ForegroundColor Yellow }
        "Success" { Write-Host "$emoji [$timestamp] $Message" -ForegroundColor Green }
        default { Write-Host "$emoji [$timestamp] $Message" -ForegroundColor White }
    }
}

# Check if running in PowerShell
function Test-PowerShellEnvironment {
    Write-LogMessage "check" "Verifying PowerShell environment..."
    
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        Write-LogMessage "fail" "PowerShell 7+ required. Current version: $($PSVersionTable.PSVersion). Please upgrade to continue." "Error"
        return $false
    }
    
    Write-LogMessage "pass" "PowerShell $($PSVersionTable.PSVersion) detected" "Success"
    return $true
}

# Verify we're in the correct directory
function Test-ProjectDirectory {
    Write-LogMessage "check" "Verifying project directory..."
    
    $currentPath = Get-Location
    Write-LogMessage "path" "Current directory: $currentPath"
    
    # Check for key files
    $keyFiles = @("package.json", "index.html", "js", "enhanced-testing-system.js")
    $missingFiles = @()
    
    foreach ($file in $keyFiles) {
        if (-not (Test-Path $file)) {
            $missingFiles += $file
        }
    }
    
    if ($missingFiles.Count -gt 0) {
        Write-LogMessage "fail" "Missing key files: $($missingFiles -join ', ')" "Error"
        Write-LogMessage "info" "Please run this script from the Vibe project root directory"
        return $false
    }
    
    Write-LogMessage "pass" "Project directory verified" "Success"
    return $true
}

# Test Bun installation and functionality
function Test-BunInstallation {
    Write-LogMessage "check" "Testing Bun installation..."
    
    try {
        $bunVersion = bun --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-LogMessage "pass" "Bun version: $bunVersion" "Success"
            return $true
        }
    }
    catch {
        Write-LogMessage "fail" "Bun not found or not working" "Error"
        Write-LogMessage "info" "Please install Bun: https://bun.sh/docs/installation"
        return $false
    }
    
    return $false
}

# Test ESLint with proper Windows paths
function Test-ESLintConfiguration {
    Write-LogMessage "check" "Testing ESLint configuration..."
    
    try {
        # Test ESLint version first
        $eslintVersion = bunx eslint --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-LogMessage "pass" "ESLint version: $eslintVersion" "Success"
            
            # Test with a specific file using Windows path
            $testFile = "js\visualEffects.js"
            if (Test-Path $testFile) {
                Write-LogMessage "test" "Testing ESLint on $testFile..."
                $eslintResult = bunx eslint $testFile 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-LogMessage "pass" "ESLint working with Windows paths" "Success"
                    return $true
                } else {
                    Write-LogMessage "warn" "ESLint found issues (this is normal)" "Warning"
                    return $true
                }
            }
        }
    }
    catch {
        Write-LogMessage "fail" "ESLint configuration issues" "Error"
        return $false
    }
    
    return $false
}

# Test the enhanced testing system
function Test-EnhancedTestingSystem {
    Write-LogMessage "check" "Testing enhanced testing system..."
    
    if (-not (Test-Path "enhanced-testing-system.js")) {
        Write-LogMessage "fail" "Enhanced testing system not found" "Error"
        return $false
    }
    
    try {
        # Check for ES module support in package.json
        $packageJsonPath = "package.json"
        $isESModule = $false
        if (Test-Path $packageJsonPath) {
            $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
            if ($packageJson.type -eq "module") {
                $isESModule = $true
            }
        }
        if (-not $isESModule) {
            Write-LogMessage "warn" "package.json does not specify 'type: module'. Node.js ES module import may fail. Skipping import test." "Warning"
            return $false
        }
        Write-LogMessage "test" "Running enhanced testing system verification..."
        # Just verify the file can be imported without running full tests
        $testResult = node -e "import('./enhanced-testing-system.js').then(() => console.log('Import successful')).catch(e => { console.error('Import failed:', e.message); process.exit(1); })" 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-LogMessage "pass" "Enhanced testing system verified" "Success"
            return $true
        } else {
            Write-LogMessage "fail" "Enhanced testing system has import issues" "Error"
            return $false
        }
    }
    catch {
        Write-LogMessage "fail" "Error testing enhanced testing system: $_" "Error"
        return $false
    }
}

# Fix common path issues
function Repair-PathIssues {
    Write-LogMessage "fix" "Fixing common path issues..."
    
    # Ensure package.json scripts use Windows-compatible commands
    $packageJsonPath = "package.json"
    if (Test-Path $packageJsonPath) {
        $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
        
        # Check if scripts need Windows path fixes
        $needsUpdate = $false
        
        # Example: ensure lint script uses proper quotes for Windows
        if ($packageJson.scripts.lint -and $packageJson.scripts.lint -notmatch '".*"') {
            Write-LogMessage "fix" "Updating lint script for Windows compatibility"
            $needsUpdate = $true
        }
        
        if ($needsUpdate) {
            Write-LogMessage "info" "Package.json scripts updated for Windows compatibility"
            try {
                # Example: update lint script to use double quotes if missing
                if ($packageJson.scripts.lint -and $packageJson.scripts.lint -notmatch '".*"') {
                    $packageJson.scripts.lint = '"' + $packageJson.scripts.lint + '"'
                }
                $packageJson | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath -Encoding UTF8
                Write-LogMessage "pass" "Updated package.json scripts for Windows compatibility" "Success"
            } catch {
                Write-LogMessage "fail" "Failed to update package.json: $_" "Error"
            }
        }
    }
    
    Write-LogMessage "pass" "Path issues checked and addressed" "Success"
}

# Test development server startup
function Test-DevelopmentServer {
    Write-LogMessage "check" "Testing development server startup..."
    
    try {
        Write-LogMessage "test" "Starting development server (will stop after verification)..."
        
        # Start the server in background
        $serverJob = Start-Job -ScriptBlock {
            Set-Location $using:PWD
            bun run serve 2>$null
        }
        
        # Wait a few seconds for startup
        Start-Sleep -Seconds 5
        
        # Check if server is running on port 5500
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:5500" -TimeoutSec 3 -ErrorAction Stop
            Write-LogMessage "pass" "Development server started successfully" "Success"
            $serverWorking = $true
        }
        catch {
            Write-LogMessage "warn" "Development server may not be fully ready" "Warning"
            $serverWorking = $false
        }
        
        # Stop the server
        Stop-Job $serverJob -ErrorAction SilentlyContinue
        Remove-Job $serverJob -ErrorAction SilentlyContinue
        
        return $serverWorking
    }
    catch {
        Write-LogMessage "fail" "Error testing development server: $_" "Error"
        return $false
    }
}

# Main execution
function Main {
    Write-LogMessage "success" "=".PadRight(60, "=")
    Write-LogMessage "success" "VIBE GAME - WINDOWS ENVIRONMENT SETUP"
    Write-LogMessage "success" "=".PadRight(60, "=")
    
    $allPassed = $true
    $results = @{}
    
    # Run all tests
    $results["PowerShell"] = Test-PowerShellEnvironment
    $results["ProjectDirectory"] = Test-ProjectDirectory
    $results["Bun"] = Test-BunInstallation
    $results["ESLint"] = Test-ESLintConfiguration
    $results["TestingSystem"] = Test-EnhancedTestingSystem
    
    if ($FixPaths) {
        Repair-PathIssues
    }
    
    if (-not $TestOnly) {
        $results["DevServer"] = Test-DevelopmentServer
    }
    
    # Summary
    Write-LogMessage "success" "`n📊 ENVIRONMENT VERIFICATION SUMMARY:"
    
    foreach ($test in $results.GetEnumerator()) {
        $status = if ($test.Value) { "✅ PASS" } else { "❌ FAIL" }
        Write-LogMessage "info" "$($test.Key): $status"
        
        if (-not $test.Value) {
            $allPassed = $false
        }
    }
    
    Write-LogMessage "success" "`n🎯 RECOMMENDATIONS:"
    
    if ($allPassed) {
        Write-LogMessage "success" "✅ Excellent! Your Windows development environment is properly configured."
        Write-LogMessage "success" "   You can now run tests and development commands with confidence."
        Write-LogMessage "success" "   Try: bun run dev"
        Write-LogMessage "success" "   Try: node enhanced-testing-system.js"
    } else {
        Write-LogMessage "warn" "⚠️ Some issues were found. Please address the failed items above." "Warning"
        Write-LogMessage "info" "   Re-run this script after fixing issues: .\setup-windows-environment.ps1"
    }
    
    Write-LogMessage "success" "`n🚀 NEXT STEPS FOR TESTING:"
    Write-LogMessage "info" "1. Run: bun run dev (starts development server)"
    Write-LogMessage "info" "2. Run: node enhanced-testing-system.js (comprehensive testing)"
    Write-LogMessage "info" "3. Open: http://localhost:5500 (test the game)"
    
    Write-LogMessage "success" "=".PadRight(60, "=")
    
    return $allPassed
}

# Execute main function
$success = Main

if ($success) {
    exit 0
} else {
    exit 1
} 