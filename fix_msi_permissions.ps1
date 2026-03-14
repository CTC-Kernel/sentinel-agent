# Script pour corriger les problèmes de permissions MSI
# Probleme: "rs is not a valid user or group" - Erreur 1609
# Fix: utilise les SIDs universels au lieu des noms de groupes localisés

param(
    [switch]$Force
)

# Vérifier les privilèges administrateur
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERREUR: Ce script doit etre execute en tant qu'Administrateur." -ForegroundColor Red
    Write-Host "Clic droit sur PowerShell -> Executer en tant qu'administrateur" -ForegroundColor Yellow
    exit 1
}

Write-Host "Correction des permissions pour l'installation MSI..." -ForegroundColor Yellow

# Utiliser les SIDs universels (fonctionnent sur toutes les langues Windows)
# S-1-5-32-545 = Builtin\Users (Utilisateurs)
# S-1-5-32-544 = Builtin\Administrators (Administrateurs)
# S-1-5-18     = NT AUTHORITY\SYSTEM

# 1. Nettoyer les installations précédentes
if ($Force -or (Test-Path "C:\ProgramData\Sentinel")) {
    Write-Host "Nettoyage de l'installation precedente..." -ForegroundColor Green

    try {
        # Prendre ownership
        takeown /A /F "C:\ProgramData\Sentinel" /R /D Y 2>$null | Out-Null

        # Donner permissions complètes via SIDs universels
        icacls "C:\ProgramData\Sentinel" /grant "*S-1-5-32-545:(OI)(CI)(F)" /T /C /Q | Out-Null
        icacls "C:\ProgramData\Sentinel" /grant "*S-1-5-32-544:(OI)(CI)(F)" /T /C /Q | Out-Null
        icacls "C:\ProgramData\Sentinel" /grant "*S-1-5-18:(OI)(CI)(F)" /T /C /Q | Out-Null

        # Supprimer les fichiers existants
        Remove-Item "C:\ProgramData\Sentinel\*" -Recurse -Force -ErrorAction SilentlyContinue

        Write-Host "Nettoyage complete" -ForegroundColor Green
    } catch {
        Write-Host "Erreur lors du nettoyage: $_" -ForegroundColor Yellow
    }
}

# 2. Vérifier les services existants
Write-Host "Verification des services..." -ForegroundColor Green
$existingService = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Host "Arret du service existant..." -ForegroundColor Yellow
    try {
        Stop-Service -Name "SentinelGRCAgent" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "Service arrete" -ForegroundColor Green
    } catch {
        Write-Host "Erreur lors de l'arret: $_" -ForegroundColor Yellow
    }
}

# 3. Nettoyer les processus
Write-Host "Verification des processus..." -ForegroundColor Green
$processes = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue

if ($processes) {
    Write-Host "Arret des processus..." -ForegroundColor Yellow
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "Processus arretes" -ForegroundColor Green
}

# 4. Nettoyer le registre
Write-Host "Nettoyage du registre..." -ForegroundColor Green
try {
    # Supprimer les clés de démarrage automatique
    Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "SentinelGRC" -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "SentinelAgentGUI" -ErrorAction SilentlyContinue

    Write-Host "Registre nettoye" -ForegroundColor Green
} catch {
    Write-Host "Aucune cle de registre a nettoyer" -ForegroundColor White
}

# 5. Créer les répertoires avec permissions correctes
Write-Host "Preparation des repertoires..." -ForegroundColor Green

$dirs = @(
    "C:\ProgramData\Sentinel",
    "C:\ProgramData\Sentinel\data",
    "C:\ProgramData\Sentinel\logs",
    "C:\ProgramData\Sentinel\models",
    "C:\ProgramData\Sentinel\cache\llm",
    "C:\ProgramData\Sentinel\backups"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Cree: $dir" -ForegroundColor White
    }

    # Appliquer les permissions via SIDs universels
    icacls $dir /grant "*S-1-5-32-545:(OI)(CI)(F)" /T /C /Q | Out-Null
    icacls $dir /grant "*S-1-5-32-544:(OI)(CI)(F)" /T /C /Q | Out-Null
    icacls $dir /grant "*S-1-5-18:(OI)(CI)(F)" /T /C /Q | Out-Null
}

# 6. Vérifier que le fichier de config existe
$configPath = "C:\ProgramData\Sentinel\agent.json"
if (-not (Test-Path $configPath)) {
    Write-Host "Creation du fichier de configuration par defaut..." -ForegroundColor Green
    $defaultConfig = @{
        server_url = "https://europe-west4-sentinel-grc-a8701.cloudfunctions.net/agentApi"
        enrollment_token = ""
        check_interval_secs = 3600
        heartbeat_interval_secs = 60
        log_level = "info"
        tls_verify = $true
    } | ConvertTo-Json -Depth 4
    $defaultConfig | Out-File -FilePath $configPath -Encoding utf8
    Write-Host "Config cree: $configPath" -ForegroundColor White
    Write-Host "IMPORTANT: Ajoutez votre enrollment_token dans $configPath avant de demarrer l'agent" -ForegroundColor Red
}

# 7. Vérifier les permissions finales
Write-Host ""
Write-Host "Verification des permissions..." -ForegroundColor Green
$testFile = "C:\ProgramData\Sentinel\data\.perm_test"
try {
    "test" | Out-File -FilePath $testFile -Force -ErrorAction Stop
    Remove-Item $testFile -Force -ErrorAction SilentlyContinue
    Write-Host "Permissions OK - ecriture verifiee dans C:\ProgramData\Sentinel\data\" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: Impossible d'ecrire dans C:\ProgramData\Sentinel\data\ - $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Preparation terminee !" -ForegroundColor Cyan
Write-Host "Prochaines etapes :" -ForegroundColor White
Write-Host "  1. Ajoutez votre enrollment_token dans C:\ProgramData\Sentinel\agent.json" -ForegroundColor White
Write-Host "  2. Relancez l'installation MSI" -ForegroundColor White
Write-Host "  3. Utilisez ce script avec -Force pour un nettoyage complet si necessaire" -ForegroundColor Gray
