# Diagnostic MSI launch issue - version simplifiee

Write-Host "=== DIAGNOSTIC MSI LAUNCH ISSUE ===" -ForegroundColor Cyan

# Etat actuel
Write-Host "`nETAT ACTUEL:" -ForegroundColor Yellow

$service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Service: $($service.Status)" -ForegroundColor $(if($service.Status -eq "Running") {"Green"} else {"Red"})
} else {
    Write-Host "Service: Non trouve" -ForegroundColor Red
}

$process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "Processus: PID $($process.Id)" -ForegroundColor Green
} else {
    Write-Host "Processus: Non trouve" -ForegroundColor Red
}

try {
    $autoStart = Get-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "SentinelAgentGUI" -ErrorAction SilentlyContinue
    if ($autoStart) {
        Write-Host "Auto-start: Configure" -ForegroundColor Green
    } else {
        Write-Host "Auto-start: Non configure" -ForegroundColor Red
    }
} catch {
    Write-Host "Auto-start: Erreur" -ForegroundColor Red
}

$exePath = "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe"
if (Test-Path $exePath) {
    Write-Host "Executable: Present" -ForegroundColor Green
} else {
    Write-Host "Executable: Non trouve" -ForegroundColor Red
}

# Analyse des causes
Write-Host "`nANALYSE CAUSES:" -ForegroundColor Yellow

if ($service -and $service.Status -eq "Running") {
    Write-Host "- Service actif en mode --service (pas de GUI)" -ForegroundColor Yellow
}

if ($service -and $service.Status -eq "Running") {
    Write-Host "- Auto-start GUI ferme immediatement (service deja running)" -ForegroundColor Red
}

# Test lancement manuel
Write-Host "`nTEST LANCEMENT MANUEL:" -ForegroundColor Yellow

try {
    $process = Start-Process -FilePath $exePath -ArgumentList "run" -PassThru -WindowStyle Normal
    Start-Sleep -Seconds 2
    
    if ($process.HasExited) {
        Write-Host "❌ Processus termine (Exit code: $($process.ExitCode))" -ForegroundColor Red
        $manualWorks = $false
    } else {
        Write-Host "✅ Processus actif (PID: $($process.Id))" -ForegroundColor Green
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        $manualWorks = $true
    }
} catch {
    Write-Host "❌ Erreur lancement: $($_.Exception.Message)" -ForegroundColor Red
    $manualWorks = $false
}

# Solutions
Write-Host "`nSOLUTIONS:" -ForegroundColor Yellow

Write-Host "1. Lancement manuel:" -ForegroundColor Cyan
Write-Host "   Start-Process -FilePath `"$exePath`" -ArgumentList `"run`"" -ForegroundColor Gray

Write-Host "2. Arreter service et lancer GUI:" -ForegroundColor Cyan
Write-Host "   Stop-Service -Name `"SentinelGRCAgent`" -Force" -ForegroundColor Gray
Write-Host "   Start-Process -FilePath `"$exePath`" -ArgumentList `"run`"" -ForegroundColor Gray

Write-Host "3. Corriger MSI:" -ForegroundColor Cyan
Write-Host "   - Ne pas auto-demarrer le service" -ForegroundColor Gray
Write-Host "   - Configurer auto-start GUI uniquement" -ForegroundColor Gray

Write-Host "`n=== DIAGNOSTIC TERMINE ===" -ForegroundColor Cyan

if ($manualWorks) {
    Write-Host "✅ Lancement manuel fonctionne - probleme auto-start" -ForegroundColor Green
} else {
    Write-Host "❌ Lancement manuel echoue - probleme configuration" -ForegroundColor Red
}
