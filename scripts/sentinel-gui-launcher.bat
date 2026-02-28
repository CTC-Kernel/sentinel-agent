@echo off
REM Sentinel Agent GUI Launcher
REM Always starts the agent with GUI interface

cd /d "%~dp0"

REM Check if agent is already running in GUI mode
tasklist /fi "imagename eq sentinel-agent.exe" /fi "windowtitle eq Sentinel Agent*" | find "sentinel-agent.exe" >nul
if %errorlevel% == 0 (
    echo Sentinel Agent GUI is already running
    exit /b 0
)

REM Check if service is running and stop it first
sc query SentinelGRCAgent | find "RUNNING" >nul
if %errorlevel% == 0 (
    echo Stopping Sentinel service to start GUI mode...
    net stop SentinelGRCAgent
    timeout /t 2 /nobreak >nul
)

REM Start agent in GUI mode
start "Sentinel Agent" sentinel-agent.exe run

echo Sentinel Agent GUI launched
