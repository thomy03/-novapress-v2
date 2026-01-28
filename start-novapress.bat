@echo off
chcp 65001 >nul
title NovaPress AI v2 - Launcher

echo.
echo  NovaPress AI v2 - Launcher
echo  ===========================
echo.

cd /d "%~dp0"

echo [1/6] Cleaning caches...
echo    - Clearing Next.js cache (.next)...
if exist ".next" rmdir /s /q ".next" 2>nul
echo    - Clearing Python cache (__pycache__)...
for /d /r "backend" %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d" 2>nul
echo    - Cache cleared!
echo.

echo [2/6] Starting Docker services (DB only)...
cd backend
docker-compose -f docker-compose.services.yml up -d
cd ..

echo Waiting for services...
timeout /t 5 /nobreak >nul

echo [3/6] Starting Backend (FastAPI on port 5000)...
start "NovaPress-Backend" cmd /c "cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 5000"

timeout /t 5 /nobreak >nul

echo [4/6] Building Frontend (Next.js)...
call npm run build

echo [5/6] Starting Frontend (Next.js PRODUCTION on port 3005)...
start "NovaPress-Frontend" cmd /c "cd /d %~dp0 && npx next start -p 3005"

timeout /t 8 /nobreak >nul

echo [6/6] Opening Status Dashboard...
start "" http://localhost:3005/dev/status

echo.
echo =============================================
echo  NovaPress AI v2 is running!
echo.
echo  Status:   http://localhost:3005/dev/status
echo  Home:     http://localhost:3005
echo  Backend:  http://localhost:5000/api/docs
echo.
echo  Use stop-novapress.bat to stop all services.
echo =============================================
echo.
pause
