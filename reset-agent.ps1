# Script pour réinitialiser l'agent Sentinel
# Exécuter en tant qu'administrateur

Write-Host "Arrêt du service Sentinel..." -ForegroundColor Yellow
Stop-Service -Name "SentinelGRCAgent" -Force -ErrorAction SilentlyContinue

Write-Host "Suppression du fichier de clé DPAPI..." -ForegroundColor Yellow
Remove-Item "C:\ProgramData\Sentinel\key.dpapi" -Force -ErrorAction SilentlyContinue

Write-Host "Redémarrage du service Sentinel..." -ForegroundColor Yellow
Start-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue

Write-Host "Vérification du statut..." -ForegroundColor Green
Get-Service -Name "SentinelGRCAgent" | Select-Object Name, Status
