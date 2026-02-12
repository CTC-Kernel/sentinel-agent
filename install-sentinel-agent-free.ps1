# Sentinel GRC Agent - Installation Script (Free Alternative)
# This script bypasses SmartScreen by using direct installation

param(
    [string]$ServerUrl = "https://europe-west1-sentinel-grc-a8701.cloudfunctions.net/agentApi",
    [string]$EnrollmentToken = ""
)

Write-Host "🔒 Sentinel GRC Agent - Installation gratuite" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Check admin rights
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ Droits administrateur requis" -ForegroundColor Red
    Write-Host "Relancez ce script en tant qu'administrateur" -ForegroundColor Yellow
    pause
    exit 1
}

# Create installation directory
$installDir = "C:\ProgramFiles\Sentinel GRC\Agent"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Download agent (placeholder - replace with actual binary URL)
Write-Host "📥 Téléchargement de l'agent..." -ForegroundColor Yellow
# $agentUrl = "https://github.com/votre-repo/releases/latest/download/sentinel-agent.exe"
# Invoke-WebRequest -Uri $agentUrl -OutFile "$installDir\sentinel-agent.exe"

# For now, copy from current directory
if (Test-Path ".\target\x86_64-pc-windows-gnu\release\agent-core.exe") {
    Copy-Item ".\target\x86_64-pc-windows-gnu\release\agent-core.exe" "$installDir\sentinel-agent.exe" -Force
    Write-Host "✅ Agent copié avec succès" -ForegroundColor Green
} else {
    Write-Host "❌ Fichier agent-core.exe non trouvé" -ForegroundColor Red
    Write-Host "Build d'abord avec: cargo build --release --target x86_64-pc-windows-gnu" -ForegroundColor Yellow
    pause
    exit 1
}

# Create configuration
$config = @{
    server_url = $ServerUrl
    enrollment_token = $EnrollmentToken
    auto_start = $true
    log_level = "info"
} | ConvertTo-Json

Set-Content -Path "$installDir\agent.json" -Value $config -Encoding UTF8

# Add to PATH (optional)
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "Machine")
if ($currentPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$installDir", "Machine")
    Write-Host "✅ Ajouté au PATH système" -ForegroundColor Green
}

# Create service
Write-Host "🔧 Création du service Windows..." -ForegroundColor Yellow
try {
    # Remove existing service if present
    $service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
    if ($service) {
        Stop-Service -Name "SentinelGRCAgent" -Force
        Remove-Service -Name "SentinelGRCAgent" -Force
    }

    # Create new service
    New-Service -Name "SentinelGRCAgent" `
                 -DisplayName "Sentinel GRC Agent" `
                 -Description "Agent de conformité endpoint pour Sentinel GRC" `
                 -BinaryPathName "$installDir\sentinel-agent.exe --service" `
                 -StartupType Automatic

    Write-Host "✅ Service créé avec succès" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Erreur lors de la création du service: $_" -ForegroundColor Yellow
}

# Add Windows Defender exclusion (free)
Write-Host "🛡️ Ajout exclusion Windows Defender..." -ForegroundColor Yellow
try {
    Add-MpPreference -ExclusionPath $installDir -ExclusionProcess "$installDir\sentinel-agent.exe" -ErrorAction SilentlyContinue
    Write-Host "✅ Exclusion Defender ajoutée" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Impossible d'ajouter l'exclusion Defender" -ForegroundColor Yellow
}

# Create desktop shortcut
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktop\Sentinel GRC Agent.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$installDir\sentinel-agent.exe"
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = "Lancer Sentinel GRC Agent"
$shortcut.Save()

# Start service if enrollment token provided
if ($EnrollmentToken) {
    Write-Host "🚀 Démarrage de l'agent..." -ForegroundColor Yellow
    Start-Service -Name "SentinelGRCAgent"
    
    # Run enrollment
    Start-Process -FilePath "$installDir\sentinel-agent.exe" -ArgumentList "enroll --token $EnrollmentToken --server $ServerUrl" -Wait
    
    Write-Host "✅ Agent installé et enregistré!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Agent installé mais non enregistré" -ForegroundColor Yellow
    Write-Host "Pour enregistrer: sentinel-agent enroll --token VOTRE_TOKEN" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🎉 Installation terminée!" -ForegroundColor Green
Write-Host "Raccourci disponible sur le bureau" -ForegroundColor Cyan
Write-Host "Service: SentinelGRCAgent" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  Vérifier le service: Get-Service SentinelGRCAgent" -ForegroundColor White
Write-Host "  Démarrer: Start-Service SentinelGRCAgent" -ForegroundColor White
Write-Host "  Arrêter: Stop-Service SentinelGRCAgent" -ForegroundColor White
Write-Host "  Logs: Get-EventLog -LogName Application -Source 'SentinelGRCAgent'" -ForegroundColor White

pause
