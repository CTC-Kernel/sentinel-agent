@echo off
REM Script pour signer le MSI avec certificat auto-signé gratuit
REM Ce script ajoute le certificat aux Trusted Publishers locaux

echo 🔧 Création certificat auto-signé pour Sentinel GRC Agent...
echo ========================================================

REM 1. Créer le certificat auto-signé
powershell -Command "
New-SelfSignedCertificate -Type CodeSigningCert -DnsName 'Cyber Threat Consulting' -CertStoreLocation 'cert:\LocalMachine\My' -KeyUsage 'DigitalSignature' -KeyExportPolicy 'Exportable' -NotAfter (Get-Date).AddYears(5) -FriendlyName 'Sentinel GRC Agent'
"

echo ✅ Certificat créé dans LocalMachine\My

REM 2. Exporter le certificat .pfx pour la signature
powershell -Command "
$cert = Get-ChildItem -Path 'cert:\LocalMachine\My' | Where-Object { $_.FriendlyName -eq 'Sentinel GRC Agent' }
Export-PfxCertificate -Cert $cert -FilePath 'sentinel-agent-cert.pfx' -Password (ConvertTo-SecureString -String 'Sentinel2024!' -Force -AsPlainText)
"

echo ✅ Certificat exporté vers sentinel-agent-cert.pfx

REM 3. Exporter le certificat public .cer pour Trusted Publishers
powershell -Command "
$cert = Get-ChildItem -Path 'cert:\LocalMachine\My' | Where-Object { $_.FriendlyName -eq 'Sentinel GRC Agent' }
Export-Certificate -Cert $cert -FilePath 'sentinel-agent-cert.cer'
"

echo ✅ Certificat public exporté vers sentinel-agent-cert.cer

REM 4. Importer dans les Trusted Publishers (évite SmartScreen)
powershell -Command "
Import-Certificate -FilePath 'sentinel-agent-cert.cer' -CertStoreLocation 'cert:\LocalMachine\TrustedPublisher'
"

echo ✅ Certificat ajouté aux Trusted Publishers

REM 5. Importer dans les racines de confiance (optionnel, pour plus de confiance)
powershell -Command "
Import-Certificate -FilePath 'sentinel-agent-cert.cer' -CertStoreLocation 'cert:\LocalMachine\Root'
"

echo ✅ Certificat ajouté aux Trusted Root Certification Authorities

echo.
echo 🎯 Certificat auto-signé créé et installé!
echo 🔑 Mot de passe du certificat: Sentinel2024!
echo 📁 Fichiers créés:
echo    - sentinel-agent-cert.pfx (pour signature)
echo    - sentinel-agent-cert.cer (pour distribution)
echo.
echo 💡 Pour signer le MSI:
echo    set WINDOWS_CERT_PATH=%CD%\sentinel-agent-cert.pfx
echo    set WINDOWS_CERT_PASSWORD=Sentinel2024!
echo    create-windows-installer.sh
echo.
pause
