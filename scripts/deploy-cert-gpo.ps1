#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Deploie le certificat Sentinel Agent dans les magasins de confiance Windows.

.DESCRIPTION
    Script pour administrateurs IT — deploie le certificat auto-signe Sentinel
    dans TrustedPublisher et Root, eliminant les avertissements SmartScreen
    sur toutes les machines ciblees.

    Modes de deploiement :
    - Execution locale (ce script)
    - GPO : Computer Configuration > Policies > Windows Settings >
            Security Settings > Public Key Policies > Trusted Publishers
    - Intune : Device Configuration > PKCS certificate profile
    - SCCM : Compliance Settings > Certificate Profiles

.PARAMETER CertPath
    Chemin vers le fichier .cer du certificat Sentinel.
    Par defaut : certs\sentinel-signing.cer dans le repertoire du script.

.PARAMETER SkipRoot
    Si specifie, n'installe pas le certificat dans Root (uniquement TrustedPublisher).

.EXAMPLE
    # Installation locale
    .\deploy-cert-gpo.ps1

    # Avec chemin personnalise
    .\deploy-cert-gpo.ps1 -CertPath "C:\certs\sentinel-signing.cer"

    # TrustedPublisher uniquement (sans Root)
    .\deploy-cert-gpo.ps1 -SkipRoot

.NOTES
    Fichier : scripts/deploy-cert-gpo.ps1
    Prerequis : droits administrateur local ou GPO/Intune
#>

param(
    [string]$CertPath = "$PSScriptRoot\..\certs\sentinel-signing.cer",
    [switch]$SkipRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -------------------------------------------------------------------
# 1. Verifier le certificat
# -------------------------------------------------------------------
if (-not (Test-Path $CertPath)) {
    Write-Error "Certificat introuvable : $CertPath`nTelechargez sentinel-signing.cer depuis le repository ou le package d'installation."
    exit 1
}

$CertPath = (Resolve-Path $CertPath).Path
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CertPath)

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Sentinel Agent - Certificate Deployer" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Sujet      : $($cert.Subject)" -ForegroundColor White
Write-Host "  Thumbprint : $($cert.Thumbprint)" -ForegroundColor White
Write-Host "  Expiration : $($cert.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor White
Write-Host ""

# -------------------------------------------------------------------
# 2. Installer dans TrustedPublisher
# -------------------------------------------------------------------
Write-Host "Installation dans TrustedPublisher..." -ForegroundColor Yellow

$storeTp = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "LocalMachine")
$storeTp.Open("ReadWrite")
$storeTp.Add($cert)
$storeTp.Close()

Write-Host "  TrustedPublisher : OK" -ForegroundColor Green

# -------------------------------------------------------------------
# 3. Installer dans Root (optionnel)
# -------------------------------------------------------------------
if (-not $SkipRoot) {
    Write-Host "Installation dans Root..." -ForegroundColor Yellow

    $storeRoot = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
    $storeRoot.Open("ReadWrite")
    $storeRoot.Add($cert)
    $storeRoot.Close()

    Write-Host "  Root : OK" -ForegroundColor Green
} else {
    Write-Host "  Root : ignore (-SkipRoot)" -ForegroundColor DarkGray
}

# -------------------------------------------------------------------
# 4. Verification
# -------------------------------------------------------------------
Write-Host ""
Write-Host "Verification..." -ForegroundColor Yellow

$verifyTp = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "LocalMachine")
$verifyTp.Open("ReadOnly")
$found = $verifyTp.Certificates | Where-Object { $_.Thumbprint -eq $cert.Thumbprint }
$verifyTp.Close()

if ($found) {
    Write-Host "  Certificat present dans TrustedPublisher" -ForegroundColor Green
} else {
    Write-Host "  ATTENTION : certificat non trouve dans TrustedPublisher" -ForegroundColor Red
}

# -------------------------------------------------------------------
# 5. Instructions deploiement enterprise
# -------------------------------------------------------------------
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Deploiement Enterprise" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "GPO (Active Directory) :" -ForegroundColor Yellow
Write-Host "  1. Ouvrir Group Policy Management (gpmc.msc)" -ForegroundColor White
Write-Host "  2. Computer Configuration > Policies > Windows Settings" -ForegroundColor White
Write-Host "     > Security Settings > Public Key Policies" -ForegroundColor White
Write-Host "  3. Clic droit sur 'Trusted Publishers' > Import" -ForegroundColor White
Write-Host "  4. Selectionnez : $CertPath" -ForegroundColor White
Write-Host "  5. Repeter pour 'Trusted Root Certification Authorities' si necessaire" -ForegroundColor White
Write-Host ""
Write-Host "Intune (Microsoft Endpoint Manager) :" -ForegroundColor Yellow
Write-Host "  1. Devices > Configuration profiles > Create profile" -ForegroundColor White
Write-Host "  2. Platform: Windows 10 and later" -ForegroundColor White
Write-Host "  3. Profile type: Trusted certificate" -ForegroundColor White
Write-Host "  4. Destination store: Computer certificate store - Trusted Publishers" -ForegroundColor White
Write-Host "  5. Uploadez : $CertPath" -ForegroundColor White
Write-Host ""
Write-Host "SCCM (Configuration Manager) :" -ForegroundColor Yellow
Write-Host "  1. Assets and Compliance > Compliance Settings > Certificate Profiles" -ForegroundColor White
Write-Host "  2. Create Certificate Profile > Trusted CA certificate" -ForegroundColor White
Write-Host "  3. Destination store: Trusted Publishers" -ForegroundColor White
Write-Host "  4. Importez : $CertPath" -ForegroundColor White
Write-Host ""
Write-Host "Deploiement via script (psexec, PDQ Deploy, etc.) :" -ForegroundColor Yellow
Write-Host "  certutil -addstore `"TrustedPublisher`" `"$CertPath`"" -ForegroundColor White
Write-Host "  certutil -addstore `"Root`" `"$CertPath`"" -ForegroundColor White
Write-Host ""
Write-Host "Resultat : zero avertissement SmartScreen sur toutes les machines du domaine." -ForegroundColor Green
Write-Host ""
