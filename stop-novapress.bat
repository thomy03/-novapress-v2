@echo off
chcp 65001 >nul
title NovaPress AI v2 - Stop

echo.
echo  NovaPress AI v2 - Stopping services...
echo  ======================================
echo.

cd /d "%~dp0"

echo [1/3] Stopping Frontend (Node.js on port 3005)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3005 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)

echo [2/3] Stopping Backend (Python on port 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)

echo [3/3] Stopping Docker services...
cd backend
docker-compose down 2>nul
cd ..

echo.
echo All NovaPress services stopped.
echo.
pause
