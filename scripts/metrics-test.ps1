# Analyse complète et validation des métriques Sentinel Agent
# Script de test pour comparer toutes les métriques avec des outils système externes

Write-Host "=== ANALYSE COMPLETE DES METRIQUES SENTINEL ===" -ForegroundColor Cyan

# Fonction pour obtenir les métriques système via PowerShell natif
function Get-SystemMetrics {
    $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if (-not $process) {
        Write-Host "Processus sentinel-agent non trouve" -ForegroundColor Red
        return $null
    }
    
    # CPU via Performance Counters
    $cpuUsage = 0.0
    try {
        $cpuCounter = New-Object System.Diagnostics.PerformanceCounter("Process", "% Processor Time", $process.ProcessName)
        $cpuCounter.NextValue() | Out-Null
        Start-Sleep -Milliseconds 200
        $cpuUsage = [math]::Round($cpuCounter.NextValue(), 2)
    } catch {
        $cpuUsage = 0.0
    }
    
    # Mémoire
    $memoryMB = [math]::Round($process.WorkingSet64 / 1MB, 2)
    
    return @{
        ProcessId = $process.Id
        CPU = $cpuUsage
        MemoryMB = $memoryMB
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    }
}

# Fonction pour analyser les logs Sentinel
function Get-SentinelMetrics {
    $logPaths = @(
        "C:\ProgramData\Sentinel\logs\agent.log",
        "C:\ProgramData\Sentinel\agent.log"
    )
    
    foreach ($logPath in $logPaths) {
        if (Test-Path $logPath) {
            $recentLogs = Get-Content $logPath -Tail 10 -ErrorAction SilentlyContinue
            $resourceLog = $recentLogs | Where-Object { $_ -match "Resource Usage:" } | Select-Object -Last 1
            
            if ($resourceLog -match "CPU=([\d\.]+)%.*RAM=(\d+)MB.*DiskIO=(\d+).*NetIO=(\d+)") {
                return @{
                    CPU = [double]$matches[1]
                    MemoryMB = [int]$matches[2]
                    DiskIO = [int]$matches[3]
                    NetIO = [int]$matches[4]
                    Source = "Sentinel"
                }
            }
        }
    }
    
    return $null
}

# Test de fiabilité
function Test-MetricsReliability {
    Write-Host "`nTEST DE FIABILITE DES METRIQUES" -ForegroundColor Yellow
    
    $systemMetrics = Get-SystemMetrics
    if (-not $systemMetrics) {
        Write-Host "Impossible d'obtenir les metriques systeme" -ForegroundColor Red
        return
    }
    
    $sentinelMetrics = Get-SentinelMetrics
    
    Write-Host "`nMETRIQUES SYSTEME:" -ForegroundColor Green
    Write-Host "   PID: $($systemMetrics.ProcessId)" -ForegroundColor Gray
    Write-Host "   CPU: $($systemMetrics.CPU)%" -ForegroundColor White
    Write-Host "   Memoire: $($systemMetrics.MemoryMB) MB" -ForegroundColor White
    
    if ($sentinelMetrics) {
        Write-Host "`nMETRIQUES SENTINEL:" -ForegroundColor Green
        Write-Host "   CPU: $($sentinelMetrics.CPU)%" -ForegroundColor White
        Write-Host "   Memoire: $($sentinelMetrics.MemoryMB) MB" -ForegroundColor White
        Write-Host "   Disk I/O: $($sentinelMetrics.DiskIO)" -ForegroundColor White
        Write-Host "   Network I/O: $($sentinelMetrics.NetIO)" -ForegroundColor White
        
        Write-Host "`nCOMPARAISON:" -ForegroundColor Yellow
        
        # CPU
        $cpuDiff = [math]::Abs($systemMetrics.CPU - $sentinelMetrics.CPU)
        $cpuStatus = if ($cpuDiff -lt 1.0) { "OK" } elseif ($cpuDiff -lt 3.0) { "WARN" } else { "FAIL" }
        Write-Host "   CPU: $cpuStatus - System=$($systemMetrics.CPU)% vs Sentinel=$($sentinelMetrics.CPU)% (diff: $cpuDiff%)" -ForegroundColor White
        
        # Mémoire
        $memDiff = [math]::Abs($systemMetrics.MemoryMB - $sentinelMetrics.MemoryMB)
        $memStatus = if ($memDiff -lt 5) { "OK" } elseif ($memDiff -lt 20) { "WARN" } else { "FAIL" }
        Write-Host "   Memoire: $memStatus - System=$($systemMetrics.MemoryMB)MB vs Sentinel=$($sentinelMetrics.MemoryMB)MB (diff: $memDiff MB)" -ForegroundColor White
        
    } else {
        Write-Host "`nAucune metrique Sentinel trouvee" -ForegroundColor Red
    }
}

# Exécuter les tests
Test-MetricsReliability

Write-Host "`n=== ANALYSE TERMINEE ===" -ForegroundColor Cyan
