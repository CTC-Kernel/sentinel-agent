#Requires -RunAsAdministrator
# Sentinel Agent - Installation Script for Windows
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$Token,

    [Parameter(Mandatory=$false)]
    [string]$ServerUrl = "https://europe-west1-sentinel-grc-a8701.cloudfunctions.net/agentApi"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Sentinel GRC Agent - Installation   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Installation paths
$InstallDir = "$env:ProgramFiles\Sentinel"
$BinDir = "$InstallDir\bin"
$ConfigDir = "$InstallDir\config"
$DataDir = "$env:ProgramData\Sentinel"
$ServiceName = "SentinelGRCAgent"

# Prompt for token if not provided
if (-not $Token) {
    Write-Host "Entrez le token d'enrollment fourni par votre administrateur:" -ForegroundColor Yellow
    $Token = Read-Host "Token"

    if (-not $Token) {
        Write-Host "Erreur: Le token d'enrollment est requis." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "1. Creation des repertoires..." -ForegroundColor Yellow

# Create directories
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

Write-Host "   - $InstallDir" -ForegroundColor Gray
Write-Host "   - $DataDir" -ForegroundColor Gray

Write-Host ""
Write-Host "2. Copie des fichiers..." -ForegroundColor Yellow

# Copy executable
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item "$ScriptDir\sentinel-agent.exe" "$BinDir\sentinel-agent.exe" -Force
Write-Host "   - sentinel-agent.exe" -ForegroundColor Gray

# Create config file
$ConfigContent = @{
    server_url = $ServerUrl
    enrollment_token = $Token
    data_dir = $DataDir
    log_level = "info"
    heartbeat_interval_secs = 60
    check_interval_secs = 3600
} | ConvertTo-Json -Depth 10

Set-Content -Path "$ConfigDir\agent.json" -Value $ConfigContent
Write-Host "   - agent.json" -ForegroundColor Gray

Write-Host ""
Write-Host "3. Installation du service Windows..." -ForegroundColor Yellow

# Stop and remove existing service if exists
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "   - Arret du service existant..." -ForegroundColor Gray
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Write-Host "   - Suppression du service existant..." -ForegroundColor Gray
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 1
}

# Create service
$ServicePath = "`"$BinDir\sentinel-agent.exe`" --service --config `"$ConfigDir\agent.json`""

New-Service -Name $ServiceName `
    -DisplayName "Sentinel GRC Agent" `
    -Description "Agent de conformite endpoint pour la plateforme Sentinel GRC" `
    -BinaryPathName $ServicePath `
    -StartupType Automatic `
    | Out-Null

Write-Host "   - Service $ServiceName cree" -ForegroundColor Gray

# Configure service recovery
sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null
Write-Host "   - Options de recuperation configurees" -ForegroundColor Gray

Write-Host ""
Write-Host "4. Ajout au demarrage automatique..." -ForegroundColor Yellow

# Add to Windows startup (registry)
$RegPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
Set-ItemProperty -Path $RegPath -Name "SentinelAgent" -Value "`"$BinDir\sentinel-agent.exe`"" -Type String
Write-Host "   - Entree registre ajoutee" -ForegroundColor Gray

Write-Host ""
Write-Host "5. Enrollment de l'agent..." -ForegroundColor Yellow

# Run enrollment
try {
    $enrollResult = & "$BinDir\sentinel-agent.exe" enroll --token $Token --server $ServerUrl 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   - Enrollment reussi" -ForegroundColor Green
    } else {
        Write-Host "   - Enrollment: $enrollResult" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   - Enrollment sera effectue au demarrage du service" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "6. Demarrage du service..." -ForegroundColor Yellow

Start-Service -Name $ServiceName
Start-Sleep -Seconds 2

$service = Get-Service -Name $ServiceName
if ($service.Status -eq "Running") {
    Write-Host "   - Service demarre avec succes" -ForegroundColor Green
} else {
    Write-Host "   - Statut du service: $($service.Status)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Installation terminee!              " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "L'agent Sentinel est maintenant installe et actif." -ForegroundColor White
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Cyan
Write-Host "  - Statut:    Get-Service $ServiceName" -ForegroundColor Gray
Write-Host "  - Logs:      Get-EventLog -LogName Application -Source $ServiceName" -ForegroundColor Gray
Write-Host "  - Arreter:   Stop-Service $ServiceName" -ForegroundColor Gray
Write-Host "  - Demarrer:  Start-Service $ServiceName" -ForegroundColor Gray
Write-Host ""
Write-Host "Tableau de bord: https://app.cyber-threat-consulting.com/settings?tab=agents" -ForegroundColor Cyan
Write-Host ""
