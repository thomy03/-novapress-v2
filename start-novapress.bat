@echo off
chcp 65001 >nul
title NovaPress AI v2 - Launcher

echo.
echo  NovaPress AI v2 - Launcher
echo  ===========================
echo.
echo  Frontend: http://localhost:3005
echo  Backend:  http://localhost:5000
echo.

cd /d "%~dp0"

echo [1/3] Starting Docker services...
cd backend
docker-compose up -d 2>nul
cd ..

echo [2/3] Starting Backend...
start "NovaPress-Backend" cmd /c "cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 5000"

timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend on port 3005...
start "NovaPress-Frontend" cmd /c "cd /d %~dp0 && npm run dev -- -p 3005"

timeout /t 5 /nobreak >nul

echo.
echo Opening Status Dashboard...
start "" http://localhost:3005/dev/status

echo.
echo =============================================
echo  NovaPress AI v2 is running!
echo.
echo  Status:   http://localhost:3005/dev/status
echo  Home:     http://localhost:3005
echo  Backend:  http://localhost:5000/api/docs
echo  Kanban:   http://localhost:3005/dev/kanban
echo.
echo  Use stop-novapress.bat to stop all services.
echo =============================================
echo.
pause
