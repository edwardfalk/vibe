# Save as Disable-Defender-Timed.ps1
# Run as Administrator!

Write-Host "Disabling Defender real-time protection for 120 minutes..."
Set-MpPreference -DisableRealtimeMonitoring $true

$minutes = 120
for ($i = $minutes; $i -gt 0; $i--) {
    Write-Host "Defender will be re-enabled in $i minute(s)..." -NoNewline
    Start-Sleep -Seconds 60
    Write-Host "`r" -NoNewline
}

Write-Host "Re-enabling Defender real-time protection now."
Set-MpPreference -DisableRealtimeMonitoring $false
Write-Host "Defender real-time protection is ON."