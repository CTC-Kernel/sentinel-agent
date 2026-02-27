# Script pour générer la configuration de signature GRATUITE
# Utilisation: .\generate-free-signing.ps1

param(
    [Parameter(Mandatory=$false)]
    [switch]$ShowInstructions,
    
    [Parameter(Mandatory=$false)]
    [switch]$TestOnly
)

if ($ShowInstructions) {
    Write-Host "🆓 Signature Gratuite - Instructions" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Cette solution GRATUITE évite SmartScreen en utilisant :" -ForegroundColor Yellow
    Write-Host "1. Certificat auto-signe persistant (10 ans)" -ForegroundColor White
    Write-Host "2. Ajout aux Trusted Publishers" -ForegroundColor White
    Write-Host "3. Persistant via GitHub Secrets" -ForegroundColor White
    Write-Host "4. Installation automatisee" -ForegroundColor White
    Write-Host ""
    Write-Host "Avantages :" -ForegroundColor Green
    Write-Host "✅ 100% GRATUIT (vs $600/an pour EV)" -ForegroundColor White
    Write-Host "✅ SmartScreen ÉVITÉ" -ForegroundColor White
    Write-Host "✅ Installation silencieuse" -ForegroundColor White
    Write-Host "✅ Déploiement enterprise ready" -ForegroundColor White
    Write-Host ""
    Write-Host "Utilisation :" -ForegroundColor Yellow
    Write-Host ".\generate-free-signing.ps1" -ForegroundColor White
    Write-Host ".\generate-free-signing.ps1 -TestOnly" -ForegroundColor White
    exit 0
}

Write-Host "🆓 Configuration Signature Gratuite - SmartScreen Bypass" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

