# NovaPress AI v2 - Script d'initialisation pour Claude
# Usage: .\.claude\init.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NovaPress AI v2 - Initialisation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Variables
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$BACKEND_DIR = Join-Path $PROJECT_ROOT "backend"
$FRONTEND_DIR = $PROJECT_ROOT

# Fonction pour verifier un service
function Test-Service {
    param (
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSec = 5
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        Write-Host "[OK] $Name" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 1. Verifier Docker
Write-Host "`n[1/5] Verification Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Docker est en cours d'execution" -ForegroundColor Green

    # Verifier les containers
    $containers = docker ps --format "{{.Names}}"
    $requiredContainers = @("novapress_postgres", "novapress_redis", "novapress_qdrant")

    foreach ($container in $requiredContainers) {
        if ($containers -contains $container) {
            Write-Host "  [OK] $container" -ForegroundColor Green
        }
        else {
            Write-Host "  [WARN] $container non trouve - demarrage..." -ForegroundColor Yellow
            Set-Location $BACKEND_DIR
            docker-compose up -d
            break
        }
    }
}
else {
    Write-Host "[FAIL] Docker n'est pas en cours d'execution!" -ForegroundColor Red
    Write-Host "  Lancez Docker Desktop et reessayez." -ForegroundColor Yellow
    exit 1
}

# 2. Verifier le Backend
Write-Host "`n[2/5] Verification Backend (port 5000)..." -ForegroundColor Yellow
$backendOk = Test-Service -Name "Backend FastAPI" -Url "http://localhost:5000/api/health"

if (-not $backendOk) {
    Write-Host "  Tentative de demarrage du backend..." -ForegroundColor Yellow
    Set-Location $BACKEND_DIR

    # Activer venv
    if (Test-Path ".\venv\Scripts\Activate.ps1") {
        & .\venv\Scripts\Activate.ps1
    }

    # Demarrer uvicorn en arriere-plan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BACKEND_DIR'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 5000"

    Write-Host "  Backend demarre dans une nouvelle fenetre." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
}

# 3. Verifier le Frontend
Write-Host "`n[3/5] Verification Frontend (port 3000)..." -ForegroundColor Yellow
$frontendOk = Test-Service -Name "Frontend Next.js" -Url "http://localhost:3000"

if (-not $frontendOk) {
    Write-Host "  Tentative de demarrage du frontend..." -ForegroundColor Yellow
    Set-Location $FRONTEND_DIR

    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FRONTEND_DIR'; npm run dev"

    Write-Host "  Frontend demarre dans une nouvelle fenetre." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
}

# 4. Afficher le statut Git
Write-Host "`n[4/5] Statut Git..." -ForegroundColor Yellow
Set-Location $PROJECT_ROOT
$branch = git branch --show-current
$status = git status --short

Write-Host "  Branche: $branch" -ForegroundColor Cyan
if ($status) {
    Write-Host "  Fichiers modifies:" -ForegroundColor Yellow
    $status | ForEach-Object { Write-Host "    $_" }
}
else {
    Write-Host "  Aucune modification en attente." -ForegroundColor Green
}

# 5. Afficher les prochaines taches
Write-Host "`n[5/5] Prochaines taches..." -ForegroundColor Yellow
$featuresPath = Join-Path $PSScriptRoot "features.json"

if (Test-Path $featuresPath) {
    $features = Get-Content $featuresPath -Raw | ConvertFrom-Json

    Write-Host "  Phase actuelle: $($features.phases[0].name)" -ForegroundColor Cyan

    $pendingTasks = @()
    foreach ($phase in $features.phases) {
        foreach ($feature in $phase.features) {
            if ($feature.status -eq "pending") {
                $pendingTasks += $feature
                if ($pendingTasks.Count -ge 3) { break }
            }
        }
        if ($pendingTasks.Count -ge 3) { break }
    }

    Write-Host "`n  Prochaines taches a faire:" -ForegroundColor Yellow
    foreach ($task in $pendingTasks) {
        $blocking = if ($task.blocking) { "[BLOCKING]" } else { "" }
        Write-Host "    - [$($task.id)] $($task.title) $blocking" -ForegroundColor White
    }
}
else {
    Write-Host "  [WARN] features.json non trouve" -ForegroundColor Yellow
}

# Resume
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Initialisation terminee!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URLs utiles:" -ForegroundColor Yellow
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:   http://localhost:5000" -ForegroundColor White
Write-Host "  API Docs:  http://localhost:5000/api/docs" -ForegroundColor White
Write-Host ""
Write-Host "Fichiers de suivi:" -ForegroundColor Yellow
Write-Host "  .claude/claude-progress.md  - Log de progression" -ForegroundColor White
Write-Host "  .claude/features.json       - Liste des taches" -ForegroundColor White
Write-Host "  .claude/AUDIT_REPORT.md     - Rapport d'audit" -ForegroundColor White
Write-Host ""

Set-Location $PROJECT_ROOT
