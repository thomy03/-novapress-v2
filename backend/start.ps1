# NovaPress AI v2 - Quick Start Script (Windows)
# Starts all necessary services

Write-Host "NovaPress AI v2 - Starting Backend..." -ForegroundColor Green

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker not found. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check Docker Compose
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "Docker Compose not found. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

# Copy .env if necessary
if (-not (Test-Path .env)) {
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "Please edit .env with your configuration!" -ForegroundColor Yellow
}

# Start services
Write-Host "Starting Docker services..." -ForegroundColor Cyan
docker-compose up -d

Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Download Mistral in Ollama
Write-Host "Downloading Mistral LLM (this may take a while)..." -ForegroundColor Cyan
docker exec novapress_ollama ollama pull mistral:7b-instruct

Write-Host ""
Write-Host "NovaPress Backend is running!" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  - Backend API:  http://localhost:5000"
Write-Host "  - API Docs:     http://localhost:5000/api/docs"
Write-Host "  - PostgreSQL:   localhost:5432"
Write-Host "  - Redis:        localhost:6379"
Write-Host "  - Qdrant:       http://localhost:6333"
Write-Host "  - Ollama:       http://localhost:11434"
Write-Host ""
Write-Host "Logs:" -ForegroundColor Yellow
Write-Host "  docker-compose logs -f backend"
Write-Host ""
Write-Host "Stop:" -ForegroundColor Red
Write-Host "  docker-compose down"
Write-Host ""