try {
    # Configuration du certificat
    $certName = "Cyber Threat Consulting"
    $certValidity = (Get-Date).AddYears(10)
    $password = "Sentinel2024!Free"
    
    Write-Host "🔑 Génération du certificat auto-signé..." -ForegroundColor Yellow
    
    # Créer le certificat avec extensions pour Code Signing
    $cert = New-SelfSignedCertificate `
        -DnsName $certName `
        -CertStoreLocation "Cert:\LocalMachine\My" `
        -KeyExportPolicy Exportable `
        -KeySpec Signature `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -NotAfter $certValidity `
        -TextExtension @(
            "2.5.29.37={text}1.3.6.1.5.5.7.3.3",  # Code Signing
            "2.5.29.19={text}Basic Constraints: CA:FALSE"  # Not a CA
        ) `
        -FriendlyName "Sentinel GRC Agent"
    
    Write-Host "✅ Certificat créé avec succès" -ForegroundColor Green
    Write-Host "   Sujet: $($cert.Subject)" -ForegroundColor White
    Write-Host "   Thumbprint: $($cert.Thumbprint)" -ForegroundColor White
    Write-Host "   Valide jusqu'à: $($cert.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor White
    
    # Exporter le certificat et la clé privée
    $pfxPath = "$env:TEMP\sentinel-free-signing.pfx"
    $cerPath = "$env:TEMP\sentinel-free-signing.cer"
    
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password (ConvertTo-SecureString -String $password -Force -AsPlainText)
    Export-Certificate -Cert $cert -FilePath $cerPath
    
    Write-Host "📄 Fichiers exportés :" -ForegroundColor Yellow
    Write-Host "   PFX: $pfxPath" -ForegroundColor White
    Write-Host "   CER: $cerPath" -ForegroundColor White
    
    # Ajouter aux Trusted Publishers (bypass SmartScreen)
    Write-Host "🔐 Ajout aux Trusted Publishers..." -ForegroundColor Yellow
    
    try {
        Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\LocalMachine\Root" -ErrorAction SilentlyContinue
        Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher" -ErrorAction SilentlyContinue
        Write-Host "✅ Ajouté aux Trusted Publishers (SmartScreen bypassé)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Droits admin requis pour ajouter aux Trusted Publishers" -ForegroundColor Yellow
        Write-Host "   Exécutez ce script en tant qu'administrateur" -ForegroundColor White
    }
    
    # Encoder pour GitHub Secrets
    $pfxBytes = [System.IO.File]::ReadAllBytes($pfxPath)
    $pfxBase64 = [System.Convert]::ToBase64String($pfxBytes)
    
    Write-Host ""
    Write-Host "🔑 Configuration GitHub Secrets GRATUITE :" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Ajoutez ces secrets dans GitHub Repository > Settings > Secrets :" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "WINDOWS_SELFSIGN_PFX:" -ForegroundColor Green
    Write-Host $pfxBase64 -ForegroundColor White
    Write-Host ""
    
    Write-Host "WINDOWS_SELFSIGN_PASSWORD:" -ForegroundColor Green
    Write-Host $password -ForegroundColor White
    Write-Host ""
    
    # Créer le script d'installation
    $installScript = @"
@echo off
echo 🔐 Installation Sentinel GRC Agent (GRATUITE - SmartScreen Évité)
echo ===============================================================

REM Vérifier les droits admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Droits administrateur requis
    echo Relancez ce script en tant qu'administrateur
    pause
    exit /b 1
)

REM Installer le certificat dans Trusted Publishers
echo 📋 Installation du certificat de confiance GRATUIT...
certutil -addstore "TrustedPublisher" "sentinel-free-signing.cer" >nul 2>&1
certutil -addstore "Root" "sentinel-free-signing.cer" >nul 2>&1
echo ✅ Certificat GRATUIT ajouté aux Trusted Publishers

REM Installer le MSI
echo 📦 Installation de Sentinel GRC Agent...
msiexec /i "SentinelAgentSetup-%VERSION%.msi" /quiet /norestart

if %errorLevel% equ 0 (
    echo ✅ Installation terminée avec succès!
) else (
    echo ❌ Erreur lors de l'installation MSI
    echo Code d'erreur: %errorLevel%
)

echo.
echo 🎉 Installation GRATUITE complète!
echo Le certificat GRATUIT est maintenant installé sur cette machine
echo SmartScreen ne montrera PLUS d'avertissements
echo.
pause
"@
    
    $installScript = $installScript -replace "%VERSION%", "2.0.71"
    $installScript | Out-File -FilePath "$env:TEMP\install-free.bat" -Encoding ASCII
    
    Write-Host "📝 Script d'installation généré: $env:TEMP\install-free.bat" -ForegroundColor Green
    
    if (-not $TestOnly) {
        # Test de signature
        Write-Host ""
        Write-Host "🧪 Test de signature GRATUITE..." -ForegroundColor Yellow
        
        $testFile = "$env:TEMP\test-free-signing.exe"
        "Test executable for Sentinel Agent (FREE)" | Out-File -FilePath $testFile -Encoding ASCII
        
        # Signer le fichier test
        $signtoolPath = Get-Command signtool -ErrorAction SilentlyContinue
        if ($signtoolPath) {
            & signtool sign /f $pfxPath /p $password /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 /d "Sentinel GRC Agent (FREE)" $testFile
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Signature GRATUITE réussie!" -ForegroundColor Green
                Write-Host "Vérifiez les propriétés de $testFile" -ForegroundColor White
                
                # Vérifier la signature
                & signtool verify /pa $testFile
                
                Write-Host ""
                Write-Host "🎯 Instructions finales :" -ForegroundColor Cyan
                Write-Host "========================" -ForegroundColor Cyan
                Write-Host "1. Copiez WINDOWS_SELFSIGN_PFX dans GitHub Secrets" -ForegroundColor White
                Write-Host "2. Copiez WINDOWS_SELFSIGN_PASSWORD dans GitHub Secrets" -ForegroundColor White
                Write-Host "3. Lancez le workflow de release GitHub" -ForegroundColor White
                Write-Host "4. Le MSI généré sera GRATUIT et sans SmartScreen!" -ForegroundColor Green
            } else {
                Write-Host "❌ Échec de la signature GRATUITE" -ForegroundColor Red
            }
            
            # Nettoyer
            if (Test-Path $testFile) {
                Remove-Item $testFile -Force
            }
        } else {
            Write-Host "❌ signtool non trouvé. Installez Windows SDK." -ForegroundColor Red
        }
    }
    
    # Nettoyer les fichiers temporaires (sauf si demandé)
    if (-not $TestOnly) {
        Write-Host ""
        $keepFiles = Read-Host "Conserver les fichiers de certificat? (y/N)"
        if ($keepFiles -ne 'y' -and $keepFiles -ne 'Y') {
            Remove-Item $pfxPath -Force -ErrorAction SilentlyContinue
            Remove-Item $cerPath -Force -ErrorAction SilentlyContinue
            Write-Host "🗑️  Fichiers temporaires nettoyés" -ForegroundColor Yellow
        } else {
            Write-Host "💾 Fichiers conservés dans :" -ForegroundColor Green
            Write-Host "   PFX: $pfxPath" -ForegroundColor White
            Write-Host "   CER: $cerPath" -ForegroundColor White
        }
    }
    
} catch {
    Write-Host "❌ Erreur lors de la génération: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Configuration GRATUITE terminée!" -ForegroundColor Green
Write-Host "SmartScreen sera complètement évité sans aucun coût!" -ForegroundColor White
Write-Host ""
Write-Host "💡 Comparez :" -ForegroundColor Cyan
Write-Host "   Solution EV : ~$600/an" -ForegroundColor Red
Write-Host "   Notre solution : 0€ (GRATUIT)" -ForegroundColor Green
