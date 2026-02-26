# Script de test pour valider la correction du bug DPAPI
# Exécuter en tant qu'administrateur

Write-Host "Test de validation de la correction DPAPI..." -ForegroundColor Green

# Arrêter le service s'il tourne
try {
    Stop-Service -Name "SentinelGRCAgent" -Force -ErrorAction Stop
    Write-Host "Service arrêté" -ForegroundColor Yellow
} catch {
    Write-Host "Le service n'était pas en cours d'exécution" -ForegroundColor Gray
}

# Supprimer la clé corrompue avec les droits admin
try {
    TakeOwnership /F "C:\ProgramData\Sentinel\key.dpapi"
    icacls "C:\ProgramData\Sentinel\key.dpapi" /grant Administrators:F
    Remove-Item "C:\ProgramData\Sentinel\key.dpapi" -Force
    Write-Host "Clé DPAPI supprimée" -ForegroundColor Yellow
} catch {
    Write-Host "Erreur lors de la suppression de la clé: $($_.Exception.Message)" -ForegroundColor Red
}

# Démarrer l'agent en mode test
Write-Host "Démarrage de l'agent en mode test..." -ForegroundColor Cyan
Start-Process -FilePath "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe" -ArgumentList "run", "--no-tray" -Wait

Write-Host "Test terminé. Vérifiez si l'agent a démarré sans erreur DPAPI." -ForegroundColor Green
