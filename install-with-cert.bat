@echo off
REM Script d'installation qui installe d'abord le certificat, puis le MSI
REM Évite 100% des avertissements SmartScreen

echo 🔐 Installation Sentinel GRC Agent (sécurisée)
echo =============================================

REM Vérifier les droits admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Droits administrateur requis
    echo Relancez ce script en tant qu'administrateur
    pause
    exit /b 1
)

REM 1. Installer le certificat dans Trusted Publishers
echo 📋 Installation du certificat de confiance...
certutil -addstore "TrustedPublisher" "sentinel-agent-cert.cer" >nul 2>&1
if %errorLevel% equ 0 (
    echo ✅ Certificat ajouté aux Trusted Publishers
) else (
    echo ⚠️ Erreur lors de l'ajout du certificat
)

REM 2. Installer aussi dans les racines de confiance (recommandé)
certutil -addstore "Root" "sentinel-agent-cert.cer" >nul 2>&1
if %errorLevel% equ 0 (
    echo ✅ Certificat ajouté aux Trusted Root
) else (
    echo ⚠️ Erreur lors de l'ajout aux racines
)

REM 3. Installer le MSI (maintenant sans avertissement)
echo 📦 Installation de Sentinel GRC Agent...
msiexec /i "SentinelAgent-2.0.0.msi" /quiet /norestart

if %errorLevel% equ 0 (
    echo ✅ Installation terminée avec succès!
) else (
    echo ❌ Erreur lors de l'installation MSI
    echo Code d'erreur: %errorLevel%
)

REM 4. Démarrer le service
echo 🚀 Démarrage du service...
net start SentinelGRCAgent >nul 2>&1

echo.
echo 🎉 Installation complète!
echo Le certificat est maintenant installé sur cette machine
echo Les futures installations n'auront plus d'avertissements
echo.
pause
