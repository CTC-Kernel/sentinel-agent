# Script de test final pour la correction DPAPI
# Ce script force la suppression de la clé corrompue et teste l'agent

Write-Host "=== TEST DE VALIDATION DPAPI ===" -ForegroundColor Green
Write-Host "Arrêt forcé des processus sentinel-agent..." -ForegroundColor Yellow

# Forcer l'arrêt de tous les processus sentinel-agent
Get-Process | Where-Object {$_.ProcessName -like "*sentinel*"} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Suppression du fichier de clé DPAPI corrompue..." -ForegroundColor Yellow

# Supprimer le fichier de clé avec toutes les méthodes possibles
$keyPath = "C:\ProgramData\Sentinel\key.dpapi"
if (Test-Path $keyPath) {
    try {
        # Prendre ownership
        & takeown /F $keyPath
        # Donner droits complets
        & icacls $keyPath /grant Administrators:F /T
        # Supprimer
        Remove-Item $keyPath -Force -ErrorAction Stop
        Write-Host "Fichier de clé supprimé avec succès" -ForegroundColor Green
    } catch {
        Write-Host "Erreur lors de la suppression: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Le fichier de clé n'existe pas" -ForegroundColor Gray
}

Write-Host "Test de l'agent avec la nouvelle correction..." -ForegroundColor Cyan

# Attendre 2 secondes pour s'assurer que tout est propre
Start-Sleep -Seconds 2

# Démarrer l'agent en mode test
try {
    $process = Start-Process -FilePath "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe" -ArgumentList "run", "--no-tray" -PassThru -Wait
    
    if ($process.ExitCode -eq 0) {
        Write-Host "✅ SUCCÈS: L'agent a démarré sans erreur DPAPI!" -ForegroundColor Green
        Write-Host "La correction fonctionne correctement." -ForegroundColor Green
    } else {
        Write-Host "❌ ÉCHEC: L'agent a échoué avec le code $($process.ExitCode)" -ForegroundColor Red
        Write-Host "La correction nécessite des ajustements." -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERREUR: Exception lors du démarrage: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "=== TEST TERMINÉ ===" -ForegroundColor Green
