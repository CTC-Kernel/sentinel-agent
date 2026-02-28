# Analyse complète et validation des métriques Sentinel Agent
# Script de test pour comparer toutes les métriques avec des outils système externes

Write-Host "=== ANALYSE COMPLÈTE DES MÉTRIQUES SENTINEL ===" -ForegroundColor Cyan
Write-Host "Validation et comparaison avec outils système externes" -ForegroundColor Gray

# Fonction pour obtenir les métriques système via PowerShell natif
function Get-SystemMetrics {
    $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if (-not $process) {
        Write-Host "❌ Processus sentinel-agent non trouvé" -ForegroundColor Red
        return $null
    }
    
    # CPU via Performance Counters (plus précis)
    $cpuCounter = $null
    try {
        $cpuCounter = New-Object System.Diagnostics.PerformanceCounter("Process", "% Processor Time", $process.ProcessName)
        $cpuCounter.NextValue() | Out-Null  # Premier appel (retourne 0)
        Start-Sleep -Milliseconds 200
        $cpuUsage = [math]::Round($cpuCounter.NextValue(), 2)
    } catch {
        $cpuUsage = 0.0
    }
    
    # Mémoire via Process (WorkingSet)
    $memoryMB = [math]::Round($process.WorkingSet64 / 1MB, 2)
    
    # Disk I/O via Performance Counters
    $diskReadOps = 0
    $diskWriteOps = 0
    try {
        $diskReadCounter = New-Object System.Diagnostics.PerformanceCounter("Process", "IO Read Operations/sec", $process.ProcessName)
        $diskWriteCounter = New-Object System.Diagnostics.PerformanceCounter("Process", "IO Write Operations/sec", $process.ProcessName)
        $diskReadOps = [math]::Round($diskReadCounter.NextValue(), 0)
        $diskWriteOps = [math]::Round($diskWriteCounter.NextValue(), 0)
    } catch {
        # Fallback: utiliser Get-Process I/O
        $diskReadOps = $process.ReadOperationCount
        $diskWriteOps = $process.WriteOperationCount
    }
    
    # Network I/O via Performance Counters
    $netRecvBytes = 0
    $netSentBytes = 0
    try {
        $netRecvCounter = New-Object System.Diagnostics.PerformanceCounter("Process", "IO Read Bytes/sec", $process.ProcessName)
        $netSentCounter = New-Object System.Diagnostics.PerformanceCounter("Process", "IO Write Bytes/sec", $process.ProcessName)
        $netRecvBytes = [math]::Round($netRecvCounter.NextValue(), 0)
        $netSentBytes = [math]::Round($netSentCounter.NextValue(), 0)
    } catch {
        # Fallback: utiliser Get-Process
        $netRecvBytes = 0
        $netSentBytes = 0
    }
    
    return @{
        ProcessId = $process.Id
        CPU = $cpuUsage
        MemoryMB = $memoryMB
        DiskReadOps = $diskReadOps
        DiskWriteOps = $diskWriteOps
        NetRecvBytes = $netRecvBytes
        NetSentBytes = $netSentBytes
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    }
}

# Fonction pour analyser les logs Sentinel
function Get-SentinelMetrics {
    $logPaths = @(
        "C:\ProgramData\Sentinel\logs\agent.log",
        "C:\ProgramData\Sentinel\agent.log",
        "C:\temp\sentinel-agent.log"
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
                    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
                    Source = "Sentinel"
                }
            }
        }
    }
    
    return $null
}

