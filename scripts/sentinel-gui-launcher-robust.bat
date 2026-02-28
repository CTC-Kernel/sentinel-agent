@echo off
REM Sentinel Agent GUI Launcher - Version Robuste
REM Résout le problème de double-clic qui ferme la fenêtre

cd /d "%~dp0"

REM Afficher le répertoire courant pour debug
echo Current directory: %CD%
echo.

REM Vérifier si l'exécutable existe
if not exist "sentinel-agent.exe" (
    echo ERROR: sentinel-agent.exe not found in %CD%
    echo.
    pause
    exit /b 1
)

REM Vérifier la configuration
if not exist "C:\ProgramData\Sentinel\agent.json" (
    echo WARNING: Configuration file not found
    echo Creating default configuration...
    
    REM Créer le répertoire si nécessaire
    if not exist "C:\ProgramData\Sentinel" mkdir "C:\ProgramData\Sentinel"
    if not exist "C:\ProgramData\Sentinel\logs" mkdir "C:\ProgramData\Sentinel\logs"
    
    REM Copier la configuration par défaut
    if exist "..\config\agent.json" (
        copy "..\config\agent.json" "C:\ProgramData\Sentinel\agent.json" >nul 2>&1
        echo Configuration copied from installer
    ) else (
        echo ERROR: Default configuration not found
    )
    echo.
)

REM Vérifier si l'agent tourne déjà
tasklist /fi "imagename eq sentinel-agent.exe" | find "sentinel-agent.exe" >nul
if %errorlevel% == 0 (
    echo Sentinel Agent is already running
    echo.
    choice /M "Do you want to stop the running instance"
    if %errorlevel% == 1 (
        echo Stopping Sentinel Agent...
        taskkill /f /im sentinel-agent.exe >nul 2>&1
        timeout /t 2 /nobreak >nul
    ) else (
        exit /b 0
    )
)

REM Arrêter le service s'il tourne
sc query SentinelGRCAgent | find "RUNNING" >nul
if %errorlevel% == 0 (
    echo Stopping Sentinel service...
    net stop SentinelGRCAgent
    timeout /t 2 /nobreak >nul
)

REM Lancer l'agent avec tous les logs pour debug
echo Starting Sentinel Agent in GUI mode...
echo.
echo Command: sentinel-agent.exe --log-level info run
echo.

REM Lancer dans une nouvelle fenêtre pour garder la console visible
start "Sentinel Agent" cmd /k "sentinel-agent.exe --log-level info run"

echo Sentinel Agent GUI launched in separate window
echo.
echo You can close this window now.
pause
