# NovaPress AI v2 - Development Startup Script (PowerShell)
# Starts both Frontend (Next.js) and Backend (Flask)

Write-Host "🚀 Starting NovaPress AI v2 Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Python 3 is not installed. Please install Python 3.10+" -ForegroundColor Yellow
    exit 1
}

# Check if Node is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Node.js is not installed. Please install Node.js 18+" -ForegroundColor Yellow
    exit 1
}

# Setup Python virtual environment if not exists
if (-not (Test-Path "backend\venv")) {
    Write-Host "📦 Creating Python virtual environment..." -ForegroundColor Blue
    python -m venv backend\venv
    .\backend\venv\Scripts\Activate.ps1
    pip install -r backend\requirements.txt
} else {
    .\backend\venv\Scripts\Activate.ps1
}

# Install Node dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing Node.js dependencies..." -ForegroundColor Blue
    npm install
}

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Starting services..." -ForegroundColor Blue
Write-Host ""

# Start Backend
Write-Host "🐍 Starting Backend API (Flask) on http://localhost:5000..." -ForegroundColor Blue
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    .\backend\venv\Scripts\Activate.ps1
    python backend\api.py
}

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "⚛️  Starting Frontend (Next.js) on http://localhost:3000..." -ForegroundColor Blue
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run dev
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "🎉 NovaPress AI v2 is running!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:3000"
Write-Host "  Backend:   " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:5000/api"
Write-Host "  API Health:" -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:5000/api/health"
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Monitor jobs
try {
    while ($true) {
        Receive-Job -Job $backendJob
        Receive-Job -Job $frontendJob
        Start-Sleep -Seconds 1

        if ($backendJob.State -eq 'Failed' -or $frontendJob.State -eq 'Failed') {
            Write-Host "❌ One of the services failed" -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host ""
    Write-Host "🛑 Stopping services..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob, $frontendJob
    Remove-Job -Job $backendJob, $frontendJob
}
