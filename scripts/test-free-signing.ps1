# Script test pour la signature gratuite
# Fichier simple sans caractères spéciaux

param(
    [Parameter(Mandatory=$false)]
    [switch]$ShowInstructions
)

if ($ShowInstructions) {
    Write-Host "Signature Gratuite - Instructions" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Cette solution GRATUITE evite SmartScreen:" -ForegroundColor Yellow
    Write-Host "1. Certificat auto-signe persistant (10 ans)" -ForegroundColor White
    Write-Host "2. Ajout aux Trusted Publishers" -ForegroundColor White
    Write-Host "3. Persistant via GitHub Secrets" -ForegroundColor White
    Write-Host "4. Installation automatisee" -ForegroundColor White
    Write-Host ""
    Write-Host "Avantages:" -ForegroundColor Green
    Write-Host "100% GRATUIT (vs 600$/an pour EV)" -ForegroundColor White
    Write-Host "SmartScreen EVITE" -ForegroundColor White
    Write-Host "Installation silencieuse" -ForegroundColor White
    Write-Host ""
    Write-Host "Utilisation:" -ForegroundColor Yellow
    Write-Host ".\generate-free-signing.ps1" -ForegroundColor White
    exit 0
}

Write-Host "Test signature gratuite" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

try {
    $certName = "Cyber Threat Consulting"
    $certValidity = (Get-Date).AddYears(10)
    $password = "Sentinel2024!Free"
    
    Write-Host "Generation certificat auto-signe..." -ForegroundColor Yellow
    
    $cert = New-SelfSignedCertificate `
        -DnsName $certName `
        -CertStoreLocation "Cert:\LocalMachine\My" `
        -KeyExportPolicy Exportable `
        -KeySpec Signature `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -NotAfter $certValidity `
        -FriendlyName "Sentinel GRC Agent"
    
    Write-Host "Certificat cree avec succes" -ForegroundColor Green
    Write-Host "Sujet: $($cert.Subject)" -ForegroundColor White
    Write-Host "Thumbprint: $($cert.Thumbprint)" -ForegroundColor White
    Write-Host "Valide jusqu'a: $($cert.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor White
    
    $pfxPath = "$env:TEMP\sentinel-free-test.pfx"
    $cerPath = "$env:TEMP\sentinel-free-test.cer"
    
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password (ConvertTo-SecureString -String $password -Force -AsPlainText)
    Export-Certificate -Cert $cert -FilePath $cerPath
    
    Write-Host "Fichiers exportes:" -ForegroundColor Yellow
    Write-Host "PFX: $pfxPath" -ForegroundColor White
    Write-Host "CER: $cerPath" -ForegroundColor White
    
    $pfxBytes = [System.IO.File]::ReadAllBytes($pfxPath)
    $pfxBase64 = [System.Convert]::ToBase64String($pfxBytes)
    
    Write-Host ""
    Write-Host "Configuration GitHub Secrets GRATUITE:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "WINDOWS_SELFSIGN_PFX:" -ForegroundColor Green
    Write-Host $pfxBase64 -ForegroundColor White
    Write-Host ""
    
    Write-Host "WINDOWS_SELFSIGN_PASSWORD:" -ForegroundColor Green
    Write-Host $password -ForegroundColor White
    
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configuration GRATUITE terminee!" -ForegroundColor Green
Write-Host "SmartScreen sera evite sans aucun cout!" -ForegroundColor White
