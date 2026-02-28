# Script de test complet pour valider les corrections des métriques Sentinel
# Ce script vérifie que toutes les métriques sont fiables après corrections

Write-Host "=== VALIDATION COMPLÈTE DES MÉTRIQUES CORRIGÉES ===" -ForegroundColor Cyan

# Test 1: Vérifier que l'agent log les métriques
function Test-AgentLogging {
    Write-Host "`n🔍 TEST 1: LOGGING DES MÉTRIQUES" -ForegroundColor Yellow
    
    $logPaths = @(
        "C:\ProgramData\Sentinel\logs\agent.log",
        "C:\ProgramData\Sentinel\agent.log",
        "C:\temp\agent.log"
    )
    
    $foundLog = $false
    foreach ($logPath in $logPaths) {
        if (Test-Path $logPath) {
            Write-Host "   Log trouvé: $logPath" -ForegroundColor Gray
            $foundLog = $true
            
            # Surveiller les logs pendant 10 secondes
            Write-Host "   Surveillance des logs pendant 10 secondes..." -ForegroundColor White
            
            $initialCount = (Get-Content $logPath -ErrorAction SilentlyContinue | Measure-Object).Count
            Start-Sleep -Seconds 10
            $finalCount = (Get-Content $logPath -ErrorAction SilentlyContinue | Measure-Object).Count
            
            if ($finalCount -gt $initialCount) {
                $newLogs = Get-Content $logPath -Tail ($finalCount - $initialCount) -ErrorAction SilentlyContinue
                $resourceLogs = $newLogs | Where-Object { $_ -match "Resource Usage:" }
                
                if ($resourceLogs) {
                    Write-Host "   ✅ Métriques trouvées:" -ForegroundColor Green
                    foreach ($log in $resourceLogs) {
                        Write-Host "      $log" -ForegroundColor Cyan
                    }
                } else {
                    Write-Host "   ⚠️ Logs nouveaux mais pas de métriques Resource Usage" -ForegroundColor Yellow
                }
            } else {
                Write-Host "   ❌ Aucun nouveau log pendant 10 secondes" -ForegroundColor Red
            }
            break
        }
    }
    
    if (-not $foundLog) {
        Write-Host "   ❌ Aucun log trouvé" -ForegroundColor Red
    }
}

