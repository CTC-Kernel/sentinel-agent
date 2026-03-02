# Script pour corriger les problèmes de permissions MSI
# Probleme: "rs is not a valid user or group" - Erreur 1609

param(
    [switch]$Force
)

Write-Host "🔧 Correction des permissions pour l'installation MSI..." -ForegroundColor Yellow

# 1. Nettoyer les installations précédentes
if ($Force -or (Test-Path "C:\ProgramData\Sentinel")) {
    Write-Host "🗑️ Nettoyage de l'installation précédente..." -ForegroundColor Green
    
    try {
        # Prendre ownership
        takeown /A /F "C:\ProgramData\Sentinel" /R /D Y | Out-Null
        
        # Donner permissions complètes
        icacls "C:\ProgramData\Sentinel" /grant "Users:(OI)(CI)(F)" /T /C /Q | Out-Null
        icacls "C:\ProgramData\Sentinel" /grant "Administrators:(OI)(CI)(F)" /T /C /Q | Out-Null
        icacls "C:\ProgramData\Sentinel" /grant "SYSTEM:(OI)(CI)(F)" /T /C /Q | Out-Null
        
        # Supprimer les fichiers existants
        Remove-Item "C:\ProgramData\Sentinel\*" -Recurse -Force -ErrorAction SilentlyContinue
        
        Write-Host "✅ Nettoyage complété" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Erreur lors du nettoyage: $_" -ForegroundColor Yellow
    }
}

# 2. Vérifier les services existants
Write-Host "🔍 Vérification des services..." -ForegroundColor Green
$existingService = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Host "🛑 Arrêt du service existant..." -ForegroundColor Yellow
    try {
        Stop-Service -Name "SentinelGRCAgent" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "✅ Service arrêté" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Erreur lors de l'arrêt: $_" -ForegroundColor Yellow
    }
}

# 3. Nettoyer les processus
Write-Host "🔍 Vérification des processus..." -ForegroundColor Green
$processes = Get-Process -Name "sentinel-agent" -ErrorAction SilentlyContinue

if ($processes) {
    Write-Host "🛑 Arrêt des processus..." -ForegroundColor Yellow
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "✅ Processus arrêtés" -ForegroundColor Green
}

# 4. Nettoyer le registre
Write-Host "🔍 Nettoyage du registre..." -ForegroundColor Green
try {
    # Supprimer les clés de démarrage automatique
    Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "SentinelGRC" -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "SentinelAgentGUI" -ErrorAction SilentlyContinue
    
    Write-Host "✅ Registre nettoyé" -ForegroundColor Green
} catch {
    Write-Host "ℹ️ Aucune clé de registre à nettoyer" -ForegroundColor White
}

# 5. Créer les répertoires avec permissions correctes
Write-Host "📁 Préparation des répertoires..." -ForegroundColor Green

$dirs = @(
    "C:\ProgramData\Sentinel",
    "C:\ProgramData\Sentinel\data",
    "C:\ProgramData\Sentinel\logs",
    "C:\ProgramData\Sentinel\models",
    "C:\ProgramData\Sentinel\cache\llm"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✅ Créé: $dir" -ForegroundColor White
    }
    
    # Appliquer les permissions
    icacls $dir /grant "Users:(OI)(CI)(F)" /T /C /Q | Out-Null
    icacls $dir /grant "Administrators:(OI)(CI)(F)" /T /C /Q | Out-Null
    icacls $dir /grant "SYSTEM:(OI)(CI)(F)" /T /C /Q | Out-Null
}

Write-Host "🎉 Préparation terminée !" -ForegroundColor Cyan
Write-Host "📝 Prochaines étapes :" -ForegroundColor White
Write-Host "1. Relancez l'installation MSI" -ForegroundColor White
Write-Host "2. L'installation devrait maintenant réussir" -ForegroundColor White
Write-Host "3. Utilisez ce script avec -Force si nécessaire" -ForegroundColor Gray
