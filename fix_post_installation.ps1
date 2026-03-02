# Script pour corriger l'agent après installation MSI
# Problème: L'agent ne se lance pas après installation MSI

Write-Host "🔧 Correction de l'agent Sentinel après installation MSI..." -ForegroundColor Yellow

# 1. Vérifier que l'agent est installé
$agentPath = "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe"
if (-not (Test-Path $agentPath)) {
    Write-Host "❌ Agent non trouvé. Veuillez d'abord installer l'agent via MSI." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Agent trouvé: $agentPath" -ForegroundColor Green

# 2. Créer les répertoires nécessaires
Write-Host "📁 Création des répertoires..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path "C:\ProgramData\Sentinel\data" | Out-Null
New-Item -ItemType Directory -Force -Path "C:\ProgramData\Sentinel\logs" | Out-Null

# 3. Créer le fichier de configuration
$configPath = "C:\ProgramData\Sentinel\agent.json"
if (-not (Test-Path $configPath)) {
    Write-Host "⚙️ Création de la configuration..." -ForegroundColor Green
    
    $config = @{
        server_url = "https://YOUR_REGION-YOUR_FIREBASE_PROJECT_ID.cloudfunctions.net/agentApi"
        check_interval_secs = 3600
        heartbeat_interval_secs = 60
        offline_mode_days = 7
        log_level = "info"
        tls_verify = $true
        usb_monitoring = $true
        usb_block_mass_storage = $true
        gui = @{
            enabled = $true
            theme = "dark"
            minimize_to_tray = $true
            auto_start = $true
        }
        compliance = @{
            frameworks = @("CIS", "NIST", "ISO27001")
            scan_interval_secs = 86400
            auto_remediate = $true
        }
        scanner = @{
            enabled = $true
            scan_interval_secs = 43200
            max_cpu_usage = 50
        }
        fim = @{
            enabled = $true
            watched_paths = @("C:\Windows\System32", "C:\Program Files")
            algorithm = "BLAKE3"
        }
        network = @{
            discovery_enabled = $true
            passive_scan = $true
            protocols = @("mdns", "ssdp", "arp")
        }
    }
    
    $config | ConvertTo-Json -Depth 4 | Out-File -FilePath $configPath -Encoding UTF8
    Write-Host "✅ Configuration créée: $configPath" -ForegroundColor Green
} else {
    Write-Host "✅ Configuration existante: $configPath" -ForegroundColor Green
}

# 4. Créer le raccourci bureau
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Sentinel Agent.lnk"

Write-Host "📱 Création du raccourci bureau..." -ForegroundColor Green
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $agentPath
$shortcut.WorkingDirectory = "C:\Program Files (x86)\Sentinel\bin"
$shortcut.Description = "Sentinel GRC Agent - Interface Graphique"
$shortcut.Save()

# 5. Configurer le démarrage automatique
Write-Host "🚀 Configuration du démarrage automatique..." -ForegroundColor Green
$regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
$regName = "SentinelGRC"

try {
    Set-ItemProperty -Path $regPath -Name $regName -Value $agentPath -Force
    Write-Host "✅ Démarrage automatique configuré" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Erreur lors de la configuration du démarrage: $_" -ForegroundColor Yellow
}

# 6. Tester le lancement
Write-Host "🧪 Test du lancement..." -ForegroundColor Green
try {
    Start-Process -FilePath $agentPath -NoNewWindow
    Write-Host "✅ Agent lancé" -ForegroundColor Green
    
    Start-Sleep -Seconds 3
    $process = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "✅ Processus actif: PID $($process.Id)" -ForegroundColor Green
        Write-Host "🎉 L'agent est maintenant opérationnel!" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️ Le processus s'est terminé rapidement" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur lors du lancement: $_" -ForegroundColor Red
}

Write-Host "📝 Résumé:" -ForegroundColor Cyan
Write-Host "  • Exécutable: $agentPath" -ForegroundColor White
Write-Host "  • Configuration: $configPath" -ForegroundColor White
Write-Host "  • Raccourci: $shortcutPath" -ForegroundColor White
Write-Host "  • Démarrage auto: $regPath\$regName" -ForegroundColor White
