@echo off
chcp 65001 >nul
title NovaPress AI v2 - Launcher

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║             NovaPress AI v2 - Launcher                     ║
echo  ║                                                            ║
echo  ║  Frontend: http://localhost:3005                           ║
echo  ║  Backend:  http://localhost:5000                           ║
echo  ║  API Docs: http://localhost:5000/api/docs                  ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Démarrer les services Docker (PostgreSQL, Redis, Qdrant)
echo [1/4] Starting Docker services...
cd backend
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo Warning: Docker services may not have started correctly.
    echo Make sure Docker Desktop is running.
)
cd ..

:: Attendre que les services soient prêts
echo [2/4] Waiting for services to be ready...
timeout /t 5 /nobreak >nul

:: Démarrer le backend FastAPI dans une nouvelle fenêtre
echo [3/4] Starting Backend (FastAPI)...
start "NovaPress Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 5000"

:: Attendre que le backend démarre
timeout /t 3 /nobreak >nul

:: Démarrer le frontend Next.js sur le port 3005 (unique)
echo [4/4] Starting Frontend (Next.js on port 3005)...
start "NovaPress Frontend" cmd /k "cd /d "%~dp0" && npm run dev -- -p 3005"

:: Attendre que le frontend démarre
timeout /t 5 /nobreak >nul

:: Ouvrir le navigateur
echo.
echo Opening browser...
start http://localhost:3005

echo.
echo ════════════════════════════════════════════════════════════════
echo  NovaPress AI v2 is starting!
echo.
echo  Frontend: http://localhost:3005
echo  Backend:  http://localhost:5000
echo  API Docs: http://localhost:5000/api/docs
echo  Kanban:   http://localhost:3005/dev/kanban
echo.
echo  Press any key to exit this launcher (services will keep running)
echo ════════════════════════════════════════════════════════════════
pause >nul
