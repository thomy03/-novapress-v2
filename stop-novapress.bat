@echo off
chcp 65001 >nul
title NovaPress AI v2 - Stop

echo.
echo  Stopping NovaPress AI v2...
echo  ===========================
echo.

cd /d "%~dp0"

echo [1/4] Stopping Frontend (port 3005)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3005 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)

echo [2/4] Stopping Backend (port 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)

echo [3/4] Stopping Docker services...
cd backend
docker-compose -f docker-compose.services.yml down 2>nul
docker-compose down 2>nul
cd ..

echo [4/4] Cleaning caches for next restart...
echo    - Clearing Next.js cache (.next)...
if exist ".next" rmdir /s /q ".next" 2>nul
echo    - Clearing Python cache (__pycache__)...
for /d /r "backend" %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d" 2>nul
echo    - Cache cleared!

echo.
echo =============================================
echo  All services stopped.
echo  Caches cleared for clean restart.
echo =============================================
echo.
pause
