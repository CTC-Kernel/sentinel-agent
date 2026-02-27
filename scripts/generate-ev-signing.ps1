# Script pour générer la configuration de signature EV
# Utilisation: .\generate-ev-signing.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$CertPath = "",
    
    [Parameter(Mandatory=$false)]
    [SecureString]$CertPassword = $null,
    
    [Parameter(Mandatory=$false)]
    [switch]$ShowInstructions
)

if ($ShowInstructions) {
    Write-Host "🔐 Configuration Signature EV - Instructions" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Acheter un certificat EV Code Signing:" -ForegroundColor Yellow
    Write-Host "   - DigiCert: https://www.digicert.com/code-signing" -ForegroundColor White
    Write-Host "   - Sectigo: https://www.sectigo.com/code-signing-certificates" -ForegroundColor White
    Write-Host "   - GlobalSign: https://www.globalsign.com/en/code-signing-certificate" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Exporter le certificat au format .pfx:" -ForegroundColor Yellow
    Write-Host "   - Inclure la clé privée" -ForegroundColor White
    Write-Host "   - Mot de passe robuste requis" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Exécuter ce script avec le certificat:" -ForegroundColor Yellow
    Write-Host "   .\generate-ev-signing.ps1 -CertPath 'C:\path\to\cert.pfx' -CertPassword 'password'" -ForegroundColor White
    Write-Host ""
    exit 0
}

if ([string]::IsNullOrEmpty($CertPath)) {
    Write-Host "❌ Chemin du certificat requis" -ForegroundColor Red
    Write-Host "Utilisez -ShowInstructions pour voir les étapes" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $CertPath)) {
    Write-Host "❌ Fichier certificat introuvable: $CertPath" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($CertPassword)) {
    $CertPassword = Read-Host "Entrez le mot de passe du certificat" -AsSecureString
}

# Convertir SecureString en texte pour l'utilisation
$certPasswordText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($CertPassword))

Write-Host "🔐 Traitement du certificat EV..." -ForegroundColor Cyan

try {
    # Lire le certificat
    $certBytes = [System.IO.File]::ReadAllBytes($CertPath)
    $certBase64 = [System.Convert]::ToBase64String($certBytes)
    
    # Extraire les informations du certificat
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CertPath, $CertPassword)
    
    Write-Host "✅ Certificat chargé avec succès" -ForegroundColor Green
    Write-Host "   Sujet: $($cert.Subject)" -ForegroundColor White
    Write-Host "   Émetteur: $($cert.Issuer)" -ForegroundColor White
    Write-Host "   Valide jusqu'à: $($cert.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor White
    Write-Host "   Thumbprint: $($cert.Thumbprint)" -ForegroundColor White
    
    # Vérifier si c'est un certificat EV
    $isEV = $cert.Extensions | Where-Object { $_.Oid.Value -eq "2.5.29.37" }
    if ($isEV) {
        Write-Host "   ✅ Certificat EV détecté" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Certificat standard (pas EV)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "📋 Configuration GitHub Secrets:" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    
    Write-Host "WINDOWS_CERT_P12:" -ForegroundColor Yellow
    Write-Host $certBase64 -ForegroundColor White
    Write-Host ""
    
    Write-Host "WINDOWS_CERT_PASSWORD:" -ForegroundColor Yellow
    Write-Host $certPasswordText -ForegroundColor White
    Write-Host ""
    
    # Générer le script de test
    $testScript = @"
# Test de signature avec le certificat EV
`$certPath = "$CertPath"
`$certPassword = "$CertPassword"
`$testFile = "test-sentinel-agent.exe"

# Créer un fichier test
echo "Test file for Sentinel Agent" > `$testFile

# Signer le fichier
        signtool sign /f `"`$certPath`" /p `"`$certPasswordText`" /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 /d "Sentinel GRC Agent Test" `$testFile

# Vérifier la signature
signtool verify /pa `$testFile

Write-Host "✅ Test de signature complété" -ForegroundColor Green
Write-Host "Vérifiez les propriétés de `$testFile pour voir la signature" -ForegroundColor Yellow
"@
    
    $testScript | Out-File -FilePath "test-ev-signing.ps1" -Encoding UTF8
    Write-Host "📝 Script de test généré: test-ev-signing.ps1" -ForegroundColor Green
    
    # Instructions pour GitHub
    Write-Host ""
    Write-Host "🚀 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    Write-Host "1. Copier WINDOWS_CERT_P64 dans GitHub Secrets" -ForegroundColor White
    Write-Host "2. Copier WINDOWS_CERT_PASSWORD dans GitHub Secrets" -ForegroundColor White
    Write-Host "3. Lancer le workflow de release" -ForegroundColor White
    Write-Host "4. Tester le MSI généré" -ForegroundColor White
    Write-Host ""
    
    # Test immédiat optionnel
    $testNow = Read-Host "Voulez-vous tester la signature maintenant? (y/N)"
    if ($testNow -eq 'y' -or $testNow -eq 'Y') {
        Write-Host "🧪 Test de signature en cours..." -ForegroundColor Yellow
        
        # Créer un fichier test
        $testFile = "test-sentinel-agent.exe"
        "Test executable for Sentinel Agent" | Out-File -FilePath $testFile -Encoding ASCII
        
        # Signer avec signtool
        $signtoolPath = Get-Command signtool -ErrorAction SilentlyContinue
        if ($signtoolPath) {
            & signtool sign /f $CertPath /p $certPasswordText /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 /d "Sentinel GRC Agent Test" $testFile
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Signature réussie!" -ForegroundColor Green
                Write-Host "Vérifiez les propriétés de $testFile" -ForegroundColor White
                
                # Vérifier la signature
                & signtool verify /pa $testFile
            } else {
                Write-Host "❌ Échec de la signature" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ signtool non trouvé. Installez Windows SDK." -ForegroundColor Red
        }
        
        # Nettoyer
        if (Test-Path $testFile) {
            Remove-Item $testFile -Force
        }
    }
    
} catch {
    Write-Host "❌ Erreur lors du traitement du certificat: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎯 Configuration terminée!" -ForegroundColor Green
Write-Host "Le certificat EV évitera les avertissements SmartScreen." -ForegroundColor White
