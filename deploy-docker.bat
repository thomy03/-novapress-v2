@echo off
chcp 65001 >nul
title NovaPress AI v2 - Docker Deployment

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║         NovaPress AI v2 - Docker Deployment               ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Vérifier que Docker est en cours d'exécution
echo [1/5] Checking Docker...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo Docker is running.

:: Vérifier le fichier .env
echo.
echo [2/5] Checking .env file...
if not exist ".env.prod" (
    echo Creating .env.prod from template...
    copy .env.prod.example .env.prod >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Could not create .env.prod. Please create it manually.
    ) else (
        echo Created .env.prod - Please edit with your API keys before deploying.
        notepad .env.prod
        pause
    )
)

:: Arrêter les containers existants
echo.
echo [3/5] Stopping existing containers...
docker-compose -f docker-compose.prod.yml down 2>nul

:: Construire les images
echo.
echo [4/5] Building Docker images (this may take several minutes)...
docker-compose -f docker-compose.prod.yml build --no-cache

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed. Check the logs above.
    pause
    exit /b 1
)

:: Démarrer les services
echo.
echo [5/5] Starting services...
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to start services.
    pause
    exit /b 1
)

:: Attendre que les services démarrent
echo.
echo Waiting for services to start...
timeout /t 30 /nobreak >nul

:: Afficher le status
echo.
echo ════════════════════════════════════════════════════════════════
echo  Deployment complete!
echo.
docker-compose -f docker-compose.prod.yml ps
echo.
echo  Frontend: http://localhost:3000
echo  Backend:  http://localhost:5000
echo  API Docs: http://localhost:5000/api/docs
echo.
echo  To view logs: docker-compose -f docker-compose.prod.yml logs -f
echo  To stop:      docker-compose -f docker-compose.prod.yml down
echo ════════════════════════════════════════════════════════════════
echo.

:: Ouvrir le navigateur
start http://localhost:3000

pause
