# PowerShell Issues Troubleshooting Guide

## 🚨 Critical Issue Identified

**Date**: January 9, 2025  
**Status**: ACTIVE - Requires immediate attention  
**Severity**: HIGH - Affects all PowerShell operations

## 📋 Issue Summary

### Primary Problem: PSReadLine Buffer Overflow
- **Error**: `ArgumentOutOfRangeException: The value must be greater than or equal to zero and less than the console's buffer size`
- **Root Cause**: Terminal buffer height is only 1 line (`BufferWidth: 95, BufferHeight: 1`)
- **Impact**: PowerShell commands hang, chat freezes, development workflow disrupted

### Affected Commands
- ✅ **Working**: Simple commands like `$PSVersionTable`, `Get-Location`
- ❌ **Failing**: `Remove-Item`, `Get-Module -ListAvailable`, complex scripts
- ❌ **Hanging**: Any command that triggers PSReadLine rendering

## 🔍 Technical Analysis

### Environment Details
```
PSReadLine: 2.3.6+d2e770f93b7a53d8660a6402eb29d1ae1c35e767
PowerShell: 7.5.1
OS: Microsoft Windows 10.0.26100
BufferWidth: 95
BufferHeight: 1  ← PROBLEM
```

### Error Pattern
```
System.ArgumentOutOfRangeException: The value must be greater than or equal to zero and less than the console's buffer size in that dimension. (Parameter 'top')
Actual value was 1-4.
   at System.ConsolePal.SetCursorPosition(Int32 left, Int32 top)
   at Microsoft.PowerShell.PSConsoleReadLine.ReallyRender(...)
```

## 🛠️ Attempted Solutions

### 1. PSReadLine Fix Script ❌
- **Location**: `scripts/powershell/psreadline-fix.ps1`
- **Status**: Cannot execute due to buffer issue
- **Problem**: Script itself triggers PSReadLine errors

### 2. No-Profile Execution ❌
- **Command**: `powershell -NoProfile -Command "..."`
- **Status**: Still fails
- **Problem**: PSReadLine is loaded regardless of profile

### 3. Buffer Size Adjustment ⚠️
- **Command**: `$host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(120, 3000)`
- **Status**: Requires execution, but execution fails due to buffer issue
- **Problem**: Chicken-and-egg scenario

## 🎯 Recommended Solutions

### Immediate Workarounds

1. **Use Simple Commands Only**
   ```powershell
   # ✅ These work
   pwd
   ls
   $PSVersionTable
   
   # ❌ Avoid these
   Remove-Item -Force
   Get-Module -ListAvailable
   Complex scripts
   ```

2. **Use Alternative Tools**
   ```bash
   # Use cmd for file operations
   del filename.ext
   dir
   
   # Use Git Bash for complex operations
   rm filename.ext
   ls -la
   ```

3. **Restart Terminal Session**
   - Close and reopen terminal
   - May temporarily resolve buffer issues

### Long-term Solutions

1. **Update PSReadLine Module**
   ```powershell
   # When terminal is stable
   Update-Module PSReadLine -Force
   Install-Module PSReadLine -Force -SkipPublisherCheck
   ```

2. **Terminal Configuration**
   - Check Windows Terminal settings
   - Verify Cursor IDE terminal configuration
   - Ensure adequate buffer size allocation

3. **PowerShell Profile Optimization**
   - Disable problematic PSReadLine features
   - Use minimal profile configuration
   - Implement buffer size fixes in profile

## 🔧 Emergency Fix Script

**File**: `scripts/powershell/emergency-psreadline-fix.ps1`

```powershell
# Emergency PSReadLine fix - run when terminal is stable
try {
    # Disable PSReadLine temporarily
    Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
    
    # Set buffer size
    $host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(120, 3000)
    
    # Re-import with safe settings
    Import-Module PSReadLine -Force
    Set-PSReadLineOption -EditMode Windows
    Set-PSReadLineOption -BellStyle None
    Set-PSReadLineOption -PredictionSource History
    
    Write-Host "✅ PSReadLine emergency fix applied" -ForegroundColor Green
} catch {
    Write-Host "❌ Emergency fix failed: $($_.Exception.Message)" -ForegroundColor Red
}
```

## 📊 Impact Assessment

### Development Workflow Impact
- **High**: PowerShell-based scripts cannot be executed reliably
- **Medium**: File operations require workarounds
- **Low**: Core development (editing, git) unaffected

### Project Cleanup Impact
- ✅ **Completed**: File reorganization successful
- ✅ **Completed**: Script consolidation successful  
- ❌ **Blocked**: Script testing requires stable PowerShell
- ❌ **Blocked**: PowerShell profile optimization

## 📋 Action Items

### Immediate (Today)
- [x] Document issue comprehensively
- [x] Identify workarounds for critical operations
- [ ] Test alternative terminals (cmd, Git Bash)
- [ ] Verify core project functionality

### Short-term (This Week)
- [ ] Research PSReadLine 2.3.6 known issues
- [ ] Test PowerShell 7.6 preview
- [ ] Configure Windows Terminal buffer settings
- [ ] Implement emergency fix when stable

### Long-term (Next Sprint)
- [ ] Establish stable PowerShell environment
- [ ] Complete script testing and validation
- [ ] Optimize development environment
- [ ] Update team documentation

## 🔗 References

- [PSReadLine GitHub Issues](https://github.com/PowerShell/PSReadLine/issues)
- [PowerShell Buffer Size Documentation](https://docs.microsoft.com/en-us/powershell/)
- [Windows Terminal Configuration](https://docs.microsoft.com/en-us/windows/terminal/)

---

**Last Updated**: January 9, 2025  
**Next Review**: When PowerShell stability is restored 