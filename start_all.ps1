# NovaPress AI v2 - Quick Start Script (PowerShell Native)
# Starts Frontend (Next.js) + Backend (FastAPI) in separate windows

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "   🚀 NovaPress AI v2 - Quick Start" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Check Docker services
Write-Host "🐳 Checking Docker services..." -ForegroundColor Yellow
try {
    $dockerRunning = docker ps 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker is running" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    Write-Host "   Services required: PostgreSQL, Redis, Qdrant" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Start Backend (PowerShell Native)
Write-Host "🐍 Starting Backend (FastAPI)..." -ForegroundColor Blue
$backendScript = @"
Write-Host '🐍 Backend Starting...' -ForegroundColor Blue
cd '$PWD\backend'
.\venv\Scripts\Activate.ps1
Write-Host '🚀 Launching FastAPI on http://localhost:5000...' -ForegroundColor Green
uvicorn app.main:app --reload --port 5000
"@

$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -PassThru

# Wait for backend
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "⚛️  Starting Frontend (Next.js)..." -ForegroundColor Blue
$frontendScript = @"
Write-Host '⚛️  Frontend Starting...' -ForegroundColor Blue
cd '$PWD'
Write-Host '🚀 Launching Next.js on http://localhost:3000...' -ForegroundColor Green
npm run dev
"@

$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -PassThru

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "   ✅ NovaPress AI v2 is running!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "  📱 Frontend:    " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:3000"
Write-Host "  🔌 Backend API: " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:5000"
Write-Host "  📚 API Docs:    " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:5000/api/docs"
Write-Host ""
Write-Host "Press any key to stop all services..." -ForegroundColor Yellow
Write-Host ""

$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "🛑 Stopping services..." -ForegroundColor Yellow
Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
Stop-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue
Write-Host "✅ Services stopped." -ForegroundColor Green
