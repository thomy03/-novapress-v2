@echo off
chcp 65001 >nul
title NovaPress AI v2 - DEV Mode

echo.
echo  NovaPress AI v2 - DEVELOPMENT Mode
echo  ===================================
echo  (Hot reload enabled - changes apply instantly)
echo.

cd /d "%~dp0"

echo [1/4] Cleaning caches...
echo    - Clearing Next.js cache (.next)...
if exist ".next" rmdir /s /q ".next" 2>nul
echo    - Clearing Python cache (__pycache__)...
for /d /r "backend" %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d" 2>nul
echo    - Cache cleared!
echo.

echo [2/4] Starting Docker services (DB only)...
cd backend
docker-compose -f docker-compose.services.yml up -d
cd ..

echo Waiting for services...
timeout /t 5 /nobreak >nul

echo [3/4] Starting Backend (FastAPI DEV on port 5000)...
start "NovaPress-Backend-DEV" cmd /c "cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload"

timeout /t 3 /nobreak >nul

echo [4/4] Starting Frontend (Next.js DEV on port 3000)...
start "NovaPress-Frontend-DEV" cmd /c "cd /d %~dp0 && npm run dev"

timeout /t 5 /nobreak >nul

start "" http://localhost:3000

echo.
echo =============================================
echo  NovaPress AI v2 DEV MODE is running!
echo.
echo  Frontend: http://localhost:3000 (hot reload)
echo  Backend:  http://localhost:5000 (hot reload)
echo  API Docs: http://localhost:5000/api/docs
echo.
echo  Changes auto-refresh in browser!
echo  Use stop-novapress.bat to stop all services.
echo =============================================
echo.
pause
