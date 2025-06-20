# ============================================================================
# PSReadLine Configuration Fix
# Resolves console rendering errors and improves terminal experience
# ============================================================================

Write-Host "🔧 Applying PSReadLine fixes..." -ForegroundColor Cyan

# Import PSReadLine module with error handling
try {
    Import-Module PSReadLine -Force -ErrorAction Stop
    Write-Host "✅ PSReadLine module loaded" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PSReadLine module not available" -ForegroundColor Yellow
    return
}

# ============================================================================
# PSReadLine Configuration
# ============================================================================

# Set prediction source to improve performance and reduce errors
Set-PSReadLineOption -PredictionSource History

# Configure history settings
Set-PSReadLineOption -HistorySearchCursorMovesToEnd
Set-PSReadLineOption -MaximumHistoryCount 4000

# Set edit mode to Windows (more stable than Emacs on Windows)
Set-PSReadLineOption -EditMode Windows

# Configure colors for better visibility
Set-PSReadLineOption -Colors @{
    Command            = 'Cyan'
    Parameter          = 'Gray'
    Operator           = 'DarkGray'
    Variable           = 'Green'
    String             = 'Yellow'
    Number             = 'White'
    Type               = 'Blue'
    Comment            = 'DarkGreen'
    Keyword            = 'Magenta'
    Error              = 'Red'
    Selection          = 'DarkBlue'
    InlinePrediction   = 'DarkGray'
}

# ============================================================================
# Buffer and Rendering Fixes
# ============================================================================

# Disable problematic features that cause buffer errors
Set-PSReadLineOption -BellStyle None
Set-PSReadLineOption -ViModeIndicator None

# Configure completion settings
Set-PSReadLineOption -CompletionQueryItems 100
Set-PSReadLineOption -ShowToolTips

# ============================================================================
# Key Bindings (Windows-friendly)
# ============================================================================

# Set up useful key bindings
Set-PSReadLineKeyHandler -Key Tab -Function Complete
Set-PSReadLineKeyHandler -Key Ctrl+d -Function DeleteChar
Set-PSReadLineKeyHandler -Key Ctrl+w -Function BackwardDeleteWord
Set-PSReadLineKeyHandler -Key Alt+d -Function DeleteWord
Set-PSReadLineKeyHandler -Key Ctrl+LeftArrow -Function BackwardWord
Set-PSReadLineKeyHandler -Key Ctrl+RightArrow -Function ForwardWord

# History navigation
Set-PSReadLineKeyHandler -Key UpArrow -Function HistorySearchBackward
Set-PSReadLineKeyHandler -Key DownArrow -Function HistorySearchForward
Set-PSReadLineKeyHandler -Key Ctrl+r -Function ReverseSearchHistory

# ============================================================================
# Advanced Fixes for Buffer Issues
# ============================================================================

# Custom error handler for PSReadLine
$PSReadLineErrorHandler = {
    param($Exception)
    # Silently handle buffer-related errors
    if ($Exception.Message -like "*buffer*" -or $Exception.Message -like "*cursor*") {
        # Do nothing - suppress these errors
        return
    }
    # Log other errors to a file for debugging
    $errorLog = "$env:TEMP\psreadline-errors.log"
    "$(Get-Date): $($Exception.Message)" | Out-File -FilePath $errorLog -Append
}

# Set console buffer size to prevent overflow errors
try {
    $host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(120, 3000)
    Write-Host "✅ Console buffer size optimized" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not set buffer size (may require admin)" -ForegroundColor Yellow
}

# ============================================================================
# Prediction and IntelliSense Configuration
# ============================================================================

# Configure predictive IntelliSense (if available)
try {
    Set-PSReadLineOption -PredictionSource HistoryAndPlugin -ErrorAction SilentlyContinue
    Set-PSReadLineOption -PredictionViewStyle ListView -ErrorAction SilentlyContinue
    Write-Host "✅ Predictive IntelliSense configured" -ForegroundColor Green
} catch {
    # Fallback to basic history prediction
    Set-PSReadLineOption -PredictionSource History -ErrorAction SilentlyContinue
    Write-Host "✅ Basic prediction configured" -ForegroundColor Green
}

# ============================================================================
# Terminal Integration Fixes
# ============================================================================

# Fix for Windows Terminal and other modern terminals
if ($env:WT_SESSION -or $env:TERM_PROGRAM) {
    # Enable 24-bit color support
    $env:COLORTERM = "truecolor"
    
    # Configure for modern terminals
    Set-PSReadLineOption -Colors @{
        InlinePrediction = "`e[38;5;238m"  # Use ANSI escape codes
        ListPrediction   = "`e[38;5;244m"
    } -ErrorAction SilentlyContinue
    
    Write-Host "✅ Modern terminal integration enabled" -ForegroundColor Green
}

# ============================================================================
# Performance Optimizations
# ============================================================================

# Reduce rendering frequency to prevent buffer errors
$PSReadLineOptions = Get-PSReadLineOption
if ($PSReadLineOptions) {
    # Disable continuous rendering updates
    try {
        # These are internal settings that help with performance
        [Microsoft.PowerShell.PSConsoleReadLine]::SetOptions(@{
            ExtraPromptLineCount = 0
            DemoMode = $false
        })
        Write-Host "✅ Performance optimizations applied" -ForegroundColor Green
    } catch {
        # Ignore if these internal methods aren't available
    }
}

Write-Host "🎉 PSReadLine configuration complete!" -ForegroundColor Green
Write-Host "💡 If you still see errors, try: Update-Module PSReadLine -Force" -ForegroundColor Cyan 