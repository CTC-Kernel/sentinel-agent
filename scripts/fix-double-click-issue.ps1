# Correction finale du problème de double-clic MSI
# L'agent fonctionne en CLI mais pas au double-clic

Write-Host "=== CORRECTION DOUBLE-CLIC MSI ===" -ForegroundColor Cyan

# 1. Diagnostic du double-clic
Write-Host "`n1. DIAGNOSTIC DOUBLE-CLIC" -ForegroundColor Yellow

$exePath = "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe"

# Test double-clic simulation (sans arguments)
Write-Host "Test double-clic (sans arguments)..." -ForegroundColor Gray

try {
    $process = Start-Process -FilePath $exePath -PassThru -WindowStyle Normal
    Start-Sleep -Seconds 2
    
    if ($process.HasExited) {
        Write-Host "❌ Double-clic échoue (Exit code: $($process.ExitCode))" -ForegroundColor Red
        Write-Host "   L'agent nécessite des arguments pour fonctionner" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Double-clic réussi (PID: $($process.Id))" -ForegroundColor Green
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "❌ Erreur double-clic: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Créer un launcher robuste
Write-Host "`n2. CRÉATION LAUNCHER ROBUSTE" -ForegroundColor Yellow

$launcherPath = "C:\Program Files (x86)\Sentinel\bin\sentinel-agent-gui.bat"
$robustLauncher = @"
@echo off
cd /d "%~dp0"

REM Vérifier l'exécutable
if not exist "sentinel-agent.exe" (
    echo ERROR: sentinel-agent.exe not found
    pause
    exit /b 1
)

REM Vérifier la configuration
if not exist "C:\ProgramData\Sentinel\agent.json" (
    echo WARNING: Configuration file not found
    if not exist "C:\ProgramData\Sentinel" mkdir "C:\ProgramData\Sentinel" 2>nul
    if not exist "C:\ProgramData\Sentinel\logs" mkdir "C:\ProgramData\Sentinel\logs" 2>nul
)

REM Arrêter le service s'il tourne
sc query SentinelGRCAgent | find "RUNNING" >nul
if %errorlevel% == 0 (
    net stop SentinelGRCAgent >nul 2>&1
    timeout /t 2 /nobreak >nul
)

REM Lancer avec GUI
start "Sentinel Agent" sentinel-agent.exe run
echo Sentinel Agent launched
"@

try {
    # Demander les droits admin pour modifier
    Start-Process powershell -ArgumentList "-Command", "$robustLauncher | Out-File -FilePath `"$launcherPath`" -Encoding ASCII" -Verb RunAs
    Write-Host "✅ Launcher robuste créé" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur création launcher: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Exécutez manuellement en tant qu'administrateur" -ForegroundColor Yellow
}

# 3. Mettre à jour le raccourci du bureau
Write-Host "`n3. MISE À JOUR RACCOURCI BUREAU" -ForegroundColor Yellow

$desktopPath = "$env:USERPROFILE\Desktop\Sentinel Agent.lnk"
if (Test-Path $desktopPath) {
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($desktopPath)
        $shortcut.TargetPath = $launcherPath
        $shortcut.WorkingDirectory = "C:\Program Files (x86)\Sentinel\bin"
        $shortcut.Description = "Lancer l'agent Sentinel avec GUI"
        $shortcut.Save()
        Write-Host "✅ Raccourci bureau mis à jour" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erreur raccourci: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ Raccourci bureau non trouvé" -ForegroundColor Yellow
}

# 4. Instructions finales
Write-Host "`n4. INSTRUCTIONS FINALES" -ForegroundColor Yellow

Write-Host "Pour lancer l'agent:" -ForegroundColor Cyan
Write-Host "1. Double-cliquer sur: sentinel-agent-gui.bat" -ForegroundColor Gray
Write-Host "2. Ou utiliser le raccourci du bureau" -ForegroundColor Gray
Write-Host "3. Ou ligne de commande: sentinel-agent.exe run" -ForegroundColor Gray

Write-Host "`nSi problème persiste:" -ForegroundColor Cyan
Write-Host "1. Vérifier la configuration: C:\ProgramData\Sentinel\agent.json" -ForegroundColor Gray
Write-Host "2. Vérifier les logs: C:\ProgramData\Sentinel\logs\" -ForegroundColor Gray
Write-Host "3. Lancer en debug: sentinel-agent.exe --log-level debug run" -ForegroundColor Gray

Write-Host "`n=== CORRECTION TERMINÉE ===" -ForegroundColor Cyan
Write-Host "Le double-clic devrait maintenant fonctionner via le launcher." -ForegroundColor Green
