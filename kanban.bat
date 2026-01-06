@echo off
chcp 65001 >nul 2>&1
title NovaPress Kanban
cd /d "%~dp0"

echo.
echo ========================================
echo   NovaPress AI v2 - Kanban Viewer
echo ========================================
echo.

:: Chercher npm dans les chemins courants
set "NPM_PATH="
if exist "C:\Program Files\nodejs\npm.cmd" set "NPM_PATH=C:\Program Files\nodejs\npm.cmd"
if exist "%APPDATA%\npm\npm.cmd" set "NPM_PATH=%APPDATA%\npm\npm.cmd"
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" set "NPM_PATH=%LOCALAPPDATA%\Programs\nodejs\npm.cmd"
if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_PATH=%ProgramFiles%\nodejs\npm.cmd"

:: Verifier si npm trouve
where npm >nul 2>&1
if %errorlevel% equ 0 set "NPM_PATH=npm"

if "%NPM_PATH%"=="" (
    echo [ERREUR] npm non trouve!
    echo.
    echo Chemins verifies:
    echo   - C:\Program Files\nodejs\npm.cmd
    echo   - %APPDATA%\npm\npm.cmd
    echo   - %LOCALAPPDATA%\Programs\nodejs\npm.cmd
    echo.
    echo Installez Node.js depuis https://nodejs.org
    echo ou ajoutez-le au PATH systeme.
    echo.
    pause
    exit /b 1
)

echo [OK] npm trouve: %NPM_PATH%

:: Verifier si le frontend tourne deja
echo.
echo Verification du frontend...
curl -s -o nul -w "%%{http_code}" http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend deja actif
    goto :open_browser
)

echo [INFO] Frontend pas encore demarre, lancement...

:: Demarrer Docker si disponible
echo.
echo [1/3] Docker...
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Docker actif
    cd /d "%~dp0backend"
    docker-compose up -d >nul 2>&1
    cd /d "%~dp0"
) else (
    echo [SKIP] Docker non disponible
)

:: Demarrer le Backend
echo.
echo [2/3] Backend...
cd /d "%~dp0backend"
if exist "venv\Scripts\activate.bat" (
    start "Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --port 5000"
    echo [OK] Backend demarre
) else (
    echo [SKIP] venv non trouve
)

:: Demarrer le Frontend
echo.
echo [3/3] Frontend...
cd /d "%~dp0"
start "Frontend" cmd /k "cd /d "%~dp0" && "%NPM_PATH%" run dev"
echo [OK] Frontend demarre

:: Attendre le demarrage
echo.
echo Attente du demarrage (25 secondes)...
echo.
for /L %%i in (1,1,25) do (
    <nul set /p "=."
    timeout /t 1 /nobreak >nul
)
echo.

:open_browser
echo.
echo Ouverture du Kanban...
start "" "http://localhost:3000/dev/kanban"

echo.
echo ========================================
echo   PRET !
echo ========================================
echo.
echo   Kanban:   http://localhost:3000/dev/kanban
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:5000
echo.
echo Cette fenetre peut etre fermee.
echo.
pause
