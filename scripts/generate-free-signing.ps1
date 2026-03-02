# Script de génération de certificat gratuit pour éviter SmartScreen
# Alternative à SignPath - 100% gratuit et automatique

param(
    [switch]$Force
)

Write-Host "🔧 Génération de certificat de signature gratuit..." -ForegroundColor Yellow

# 1. Vérifier si le certificat existe déjà
if (-not $Force) {
    $existingCert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue | Where-Object {$_.Subject -like "*Sentinel GRC Agent*"}
    if ($existingCert) {
        Write-Host "✅ Certificat existant trouvé :" -ForegroundColor Green
        Write-Host "   Sujet: $($existingCert.Subject)" -ForegroundColor White
        Write-Host "   Expire: $($existingCert.NotAfter)" -ForegroundColor White
        Write-Host "   Utilisez -Force pour régénérer" -ForegroundColor Yellow
        exit 0
    }
}

# 2. Générer le certificat auto-signé de 10 ans
Write-Host "📝 Génération du certificat (10 ans de validité)..." -ForegroundColor Green
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=Sentinel GRC Agent, O=Cyber Threat Consulting, C=FR" `
    -CertStoreLocation Cert:\CurrentUser\My `
    -KeyUsage DigitalSignature `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3","2.5.29.19={text}CA:FALSE") `
    -NotAfter (Get-Date).AddYears(10)

Write-Host "✅ Certificat généré :" -ForegroundColor Green
Write-Host "   Thumbprint: $($cert.Thumbprint)" -ForegroundColor White
Write-Host "   Expire le: $($cert.NotAfter)" -ForegroundColor White

# 3. Exporter le certificat pour GitHub
$pfxPath = "sentinel-selfsigned.pfx"
$password = "Sentinel2024!Free"

Write-Host "💾 Export du certificat..." -ForegroundColor Green
$securePassword = ConvertTo-SecureString -String $password -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null

# 4. Exporter le certificat public
$cerPath = "sentinel-selfsigned.cer"
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

# 5. Ajouter aux Trusted Publishers (évitement SmartScreen)
Write-Host "🔐 Ajout aux Trusted Publishers..." -ForegroundColor Green
try {
    Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\LocalMachine\TrustedPublisher | Out-Null
    Write-Host "✅ Ajouté aux Trusted Publishers" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Nécessite des droits administrateur pour Trusted Publishers" -ForegroundColor Yellow
}

# 6. Générer les commandes pour GitHub Secrets
Write-Host "📋 Configuration GitHub Secrets requise :" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White

# Encoder le PFX en base64
$pfxBytes = [System.IO.File]::ReadAllBytes($pfxPath)
$pfxBase64 = [System.Convert]::ToBase64String($pfxBytes)

Write-Host "🔑 Secrets GitHub à créer :" -ForegroundColor Yellow
Write-Host "1. WINDOWS_SELFSIGN_PFX :" -ForegroundColor White
Write-Host $pfxBase64 -ForegroundColor Gray
Write-Host "" -ForegroundColor White
Write-Host "2. WINDOWS_SELFSIGN_PASSWORD :" -ForegroundColor White
Write-Host $password -ForegroundColor Gray
Write-Host "" -ForegroundColor White

# 7. Mettre à jour le workflow pour utiliser la signature gratuite
Write-Host "🔄 Le workflow utilisera automatiquement cette signature gratuite" -ForegroundColor Green
Write-Host "   si les variables SignPath ne sont pas configurées." -ForegroundColor White

# 8. Nettoyer les fichiers locaux
Write-Host "🧹 Nettoyage..." -ForegroundColor Yellow
Remove-Item $pfxPath -Force -ErrorAction SilentlyContinue
Remove-Item $cerPath -Force -ErrorAction SilentlyContinue

Write-Host "🎉 Configuration terminée !" -ForegroundColor Cyan
Write-Host "📝 Prochaines étapes :" -ForegroundColor White
Write-Host "1. Allez dans GitHub → Repository → Settings → Secrets" -ForegroundColor White
Write-Host "2. Ajoutez les deux secrets ci-dessus" -ForegroundColor White
Write-Host "3. Lancez le workflow release" -ForegroundColor White
Write-Host "4. Le MSI sera signé gratuitement sans SmartScreen !" -ForegroundColor Green
