#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Genere un certificat code signing auto-signe persistant pour Sentinel Agent.

.DESCRIPTION
    Ce script est a executer UNE SEULE FOIS sur une machine Windows.
    Il genere un certificat code signing valide 5 ans, exporte le PFX et le CER,
    puis affiche les instructions pour configurer les GitHub Secrets.

    Le certificat est reutilise a chaque build CI, garantissant un thumbprint stable.
    Les utilisateurs n'ont plus a refaire confiance a chaque mise a jour.

.NOTES
    Prerequis : Windows 10+ / Server 2016+, PowerShell 5.1+, droits administrateur.
    Fichier : scripts/generate-selfsign-cert.ps1
#>

param(
    [string]$Subject = "CN=Cyber Threat Consulting, O=Cyber Threat Consulting, L=Paris, C=FR",
    [string]$FriendlyName = "Sentinel GRC Agent Code Signing",
    [int]$ValidityYears = 5,
    [string]$OutputDir = "$PSScriptRoot\..\certs"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -------------------------------------------------------------------
# 1. Creer le repertoire de sortie
# -------------------------------------------------------------------
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}
$OutputDir = (Resolve-Path $OutputDir).Path

$pfxPath = Join-Path $OutputDir "sentinel-signing.pfx"
$cerPath = Join-Path $OutputDir "sentinel-signing.cer"

# -------------------------------------------------------------------
# 2. Demander le mot de passe interactivement
# -------------------------------------------------------------------
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Sentinel Agent - Certificate Generator" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$securePassword = Read-Host -AsSecureString -Prompt "Entrez un mot de passe pour le PFX (sera utilise dans WINDOWS_SELFSIGN_PASSWORD)"

# Valider que le mot de passe n'est pas vide
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($plainPassword)) {
    Write-Error "Le mot de passe ne peut pas etre vide."
    exit 1
}

# -------------------------------------------------------------------
# 3. Generer le certificat
# -------------------------------------------------------------------
Write-Host ""
Write-Host "Generation du certificat code signing..." -ForegroundColor Yellow

$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $Subject `
    -FriendlyName $FriendlyName `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -KeyExportPolicy Exportable `
    -KeySpec Signature `
    -KeyLength 2048 `
    -KeyAlgorithm RSA `
    -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears($ValidityYears) `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")

Write-Host "  Thumbprint : $($cert.Thumbprint)" -ForegroundColor Green
Write-Host "  Expiration : $($cert.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor Green

# -------------------------------------------------------------------
# 4. Exporter PFX et CER
# -------------------------------------------------------------------
Write-Host ""
Write-Host "Export des fichiers..." -ForegroundColor Yellow

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
Write-Host "  PFX : $pfxPath" -ForegroundColor Green

Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
Write-Host "  CER : $cerPath" -ForegroundColor Green

# -------------------------------------------------------------------
# 5. Encoder le PFX en base64
# -------------------------------------------------------------------
$pfxBytes = [System.IO.File]::ReadAllBytes($pfxPath)
$pfxBase64 = [System.Convert]::ToBase64String($pfxBytes)

# -------------------------------------------------------------------
# 6. Afficher les instructions GitHub Secrets
# -------------------------------------------------------------------
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Configuration GitHub Secrets" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Allez dans : Settings > Secrets and variables > Actions" -ForegroundColor White
Write-Host ""
Write-Host "1. WINDOWS_SELFSIGN_PFX" -ForegroundColor Yellow
Write-Host "   Copiez la valeur base64 ci-dessous :" -ForegroundColor White
Write-Host ""
Write-Host $pfxBase64 -ForegroundColor DarkGray
Write-Host ""
Write-Host "2. WINDOWS_SELFSIGN_PASSWORD" -ForegroundColor Yellow
Write-Host "   Entrez le mot de passe que vous venez de saisir." -ForegroundColor White
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Fichiers a committer" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  git add certs/sentinel-signing.cer" -ForegroundColor White
Write-Host "  (Le .pfx ne doit JAMAIS etre committe)" -ForegroundColor Red
Write-Host ""
Write-Host "Le fichier .cer sera inclus dans le MSI par WiX pour" -ForegroundColor White
Write-Host "installer automatiquement le certificat dans TrustedPublisher." -ForegroundColor White
Write-Host ""

# -------------------------------------------------------------------
# 7. Copier le base64 dans le presse-papier si possible
# -------------------------------------------------------------------
try {
    $pfxBase64 | Set-Clipboard
    Write-Host "  (Base64 du PFX copie dans le presse-papier)" -ForegroundColor Green
} catch {
    # Set-Clipboard peut ne pas etre disponible sur Server Core
}

# -------------------------------------------------------------------
# 8. Nettoyer le PFX local (securite)
# -------------------------------------------------------------------
Write-Host ""
$cleanup = Read-Host "Supprimer le fichier PFX local ? (Le base64 est dans le presse-papier) [o/N]"
if ($cleanup -eq "o" -or $cleanup -eq "O") {
    Remove-Item $pfxPath -Force
    Write-Host "  PFX supprime." -ForegroundColor Yellow
} else {
    Write-Host "  PFX conserve a : $pfxPath" -ForegroundColor Yellow
    Write-Host "  ATTENTION : ne committez JAMAIS ce fichier !" -ForegroundColor Red
}

Write-Host ""
Write-Host "Termine." -ForegroundColor Green
