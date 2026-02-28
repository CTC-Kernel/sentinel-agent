# Validation des corrections metriques Sentinel

Write-Host "=== VALIDATION METRIQUES SENTINEL ===" -ForegroundColor Cyan

# Test de l'etat du service
function Test-Service {
    Write-Host "`nTEST SERVICE:" -ForegroundColor Yellow
    
    try {
        $service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "Service: $($service.Status)" -ForegroundColor $(if($service.Status -eq "Running") {"Green"} else {"Red"})
            
            $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "Processus: PID $($process.Id)" -ForegroundColor Green
                Write-Host "Memoire: $([math]::Round($process.WorkingSet64/1MB,1)) MB" -ForegroundColor White
            }
        }
    } catch {
        Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test des logs
function Test-Logs {
    Write-Host "`nTEST LOGS:" -ForegroundColor Yellow
    
    $logPath = "C:\ProgramData\Sentinel\logs\agent.log"
    if (Test-Path $logPath) {
        Write-Host "Log trouve: $logPath" -ForegroundColor Gray
        
        # Surveiller les nouveaux logs
        $initialCount = (Get-Content $logPath -ErrorAction SilentlyContinue | Measure-Object).Count
        Start-Sleep -Seconds 5
        $finalCount = (Get-Content $logPath -ErrorAction SilentlyContinue | Measure-Object).Count
        
        if ($finalCount -gt $initialCount) {
            $newLogs = Get-Content $logPath -Tail ($finalCount - $initialCount) -ErrorAction SilentlyContinue
            $resourceLogs = $newLogs | Where-Object { $_ -match "Resource Usage:" }
            
            if ($resourceLogs) {
                Write-Host "Nouvelles metriques trouvees:" -ForegroundColor Green
                foreach ($log in $resourceLogs) {
                    Write-Host "  $log" -ForegroundColor Cyan
                }
            } else {
                Write-Host "Logs nouveaux mais pas de metriques" -ForegroundColor Yellow
            }
        } else {
            Write-Host "Aucun nouveau log" -ForegroundColor Red
        }
    } else {
        Write-Host "Log non trouve" -ForegroundColor Red
    }
}

# Test metriques systeme
function Test-SystemMetrics {
    Write-Host "`nTEST METRIQUES SYSTEME:" -ForegroundColor Yellow
    
    $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $process) {
        Write-Host "Processus non trouve" -ForegroundColor Red
        return
    }
    
    $memoryMB = [math]::Round($process.WorkingSet64 / 1MB, 2)
    Write-Host "Memoire systeme: $memoryMB MB" -ForegroundColor White
    
    # CPU avec Performance Counter
    try {
        $cpuCounter = New-Object System.Diagnostics.PerformanceCounter("Process", "% Processor Time", $process.ProcessName)
        $cpuCounter.NextValue() | Out-Null
        Start-Sleep -Milliseconds 300
        $cpuUsage = [math]::Round($cpuCounter.NextValue(), 2)
        Write-Host "CPU systeme: $cpuUsage%" -ForegroundColor White
    } catch {
        Write-Host "CPU: Erreur mesure" -ForegroundColor Red
    }
}

# Executer les tests
Test-Service
Test-Logs
Test-SystemMetrics

Write-Host "`nCorrections appliquees:" -ForegroundColor Cyan
Write-Host "- CPU: Singleton sysinfo avec delta temporel" -ForegroundColor Green
Write-Host "- Memoire: API Windows native" -ForegroundColor Green
Write-Host "- Disk I/O: Calcul delta bytes/secondes" -ForegroundColor Green
Write-Host "- Network I/O: Cache avec delta temporel" -ForegroundColor Green
Write-Host "- Logging: Chaque echantillon" -ForegroundColor Green

Write-Host "`n=== VALIDATION TERMINEE ===" -ForegroundColor Cyan
