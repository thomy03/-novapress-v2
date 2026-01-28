@echo off
echo ========================================
echo   DEBUG - NovaPress Kanban
echo ========================================
echo.

echo Repertoire actuel:
cd
echo.

echo Changement vers le repertoire du script...
cd /d "%~dp0"
echo Nouveau repertoire:
cd
echo.

echo Verification npm...
where npm
echo.

echo Verification node...
where node
echo.

echo Verification docker...
where docker
echo.

echo Contenu du dossier:
dir /b
echo.

echo Test: existe backend\venv ?
if exist "backend\venv" (
    echo OUI - venv existe
) else (
    echo NON - venv n'existe pas
)
echo.

echo ========================================
echo   Appuyez sur une touche pour fermer
echo ========================================
pause
