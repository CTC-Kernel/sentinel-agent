# Script de diagnostic et correction CPU pour Sentinel Agent
# Analyse pourquoi le CPU reste à 0% et applique les corrections nécessaires

Write-Host "=== DIAGNOSTIC CPU SENTINEL AGENT ===" -ForegroundColor Cyan

# 1. Vérifier l'état actuel du service
Write-Host "`n1. État du service Sentinel :" -ForegroundColor Yellow
try {
    $service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "   Service: $($service.Name) - $($service.Status)" -ForegroundColor Green
        Write-Host "   DisplayName: $($service.DisplayName)" -ForegroundColor Gray
    } else {
        Write-Host "   Service non trouvé" -ForegroundColor Red
    }
} catch {
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Vérifier les processus sentinel
Write-Host "`n2. Processus Sentinel actifs :" -ForegroundColor Yellow
$processes = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue
if ($processes) {
    foreach ($proc in $processes) {
        Write-Host "   PID: $($proc.Id) - CPU: $($proc.CPU)% - Mémoire: $([math]::Round($proc.WorkingSet64/1MB,1))MB" -ForegroundColor Green
    }
} else {
    Write-Host "   Aucun processus sentinel-agent trouvé" -ForegroundColor Red
}

# 3. Analyser les logs récents pour les métriques
Write-Host "`n3. Analyse des métriques récentes :" -ForegroundColor Yellow
$logPaths = @(
    "C:\ProgramData\Sentinel\logs\agent.log",
    "C:\ProgramData\Sentinel\agent.log",
    "C:\temp\sentinel-agent.log"
)

$foundLogs = $false
foreach ($logPath in $logPaths) {
    if (Test-Path $logPath) {
        Write-Host "   Lecture du log: $logPath" -ForegroundColor Gray
        $recentLogs = Get-Content $logPath -Tail 20 -ErrorAction SilentlyContinue
        $cpuMetrics = $recentLogs | Where-Object { $_ -match "CPU=" }
        
        if ($cpuMetrics) {
            $foundLogs = $true
            Write-Host "   Métriques CPU récentes :" -ForegroundColor White
            foreach ($metric in $cpuMetrics) {
                if ($metric -match "CPU=(\d+\.?\d*)") {
                    $cpuValue = $matches[1]
                    $color = if ($cpuValue -eq "0.0") { "Red" } else { "Green" }
                    Write-Host "     $metric" -ForegroundColor $color
                }
            }
        }
        break
    }
}

if (-not $foundLogs) {
    Write-Host "   Aucun log de métriques trouvé" -ForegroundColor Red
}

# 4. Diagnostic du problème CPU
Write-Host "`n4. Diagnostic du problème CPU :" -ForegroundColor Yellow
Write-Host "   Problème identifié: get_cpu_usage() Windows utilise System::new_all()" -ForegroundColor Red
Write-Host "   à chaque appel, ce qui empêche le calcul delta temporel." -ForegroundColor Red
Write-Host "   Solution: Utiliser un singleton sysinfo avec delta temporel." -ForegroundColor Green

# 5. Solution alternative immédiate
Write-Host "`n5. Solution alternative :" -ForegroundColor Yellow
Write-Host "   Comme la recompilation échoue (OpenSSL), voici une solution temporaire :" -ForegroundColor Cyan

# Créer un script de monitoring CPU externe
$monitorScript = @"
# Monitor CPU externe pour Sentinel Agent
# Ce script fournit des métriques CPU correctes pendant que l'agent est patché

while ($true) {
    # Obtenir l'utilisation CPU réelle du processus sentinel-agent
    $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($process) {
        # Utiliser Performance Counter pour une mesure plus précise
        $cpuCounter = New-Object System.Diagnostics.PerformanceCounter("Process", "% Processor Time", $process.ProcessName)
        $cpuValue = [math]::Round($cpuCounter.NextValue(), 1)
        
        # Simuler le format de log de l'agent
        $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
        $memoryMB = [math]::Round($process.WorkingSet64/1MB,1)
        Write-Host "$timestamp INFO resources Resource Usage: CPU=$cpuValue%, RAM=$memoryMB MB, DiskIO=0, NetIO=0"
        
        # Écrire dans un fichier de log alternatif
        $logEntry = "$timestamp INFO resources Resource Usage: CPU=$cpuValue%, RAM=$memoryMB MB, DiskIO=0, NetIO=0"
        Add-Content -Path "C:\temp\sentinel-cpu-fixed.log" -Value $logEntry -ErrorAction SilentlyContinue
    }
    
    Start-Sleep -Seconds 5
}
"@

$monitorPath = "C:\temp\sentinel-cpu-monitor.ps1"
$monitorScript | Out-File -FilePath $monitorPath -Encoding UTF8

Write-Host "   Script de monitoring créé: $monitorPath" -ForegroundColor Green
Write-Host "   Pour lancer le monitoring: powershell -File `"$monitorPath`"" -ForegroundColor Cyan

# 6. Instructions finales
Write-Host "`n6. Instructions pour corriger définitivement :" -ForegroundColor Yellow
Write-Host "   1. Résoudre le problème OpenSSL (installer v3.x complet)" -ForegroundColor White
Write-Host "   2. Recompiler l'agent avec: cargo build --release" -ForegroundColor White
Write-Host "   3. Redémarrer le service pour appliquer les corrections" -ForegroundColor White

Write-Host "`n=== DIAGNOSTIC TERMINÉ ===" -ForegroundColor Cyan
