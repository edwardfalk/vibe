# ============================================================================
# .cursor.ps1 – Lokal PowerShell-profil för Vibe Game
# ============================================================================

Write-Host "🎮 Laddar Vibe Game-profil..." -ForegroundColor Magenta

# Miljöinställningar
$env:PREFERRED_PACKAGE_MANAGER = "bun"
$env:ENVIRONMENT = "development"

# Navigationskommando
function vibe { Set-Location "D:\projects\vibe" }

# 🎮 Kommandon
function vibe-start  { bun run dev }
function vibe-test   { bun run test:comprehensive }
function vibe-lint   { bun run lint }
function vibe-fix    { bun run lint:fix }
function vibe-clean  { bun run clean }
function vibe-fresh  { bun run fresh }

# 🔀 Kortalias
function start-vibe  { bun run dev }
function test-vibe   { bun run test:comprehensive }
function lint-vibe   { bun run lint }
function fix-vibe    { bun run lint:fix }

# 🧪 Testkommandon
function test-enhanced    { bun run test:enhanced }
function test-mcp         { bun run test:mcp }
function test-playwright  { bun run test:playwright }

# 🌐 Portstatus
function vibe-status {
    Write-Host "🎮 Vibe Game Status" -ForegroundColor Magenta
    Write-Host "===================" -ForegroundColor Magenta

    Write-Host "`n📁 Git Status:" -ForegroundColor Yellow
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        $gitStatus | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "  Ren arbetskatalog" -ForegroundColor Green
    }

    Write-Host "`n🌐 Dev-Servrar:" -ForegroundColor Yellow
    foreach ($port in @(5500, 3001)) {
        try {
            Invoke-WebRequest -Uri "http://localhost:$port" -Method Head -TimeoutSec 2 | Out-Null
            Write-Host "  ✅ Port $port aktiv" -ForegroundColor Green
        } catch {
            Write-Host "  ❌ Port $port inte aktiv" -ForegroundColor Red
        }
    }
}
