@echo off
REM Direct launcher for Sentinel Agent with GUI
REM This file ensures GUI mode is always used when double-clicking

cd /d "%~dp0"

REM Always start in GUI mode
sentinel-agent.exe run
