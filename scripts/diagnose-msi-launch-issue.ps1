# Diagnostic complet du problème de lancement après installation MSI
# Agent s'ouvre et se ferme instantanément

Write-Host "=== DIAGNOSTIC LANCEMENT SENTINEL APRÈS MSI ===" -ForegroundColor Cyan

# 1. Vérifier l'état actuel
function Check-CurrentState {
    Write-Host "`n🔍 ÉTAT ACTUEL DU SYSTÈME" -ForegroundColor Yellow
    
    # Service
    try {
        $service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "Service SentinelGRCAgent: $($service.Status)" -ForegroundColor $(if($service.Status -eq "Running") {"Green"} else {"Red"})
        } else {
            Write-Host "Service SentinelGRCAgent: Non trouvé" -ForegroundColor Red
        }
    } catch {
        Write-Host "Service: Erreur vérification" -ForegroundColor Red
    }
    
    # Processus
    $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Processus sentinel-agent: PID $($process.Id)" -ForegroundColor Green
    } else {
        Write-Host "Processus sentinel-agent: Non trouvé" -ForegroundColor Red
    }
    
    # Auto-start registry
    try {
        $autoStart = Get-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "SentinelAgentGUI" -ErrorAction SilentlyContinue
        if ($autoStart) {
            Write-Host "Auto-start GUI: Configuré" -ForegroundColor Green
            Write-Host "  Commande: $($autoStart.SentinelAgentGUI)" -ForegroundColor Gray
        } else {
            Write-Host "Auto-start GUI: Non configuré" -ForegroundColor Red
        }
    } catch {
        Write-Host "Auto-start GUI: Erreur vérification" -ForegroundColor Red
    }
    
    # Fichiers d'installation
    $exePath = "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe"
    if (Test-Path $exePath) {
        $fileInfo = Get-Item $exePath
        Write-Host "Exécutable: Présent ($($fileInfo.Length) bytes)" -ForegroundColor Green
    } else {
        Write-Host "Exécutable: Non trouvé" -ForegroundColor Red
    }
    
    # Configuration
    $configPath = "C:\ProgramData\Sentinel\agent.json"
    if (Test-Path $configPath) {
        Write-Host "Configuration: Présente" -ForegroundColor Green
    } else {
        Write-Host "Configuration: Non trouvée" -ForegroundColor Red
    }
}

# 2. Analyser les causes possibles
function Analyze-PossibleCauses {
    Write-Host "`n🔍 ANALYSE DES CAUSES POSSIBLES" -ForegroundColor Yellow
    
    $causes = @()
    
    # Cause 1: Service en mode --service sans GUI
    $service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        $causes += "✅ Service actif en mode --service (pas de GUI)"
    }
    
    # Cause 2: Auto-start GUI mais service déjà running
    $autoStart = Get-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "SentinelAgentGUI" -ErrorAction SilentlyContinue
    if ($autoStart -and $service -and $service.Status -eq "Running") {
        $causes += "⚠️ Auto-start GUI lance mais service déjà running (fermeture immédiate)"
    }
    
    # Cause 3: Permissions insuffisantes
    $dataPath = "C:\ProgramData\Sentinel"
    if (Test-Path $dataPath) {
        try {
            $testFile = "$dataPath\test_write.tmp"
            "test" | Out-File -FilePath $testFile -ErrorAction Stop
            Remove-Item $testFile -ErrorAction SilentlyContinue
            $causes += "✅ Permissions d'écriture OK"
        } catch {
            $causes += "❌ Permissions d'écriture insuffisantes"
        }
    }
    
    # Cause 4: Configuration GUI manquante
    $configPath = "C:\ProgramData\Sentinel\agent.json"
    if (Test-Path $configPath) {
        $config = Get-Content $configPath | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($config.gui.enabled -eq $true) {
            $causes += "✅ Configuration GUI activée"
        } else {
            $causes += "❌ Configuration GUI désactivée"
        }
    }
    
    # Cause 5: Logs d'erreurs
    $logPath = "C:\ProgramData\Sentinel\logs\agent.log"
    if (Test-Path $logPath) {
        $recentLogs = Get-Content $logPath -Tail 5 -ErrorAction SilentlyContinue
        $errorLogs = $recentLogs | Where-Object { $_ -match "error|ERROR|Error" }
        if ($errorLogs) {
            $causes += "❌ Erreurs trouvées dans les logs"
            foreach ($error in $errorLogs) {
                Write-Host "    Erreur: $error" -ForegroundColor Red
            }
        } else {
            $causes += "✅ Aucune erreur récente dans les logs"
        }
    } else {
        $causes += "⚠️ Log agent.log non trouvé"
    }
    
    foreach ($cause in $causes) {
        Write-Host "  $cause" -ForegroundColor $(if($cause -like "✅*") {"Green"} elseif($cause -like "❌*") {"Red"} else {"Yellow"})
    }
}

# 3. Tester le lancement manuel
function Test-ManualLaunch {
    Write-Host "`n🔍 TEST LANCEMENT MANUEL" -ForegroundColor Yellow
    
    Write-Host "Test du lancement GUI manuel..." -ForegroundColor White
    
    $process = Start-Process -FilePath "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe" -ArgumentList "run" -PassThru -WindowStyle Normal
    Start-Sleep -Seconds 2
    
    if ($process.HasExited) {
        Write-Host "❌ Processus terminé (Exit code: $($process.ExitCode))" -ForegroundColor Red
        return $false
    } else {
        Write-Host "✅ Processus actif (PID: $($process.Id))" -ForegroundColor Green
        
        # Arrêter le processus de test
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        return $true
    }
}

# 4. Proposer les solutions
function Propose-Solutions {
    Write-Host "`n🔧 SOLUTIONS PROPOSÉES" -ForegroundColor Yellow
    
    Write-Host "`n1. Solution rapide - Lancer manuellement:" -ForegroundColor Cyan
    Write-Host "   powershell -Command 'Start-Process -FilePath `"C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe`" -ArgumentList `"run`"'" -ForegroundColor Gray
    
    Write-Host "`n2. Solution service - Arrêter et lancer en GUI:" -ForegroundColor Cyan
    Write-Host "   Stop-Service -Name `"SentinelGRCAgent`" -Force" -ForegroundColor Gray
    Write-Host "   Start-Process -FilePath `"C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe`" -ArgumentList `"run`"" -ForegroundColor Gray
    
    Write-Host "`n3. Solution permanente - Corriger MSI:" -ForegroundColor Cyan
    Write-Host "   - Modifier le MSI pour ne pas auto-démarrer le service" -ForegroundColor Gray
    Write-Host "   - Configurer auto-start GUI uniquement" -ForegroundColor Gray
    Write-Host "   - Ajouter vérification au démarrage" -ForegroundColor Gray
}

# Exécuter le diagnostic complet
Check-CurrentState
Analyze-PossibleCauses
$manualResult = Test-ManualLaunch
Propose-Solutions

Write-Host "`n=== DIAGNOSTIC TERMINÉ ===" -ForegroundColor Cyan

if (-not $manualResult) {
    Write-Host "🚨 Le lancement manuel échoue aussi - problème de configuration ou de dépendances" -ForegroundColor Red
} else {
    Write-Host "✅ Le lancement manuel fonctionne - problème de configuration auto-start" -ForegroundColor Green
}
