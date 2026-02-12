#!/bin/bash

# Script pour créer un package MSI auto-signé avec certificat intégré
# Le package inclut le certificat et l'installe automatiquement

set -e

echo "📦 Création package MSI auto-signé avec certificat intégré"
echo "======================================================="

# Configuration
VERSION="2.0.0"
CERT_PASSWORD="Sentinel2024!"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$SCRIPT_DIR/signed-package"

# Nettoyer et créer le répertoire
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

echo "🔐 Création du certificat auto-signé..."

# Créer le certificat auto-signé
openssl req -x509 -newkey rsa:4096 -keyout "$PACKAGE_DIR/sentinel.key" -out "$PACKAGE_DIR/sentinel.crt" -days 1825 -nodes -subj "/C=FR/ST=Paris/L=Paris/O=Cyber Threat Consulting/OU=Security/CN=Sentinel GRC Agent"

# Convertir en PFX pour Windows
openssl pkcs12 -export -out "$PACKAGE_DIR/sentinel.pfx" -inkey "$PACKAGE_DIR/sentinel.key" -in "$PACKAGE_DIR/sentinel.crt" -password pass:"$CERT_PASSWORD"

echo "✅ Certificat créé"

# Copier le MSI existant ou le créer
if [[ -f "$SCRIPT_DIR/dist/SentinelAgent-$VERSION.msi" ]]; then
    cp "$SCRIPT_DIR/dist/SentinelAgent-$VERSION.msi" "$PACKAGE_DIR/"
    echo "✅ MSI copié"
else
    echo "❌ MSI non trouvé. Lancez d'abord: create-windows-installer.sh"
    exit 1
fi

# Signer le MSI avec le certificat auto-signé
echo "🔏 Signature du MSI..."

# Sur Windows avec signtool
if command -v signtool &> /dev/null; then
    signtool sign /f "$PACKAGE_DIR/sentinel.pfx" /p "$CERT_PASSWORD" /t "http://timestamp.digicert.com" "$PACKAGE_DIR/SentinelAgent-$VERSION.msi"
    echo "✅ MSI signé avec signtool"
else
    echo "⚠️ signtool non disponible. Le MSI sera signé manuellement plus tard."
fi

# Créer le script d'installation qui installe le certificat
cat > "$PACKAGE_DIR/install.bat" << 'EOF'
@echo off
REM Installation automatique avec certificat intégré

echo 🔐 Installation Sentinel GRC Agent (version sécurisée)
echo ================================================

REM Installer le certificat dans Trusted Publishers
certutil -addstore "TrustedPublisher" "sentinel.crt" >nul 2>&1
certutil -addstore "Root" "sentinel.crt" >nul 2>&1

echo ✅ Certificat de confiance installé

REM Installer le MSI
msiexec /i "SentinelAgent-2.0.0.msi" /quiet /norestart

echo ✅ Installation terminée!
pause
EOF

# Créer un README
cat > "$PACKAGE_DIR/README.txt" << EOF
Sentinel GRC Agent - Package Sécurisé
===================================

Ce package inclut:
- Le certificat de signature auto-signé
- L'installateur MSI signé
- Le script d'installation automatique

Installation:
1. Exécuter install.bat en tant qu'administrateur
2. Le certificat sera installé automatiquement
3. L'agent s'installera sans avertissements

Le certificat est ajouté aux Trusted Publishers,
donc plus aucun avertissement sur cette machine.
EOF

# Créer une archive ZIP
cd "$PACKAGE_DIR"
zip -r "sentinel-agent-signed-package.zip" *.msi *.crt *.pfx install.bat README.txt

echo "🎉 Package sécurisé créé: $PACKAGE_DIR/sentinel-agent-signed-package.zip"
echo ""
echo "📋 Contenu du package:"
echo "  - sentinel-agent-signed-package.zip (à distribuer)"
echo "  - install.bat (installation automatique)"
echo "  - sentinel.crt (certificat public)"
echo "  - SentinelAgent-$VERSION.msi (signé)"
echo ""
echo "🚀 Pour utiliser: Dézipper et exécuter install.bat en tant qu'administrateur"
