# NovaPress AI v2 - Kanban Launcher
# Usage: .\kanban.ps1 ou clic droit > Executer avec PowerShell

param(
    [switch]$SkipDocker,
    [switch]$SkipBackend,
    [switch]$NoBrowser
)

$Host.UI.RawUI.WindowTitle = "NovaPress Kanban"

# Couleurs
function Write-Step { param($msg) Write-Host "`n[$((Get-Date).ToString('HH:mm:ss'))] " -NoNewline -ForegroundColor DarkGray; Write-Host $msg -ForegroundColor Cyan }
function Write-OK { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "  [ERROR] $msg" -ForegroundColor Red }

# Banner
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     NovaPress AI v2 - Kanban Viewer      ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ProjectDir = $PSScriptRoot
$BackendDir = Join-Path $ProjectDir "backend"
$KanbanUrl = "http://localhost:3000/dev/kanban"

# 1. Docker
if (-not $SkipDocker) {
    Write-Step "Verification Docker..."

    $dockerRunning = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Docker n'est pas demarre"
        Write-Host "  Tentative de lancement de Docker Desktop..." -ForegroundColor Gray

        $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerPath) {
            Start-Process $dockerPath
            Write-Host "  Attente du demarrage (45s)..." -ForegroundColor Gray
            Start-Sleep -Seconds 45
        } else {
            Write-Err "Docker Desktop non trouve. Installez Docker ou utilisez -SkipDocker"
        }
    } else {
        Write-OK "Docker est actif"
    }

    # Demarrer les containers
    Write-Step "Demarrage des containers..."
    Set-Location $BackendDir
    docker-compose up -d 2>$null

    if ($LASTEXITCODE -eq 0) {
        Write-OK "PostgreSQL, Redis, Qdrant demarres"
    } else {
        Write-Warn "Probleme avec docker-compose (peut-etre deja demarre)"
    }
}

# 2. Backend
if (-not $SkipBackend) {
    Write-Step "Demarrage du Backend FastAPI (port 5000)..."

    # Verifier si deja actif
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-OK "Backend deja actif"
    } catch {
        # Lancer le backend
        $backendCmd = "cd '$BackendDir'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 5000"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
        Write-OK "Backend lance dans une nouvelle fenetre"
    }
}

# 3. Frontend
Write-Step "Demarrage du Frontend Next.js (port 3000)..."

# Verifier si deja actif
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-OK "Frontend deja actif"
} catch {
    # Lancer le frontend
    Set-Location $ProjectDir
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectDir'; npm run dev"
    Write-OK "Frontend lance dans une nouvelle fenetre"
    Write-Host "  Attente du demarrage (15s)..." -ForegroundColor Gray
    Start-Sleep -Seconds 15
}

# 4. Ouvrir le navigateur
if (-not $NoBrowser) {
    Write-Step "Ouverture du Kanban..."
    Start-Process $KanbanUrl
    Write-OK "Navigateur ouvert"
}

# Resume
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║           Services Actifs                ║" -ForegroundColor Green
Write-Host "  ╠══════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "  ║  Frontend:  http://localhost:3000        ║" -ForegroundColor Green
Write-Host "  ║  Backend:   http://localhost:5000        ║" -ForegroundColor Green
Write-Host "  ║  Kanban:    http://localhost:3000/dev/kanban" -ForegroundColor White -NoNewline
Write-Host "  ║" -ForegroundColor Green
Write-Host "  ║  API Docs:  http://localhost:5000/api/docs" -ForegroundColor Green -NoNewline
Write-Host " ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Afficher stats du Kanban
$featuresPath = Join-Path $ProjectDir ".claude\features.json"
if (Test-Path $featuresPath) {
    $features = Get-Content $featuresPath -Raw | ConvertFrom-Json
    $total = $features.metadata.total_features
    $completed = $features.metadata.completed
    $inProgress = $features.metadata.in_progress
    $pending = $features.metadata.pending
    $progress = [math]::Round(($completed / $total) * 100)

    Write-Host "  ┌────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  Progression: " -NoNewline -ForegroundColor DarkGray

    # Barre de progression
    $barLength = 20
    $filledLength = [math]::Round($progress / 100 * $barLength)
    $bar = ("█" * $filledLength) + ("░" * ($barLength - $filledLength))
    Write-Host "$bar" -NoNewline -ForegroundColor Cyan
    Write-Host " $progress%" -NoNewline -ForegroundColor White
    Write-Host "   │" -ForegroundColor DarkGray

    Write-Host "  │  " -NoNewline -ForegroundColor DarkGray
    Write-Host "Pending: $pending" -NoNewline -ForegroundColor Gray
    Write-Host " | " -NoNewline -ForegroundColor DarkGray
    Write-Host "In Progress: $inProgress" -NoNewline -ForegroundColor Yellow
    Write-Host " | " -NoNewline -ForegroundColor DarkGray
    Write-Host "Done: $completed" -NoNewline -ForegroundColor Green
    Write-Host "  │" -ForegroundColor DarkGray

    Write-Host "  └────────────────────────────────────────┘" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  Appuyez sur Entree pour fermer..." -ForegroundColor DarkGray
Read-Host