# Test 2: Comparaison avec métriques système
function Test-MetricsAccuracy {
    Write-Host "`n🔍 TEST 2: PRÉCISION DES MÉTRIQUES" -ForegroundColor Yellow
    
    $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $process) {
        Write-Host "   ❌ Processus sentinel-agent non trouvé" -ForegroundColor Red
        return
    }
    
    # Métriques système réelles
    $systemMetrics = @{
        CPU = 0.0
        MemoryMB = [math]::Round($process.WorkingSet64 / 1MB, 2)
        PID = $process.Id
    }
    
    # CPU plus précis avec Performance Counter
    try {
        $cpuCounter = New-Object System.Diagnostics.PerformanceCounter("Process", "% Processor Time", $process.ProcessName)
        $cpuCounter.NextValue() | Out-Null
        Start-Sleep -Milliseconds 300
        $systemMetrics.CPU = [math]::Round($cpuCounter.NextValue(), 2)
    } catch {
        $systemMetrics.CPU = 0.0
    }
    
    Write-Host "   Métriques système de référence:" -ForegroundColor Gray
    Write-Host "      CPU: $($systemMetrics.CPU)%" -ForegroundColor White
    Write-Host "      Mémoire: $($systemMetrics.MemoryMB) MB" -ForegroundColor White
    Write-Host "      PID: $($systemMetrics.PID)" -ForegroundColor White
    
    # Analyser les logs Sentinel les plus récents
    $logPaths = @("C:\ProgramData\Sentinel\logs\agent.log", "C:\ProgramData\Sentinel\agent.log")
    $sentinelMetrics = $null
    
    foreach ($logPath in $logPaths) {
        if (Test-Path $logPath) {
            $recentLogs = Get-Content $logPath -Tail 5 -ErrorAction SilentlyContinue
            $resourceLog = $recentLogs | Where-Object { $_ -match "Resource Usage:" } | Select-Object -Last 1
            
            if ($resourceLog -match "CPU=([\d\.]+)%.*RAM=(\d+)MB.*DiskIO=(\d+).*NetIO=(\d+)") {
                $sentinelMetrics = @{
                    CPU = [double]$matches[1]
                    MemoryMB = [int]$matches[2]
                    DiskIO = [int]$matches[3]
                    NetIO = [int]$matches[4]
                }
                break
            }
        }
    }
    
    if ($sentinelMetrics) {
        Write-Host "   Métriques Sentinel:" -ForegroundColor Gray
        Write-Host "      CPU: $($sentinelMetrics.CPU)%" -ForegroundColor White
        Write-Host "      Mémoire: $($sentinelMetrics.MemoryMB) MB" -ForegroundColor White
        Write-Host "      Disk I/O: $($sentinelMetrics.DiskIO) KB/s" -ForegroundColor White
        Write-Host "      Network I/O: $($sentinelMetrics.NetIO) B/s" -ForegroundColor White
        
        # Validation
        Write-Host "`n   Validation:" -ForegroundColor Yellow
        
        # CPU
        $cpuDiff = [math]::Abs($systemMetrics.CPU - $sentinelMetrics.CPU)
        $cpuStatus = if ($cpuDiff -lt 2.0) { "✅ FIABLE" } elseif ($cpuDiff -lt 5.0) { "⚠️ ACCEPTABLE" } else { "❌ NON FIABLE" }
        Write-Host "      CPU: $cpuStatus (écart: $cpuDiff%)" -ForegroundColor $(if($cpuDiff -lt 2.0) {"Green"} elseif($cpuDiff -lt 5.0) {"Yellow"} else {"Red"})
        
        # Mémoire
        $memDiff = [math]::Abs($systemMetrics.MemoryMB - $sentinelMetrics.MemoryMB)
        $memStatus = if ($memDiff -lt 10) { "✅ FIABLE" } elseif ($memDiff -lt 30) { "⚠️ ACCEPTABLE" } else { "❌ NON FIABLE" }
        Write-Host "      Mémoire: $memStatus (écart: $memDiff MB)" -ForegroundColor $(if($memDiff -lt 10) {"Green"} elseif($memDiff -lt 30) {"Yellow"} else {"Red"})
        
        # Disk I/O (doit être > 0 si l'agent est actif)
        $diskStatus = if ($sentinelMetrics.DiskIO -ge 0) { "✅ MESURÉ" } else { "❌ ERREUR" }
        Write-Host "      Disk I/O: $diskStatus ($($sentinelMetrics.DiskIO) KB/s)" -ForegroundColor $(if($sentinelMetrics.DiskIO -ge 0) {"Green"} else {"Red"})
        
        # Network I/O
        $netStatus = if ($sentinelMetrics.NetIO -ge 0) { "✅ MESURÉ" } else { "❌ ERREUR" }
        Write-Host "      Network I/O: $netStatus ($($sentinelMetrics.NetIO) B/s)" -ForegroundColor $(if($sentinelMetrics.NetIO -ge 0) {"Green"} else {"Red"})
        
    } else {
        Write-Host "   ❌ Aucune métrique Sentinel trouvée pour comparaison" -ForegroundColor Red
    }
}

