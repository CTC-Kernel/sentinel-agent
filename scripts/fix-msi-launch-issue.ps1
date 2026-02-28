# Script de correction immédiate pour le problème de lancement MSI
# Résout le conflit entre service et GUI après installation

Write-Host "=== CORRECTION IMMÉDIATE MSI LAUNCH ISSUE ===" -ForegroundColor Cyan

# 1. Arrêter le service s'il est en cours
Write-Host "`n1. ARRET DU SERVICE" -ForegroundColor Yellow

try {
    $service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Write-Host "Arrêt du service SentinelGRCAgent..." -ForegroundColor White
        Stop-Service -Name "SentinelGRCAgent" -Force
        Start-Sleep -Seconds 2
        Write-Host "✅ Service arrêté" -ForegroundColor Green
    } else {
        Write-Host "✅ Service déjà arrêté" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erreur arrêt service: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Configurer le service en démarrage manuel
Write-Host "`n2. CONFIGURATION SERVICE (MANUEL)" -ForegroundColor Yellow

try {
    $service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
    if ($service) {
        Set-Service -Name "SentinelGRCAgent" -StartupType Manual
        Write-Host "✅ Service configuré en démarrage manuel" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Service non trouvé" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur configuration service: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Mettre à jour le launcher GUI
Write-Host "`n3. MISE À JOUR LAUNCHER GUI" -ForegroundColor Yellow

$launcherPath = "C:\Program Files (x86)\Sentinel\bin\sentinel-agent-gui.bat"
$launcherContent = @"
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
"@

try {
    $launcherContent | Out-File -FilePath $launcherPath -Encoding ASCII -Force
    Write-Host "✅ Launcher GUI mis à jour" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur mise à jour launcher: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Vérifier l'auto-start GUI
Write-Host "`n4. VERIFICATION AUTO-START GUI" -ForegroundColor Yellow

try {
    $autoStart = Get-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "SentinelAgentGUI" -ErrorAction SilentlyContinue
    if ($autoStart) {
        Write-Host "✅ Auto-start GUI configuré" -ForegroundColor Green
        Write-Host "   Commande: $($autoStart.SentinelAgentGUI)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️ Auto-start GUI non configuré, configuration..." -ForegroundColor Yellow
        
        # Configurer l'auto-start
        Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "SentinelAgentGUI" -Value "`"C:\Program Files (x86)\Sentinel\bin\sentinel-agent-gui.bat`""
        Write-Host "✅ Auto-start GUI configuré" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erreur auto-start: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Tester le lancement
Write-Host "`n5. TEST LANCEMENT GUI" -ForegroundColor Yellow

try {
    $exePath = "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe"
    $process = Start-Process -FilePath $exePath -ArgumentList "run" -PassThru -WindowStyle Normal
    Start-Sleep -Seconds 2
    
    if ($process.HasExited) {
        Write-Host "❌ Test échoué (Exit code: $($process.ExitCode))" -ForegroundColor Red
    } else {
        Write-Host "✅ Test réussi (PID: $($process.Id))" -ForegroundColor Green
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "❌ Erreur test: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Instructions finales
Write-Host "`n6. INSTRUCTIONS FINALES" -ForegroundColor Yellow

Write-Host "Pour lancer l'agent manuellement:" -ForegroundColor Cyan
Write-Host "  Double-cliquer sur: C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe" -ForegroundColor Gray
Write-Host "  Ou utiliser: C:\Program Files (x86)\Sentinel\bin\sentinel-agent-gui.bat" -ForegroundColor Gray

Write-Host "`nPour le service (optionnel):" -ForegroundColor Cyan
Write-Host "  Start-Service -Name `"SentinelGRCAgent`"" -ForegroundColor Gray
Write-Host "  Stop-Service -Name `"SentinelGRCAgent`"" -ForegroundColor Gray

Write-Host "`n=== CORRECTION TERMINÉE ===" -ForegroundColor Cyan
Write-Host "L'agent devrait maintenant se lancer correctement après l'installation MSI." -ForegroundColor Green