# Fonction de validation et comparaison
function Test-MetricsReliability {
    Write-Host "`n🔍 TEST DE FIABILITÉ DES MÉTRIQUES" -ForegroundColor Yellow
    
    # Obtenir métriques système
    $systemMetrics = Get-SystemMetrics
    if (-not $systemMetrics) {
        Write-Host "❌ Impossible d'obtenir les métriques système" -ForegroundColor Red
        return
    }
    
    # Obtenir métriques Sentinel
    $sentinelMetrics = Get-SentinelMetrics
    
    Write-Host "`n📊 MÉTRIQUES SYSTÈME (PowerShell natif):" -ForegroundColor Green
    Write-Host "   PID: $($systemMetrics.ProcessId)" -ForegroundColor Gray
    Write-Host "   CPU: $($systemMetrics.CPU)%" -ForegroundColor White
    Write-Host "   Mémoire: $($systemMetrics.MemoryMB) MB" -ForegroundColor White
    Write-Host "   Disk Read: $($systemMetrics.DiskReadOps) ops/s" -ForegroundColor White
    Write-Host "   Disk Write: $($systemMetrics.DiskWriteOps) ops/s" -ForegroundColor White
    Write-Host "   Network Receive: $($systemMetrics.NetRecvBytes) bytes/s" -ForegroundColor White
    Write-Host "   Network Send: $($systemMetrics.NetSentBytes) bytes/s" -ForegroundColor White
    
    if ($sentinelMetrics) {
        Write-Host "`n📊 MÉTRIQUES SENTINEL:" -ForegroundColor Green
        Write-Host "   CPU: $($sentinelMetrics.CPU)%" -ForegroundColor White
        Write-Host "   Mémoire: $($sentinelMetrics.MemoryMB) MB" -ForegroundColor White
        Write-Host "   Disk I/O: $($sentinelMetrics.DiskIO)" -ForegroundColor White
        Write-Host "   Network I/O: $($sentinelMetrics.NetIO)" -ForegroundColor White
        
        Write-Host "`n⚖️  COMPARAISON ET VALIDATION:" -ForegroundColor Yellow
        
        # Validation CPU
        $cpuDiff = [math]::Abs($systemMetrics.CPU - $sentinelMetrics.CPU)
        $cpuStatus = if ($cpuDiff -lt 1.0) { "✅" } elseif ($cpuDiff -lt 3.0) { "⚠️" } else { "❌" }
        Write-Host "   CPU: $cpuStatus Système=$($systemMetrics.CPU)% vs Sentinel=$($sentinelMetrics.CPU)% (diff: $cpuDiff%)" -ForegroundColor $(if($cpuDiff -lt 1.0) {"Green"} elseif($cpuDiff -lt 3.0) {"Yellow"} else {"Red"})
        
        # Validation Mémoire
        $memDiff = [math]::Abs($systemMetrics.MemoryMB - $sentinelMetrics.MemoryMB)
        $memStatus = if ($memDiff -lt 5) { "✅" } elseif ($memDiff -lt 20) { "⚠️" } else { "❌" }
        Write-Host "   Mémoire: $memStatus Système=$($systemMetrics.MemoryMB)MB vs Sentinel=$($sentinelMetrics.MemoryMB)MB (diff: $memDiff MB)" -ForegroundColor $(if($memDiff -lt 5) {"Green"} elseif($memDiff -lt 20) {"Yellow"} else {"Red"})
        
        # Validation Disk I/O (plus complexe à comparer)
        $diskStatus = if ($sentinelMetrics.DiskIO -eq 0 -and ($systemMetrics.DiskReadOps -gt 0 -or $systemMetrics.DiskWriteOps -gt 0)) { "❌" } elseif ($sentinelMetrics.DiskIO -gt 0) { "✅" } else { "⚠️" }
        Write-Host "   Disk I/O: $diskStatus Sentinel=$($sentinelMetrics.DiskIO) vs Système Read=$($systemMetrics.DiskReadOps) Write=$($systemMetrics.DiskWriteOps)" -ForegroundColor $(if($sentinelMetrics.DiskIO -gt 0) {"Green"} else {"Yellow"})
        
        # Validation Network I/O
        $netStatus = if ($sentinelMetrics.NetIO -eq 0 -and ($systemMetrics.NetRecvBytes -gt 0 -or $systemMetrics.NetSentBytes -gt 0)) { "❌" } elseif ($sentinelMetrics.NetIO -gt 0) { "✅" } else { "⚠️" }
        Write-Host "   Network I/O: $netStatus Sentinel=$($sentinelMetrics.NetIO) vs Système Recv=$($systemMetrics.NetRecvBytes) Send=$($systemMetrics.NetSentBytes)" -ForegroundColor $(if($sentinelMetrics.NetIO -gt 0) {"Green"} else {"Yellow"})
        
    } else {
        Write-Host "`n❌ Aucune métrique Sentinel trouvée dans les logs" -ForegroundColor Red
        Write-Host "   Vérifiez que l'agent est en cours d'exécution et log correctement" -ForegroundColor Yellow
    }
}

# Fonction pour diagnostiquer les problèmes spécifiques
function Find-MetricIssues {
    Write-Host "`n🔧 DIAGNOSTIC DES PROBLÈMES SPÉCIFIQUES" -ForegroundColor Yellow
    
    $issues = @()
    
    # Vérifier si le processus existe
    $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue
    if (-not $process) {
        $issues += "❌ Processus sentinel-agent non trouvé"
    }
    
    # Vérifier les logs
    $logFound = $false
    $logPaths = @("C:\ProgramData\Sentinel\logs\agent.log", "C:\ProgramData\Sentinel\agent.log")
    foreach ($logPath in $logPaths) {
        if (Test-Path $logPath) {
            $logFound = $true
            $recentLogs = Get-Content $logPath -Tail 5 -ErrorAction SilentlyContinue
            $hasMetrics = $recentLogs | Where-Object { $_ -match "Resource Usage:" }
            if (-not $hasMetrics) {
                $issues += "⚠️ Log trouvé mais pas de métriques récentes dans: $logPath"
            }
        }
    }
    
    if (-not $logFound) {
        $issues += "❌ Aucun log Sentinel trouvé"
    }
    
    # Vérifier les permissions
    $dataPath = "C:\ProgramData\Sentinel"
    if (Test-Path $dataPath) {
        $acl = Get-Acl $dataPath
        $hasWrite = $acl.Access | Where-Object { $_.IdentityReference -like "*SYSTEM*" -and $_.FileSystemRights -match "Write" }
        if (-not $hasWrite) {
            $issues += "⚠️ Permissions d'écriture可能 manquantes pour le service"
        }
    } else {
        $issues += "❌ Répertoire Sentinel non trouvé: $dataPath"
    }
    
    if ($issues.Count -gt 0) {
        Write-Host "Problèmes identifiés:" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "   $issue" -ForegroundColor $(if($issue -like "❌*") {"Red"} else {"Yellow"})
        }
    } else {
        Write-Host "✅ Aucun problème majeur détecté" -ForegroundColor Green
    }
}

# Exécuter les tests
Test-MetricsReliability
Find-MetricIssues

Write-Host "`n=== RECOMMANDATIONS ===" -ForegroundColor Cyan
Write-Host "1. Si CPU ❌: Appliquer correction singleton sysinfo" -ForegroundColor White
Write-Host "2. Si Mémoire ⚠️: Vérifier WorkingSetSize vs PrivateMemory" -ForegroundColor White
Write-Host "3. Si Disk I/O ❌: Corriger calcul delta des compteurs I/O" -ForegroundColor White
Write-Host "4. Si Network I/O ❌: Corriger calcul delta bytes réseau" -ForegroundColor White
Write-Host "5. Si logs ❌: Vérifier configuration logging et permissions" -ForegroundColor White

Write-Host "`n=== ANALYSE TERMINEE ===" -ForegroundColor Cyan