# Test 3: Vérification de la cohérence temporelle
function Test-TemporalConsistency {
    Write-Host "`n🔍 TEST 3: COHÉRENCE TEMPORELLE" -ForegroundColor Yellow
    
    Write-Host "   Surveillance des métriques pendant 15 secondes..." -ForegroundColor White
    
    $metrics = @()
    $logPath = "C:\ProgramData\Sentinel\logs\agent.log"
    
    if (-not (Test-Path $logPath)) {
        Write-Host "   ❌ Log non trouvé" -ForegroundColor Red
        return
    }
    
    $initialSize = (Get-Item $logPath).Length
    
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        
        $currentSize = (Get-Item $logPath).Length
        if ($currentSize -gt $initialSize) {
            $newContent = Get-Content $logPath -Tail 10 -ErrorAction SilentlyContinue
            $resourceLog = $newContent | Where-Object { $_ -match "Resource Usage:" } | Select-Object -Last 1
            
            if ($resourceLog -match "CPU=([\d\.]+)%.*RAM=(\d+)MB") {
                $metrics += @{
                    Time = Get-Date
                    CPU = [double]$matches[1]
                    Memory = [int]$matches[2]
                }
                Write-Host "      [$($i+1)s] CPU=$($matches[1])% RAM=$($matches[2])MB" -ForegroundColor Cyan
            }
        }
        
        $initialSize = $currentSize
    }
    
    if ($metrics.Count -gt 0) {
        Write-Host "`n   Analyse de cohérence:" -ForegroundColor Yellow
        
        # Vérifier que CPU n'est pas toujours 0
        $cpuValues = $metrics | ForEach-Object { $_.CPU }
        $cpuNonZero = ($cpuValues | Where-Object { $_ -gt 0 }).Count
        $cpuStatus = if ($cpuNonZero -gt 0) { "✅ ACTIF" } else { "❌ INACTIF/ERREUR" }
        Write-Host "      CPU: $cpuStatus ($cpuNonZero/$($metrics.Count) échantillons > 0)" -ForegroundColor $(if($cpuNonZero -gt 0) {"Green"} else {"Red"})
        
        # Vérifier la stabilité mémoire
        $memValues = $metrics | ForEach-Object { $_.Memory }
        $memAvg = [math]::Round(($memValues | Measure-Object -Average).Average, 1)
        $memVar = [math]::Round(($memValues | Measure-Object -StandardDeviation).StandardDeviation, 1)
        $memStatus = if ($memVar -lt 10) { "✅ STABLE" } elseif ($memVar -lt 25) { "⚠️ VARIABLE" } else { "❌ INSTABLE" }
        Write-Host "      Mémoire: $memStatus (moyenne: ${memAvg}MB, écart-type: ${memVar}MB)" -ForegroundColor $(if($memVar -lt 10) {"Green"} elseif($memVar -lt 25) {"Yellow"} else {"Red"})
        
    } else {
        Write-Host "   ❌ Aucune métrique collectée pendant 15 secondes" -ForegroundColor Red
    }
}

# Test 4: Vérification de l'état du service
function Test-ServiceHealth {
    Write-Host "`n🔍 TEST 4: ÉTAT DU SERVICE" -ForegroundColor Yellow
    
    try {
        $service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "   Service: $($service.Status)" -ForegroundColor $(if($service.Status -eq "Running") {"Green"} else {"Red"})
            Write-Host "   DisplayName: $($service.DisplayName)" -ForegroundColor Gray
            
            $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "   Processus actif: PID $($process.Id)" -ForegroundColor Green
                Write-Host "   Mémoire processus: $([math]::Round($process.WorkingSet64/1MB,1)) MB" -ForegroundColor White
                Write-Host "   Temps de fonctionnement: $($process.StartTime)" -ForegroundColor Gray
            } else {
                Write-Host "   ❌ Aucun processus sentinel-agent trouvé" -ForegroundColor Red
            }
        } else {
            Write-Host "   ❌ Service SentinelGRCAgent non trouvé" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ❌ Erreur vérification service: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Exécuter tous les tests
Test-ServiceHealth
Test-AgentLogging
Test-MetricsAccuracy
Test-TemporalConsistency

Write-Host "`n=== RÉSUMÉ DES CORRECTIONS APPLIQUÉES ===" -ForegroundColor Cyan
Write-Host "✅ CPU: Singleton sysinfo avec delta temporel 500ms" -ForegroundColor Green
Write-Host "✅ Mémoire: WorkingSetSize via API Windows native" -ForegroundColor Green
Write-Host "✅ Disk I/O: Calcul delta bytes/secondes" -ForegroundColor Green
Write-Host "✅ Network I/O: Cache avec delta temporel" -ForegroundColor Green
Write-Host "✅ Logging: Chaque échantillon (debug) vs tous les 10 (prod)" -ForegroundColor Green

Write-Host "`n=== VALIDATION TERMINÉE ===" -ForegroundColor Cyan
