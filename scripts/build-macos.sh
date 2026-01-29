#!/bin/bash
# Build script for macOS - Creates .app bundle and DMG
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/target/release"
APP_NAME="Sentinel Agent"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
VERSION="${VERSION:-1.0.0}"  # Use VERSION env var or default to 1.0.0

echo "=== Building Sentinel Agent for macOS ==="
echo "Project dir: $PROJECT_DIR"

# Build the release binary (skip if already exists - e.g., universal binary from CI)
echo ""
echo "1. Building release binary..."
cd "$PROJECT_DIR"
if [ ! -f "$BUILD_DIR/agent-core" ]; then
    cargo build --release --package agent-core --features gui
else
    echo "Binary already exists, skipping build (using pre-built binary)"
fi

# Generate icons if not present
if [ ! -f "$PROJECT_DIR/assets/icons/sentinel-agent.icns" ]; then
    echo ""
    echo "2. Generating icons..."
    cd "$PROJECT_DIR/assets/icons"
    if command -v python3 &> /dev/null; then
        pip3 install pillow cairosvg -q 2>/dev/null || true
        python3 generate_icons.py || echo "Icon generation failed, using placeholder"
    fi
fi

# Create .app bundle structure
echo ""
echo "3. Creating app bundle..."
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Copy binary
cp "$BUILD_DIR/agent-core" "$APP_BUNDLE/Contents/MacOS/sentinel-agent"
chmod +x "$APP_BUNDLE/Contents/MacOS/sentinel-agent"

# Copy Info.plist
cp "$PROJECT_DIR/macos/Info.plist" "$APP_BUNDLE/Contents/"

# Copy icon if exists
if [ -f "$PROJECT_DIR/assets/icons/sentinel-agent.icns" ]; then
    cp "$PROJECT_DIR/assets/icons/sentinel-agent.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
else
    echo "Warning: Icon file not found, app will use default icon"
fi

# Create PkgInfo
echo "APPL????" > "$APP_BUNDLE/Contents/PkgInfo"

# Sign the app (if certificate available)
echo ""
echo "4. Code signing..."

# Check for Developer ID in keychain
IDENTITY=""
if security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
    IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | awk -F'"' '{print $2}')
fi

if [ -n "$IDENTITY" ]; then
    echo "Signing with Developer ID: $IDENTITY"

    # Sign with hardened runtime (required for notarization)
    ENTITLEMENTS="$PROJECT_DIR/macos/entitlements.plist"
    if [ -f "$ENTITLEMENTS" ]; then
        codesign --force --deep --options runtime \
            --entitlements "$ENTITLEMENTS" \
            --sign "$IDENTITY" \
            "$APP_BUNDLE"
    else
        codesign --force --deep --options runtime \
            --sign "$IDENTITY" \
            "$APP_BUNDLE"
    fi

    # Verify signature
    codesign --verify --verbose=2 "$APP_BUNDLE"
    echo "Code signing successful!"
else
    echo "No Developer ID found, using ad-hoc signing"
    echo "WARNING: Ad-hoc signed apps will show 'damaged' warning when downloaded"
    echo "For distribution, add APPLE_CERTIFICATE_P12 secret to GitHub Actions"
    codesign --force --deep --sign - "$APP_BUNDLE"
fi

# Create DMG
echo ""
echo "5. Creating DMG..."
DMG_PATH="$BUILD_DIR/SentinelAgent-$VERSION.dmg"
DMG_LATEST_PATH="$BUILD_DIR/SentinelAgent-latest.dmg"
rm -f "$DMG_PATH" "$DMG_LATEST_PATH"

# Create temporary folder for DMG contents
DMG_TEMP="$BUILD_DIR/dmg-temp"
rm -rf "$DMG_TEMP"
mkdir -p "$DMG_TEMP"

# Copy app to temp folder
cp -R "$APP_BUNDLE" "$DMG_TEMP/"

# Create Applications symlink
ln -s /Applications "$DMG_TEMP/Applications"

# Create installer script (double-click to install)
cat > "$DMG_TEMP/Installer.command" << 'INSTALLER_EOF'
#!/bin/bash
# Sentinel Agent Installer
# Double-cliquez sur ce fichier pour installer l'application

clear
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           INSTALLATION DE SENTINEL AGENT                     ║"
echo "║           Cyber Threat Consulting                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Get the directory where this script is located (the mounted DMG)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Sentinel Agent.app"
SOURCE_APP="$SCRIPT_DIR/$APP_NAME"
DEST_APP="/Applications/$APP_NAME"

# Check if source app exists
if [ ! -d "$SOURCE_APP" ]; then
    echo "❌ Erreur: Application non trouvée dans le DMG"
    echo "   Chemin attendu: $SOURCE_APP"
    echo ""
    read -p "Appuyez sur Entrée pour fermer..."
    exit 1
fi

echo "📦 Copie de l'application vers /Applications..."

# Remove existing installation if present
if [ -d "$DEST_APP" ]; then
    echo "   ⚠️  Une version existante a été trouvée, suppression..."
    rm -rf "$DEST_APP"
fi

# Copy app to Applications
cp -R "$SOURCE_APP" "$DEST_APP"

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la copie. Essayez avec les droits administrateur:"
    echo "   sudo cp -R \"$SOURCE_APP\" \"$DEST_APP\""
    echo ""
    read -p "Appuyez sur Entrée pour fermer..."
    exit 1
fi

echo "✅ Application copiée avec succès"
echo ""

echo "🔓 Suppression de la quarantaine macOS..."
xattr -cr "$DEST_APP"
echo "✅ Quarantaine supprimée"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "✅ INSTALLATION TERMINÉE !"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Vous pouvez maintenant:"
echo "  1. Lancer Sentinel Agent depuis le Launchpad"
echo "  2. Ou depuis /Applications/Sentinel Agent.app"
echo ""

read -p "Voulez-vous lancer l'application maintenant ? (o/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Oo]$ ]]; then
    echo "🚀 Lancement de Sentinel Agent..."
    open "$DEST_APP"
fi

echo ""
echo "Vous pouvez éjecter le DMG et fermer cette fenêtre."
echo ""
INSTALLER_EOF
chmod +x "$DMG_TEMP/Installer.command"

# Create README
cat > "$DMG_TEMP/LISEZ-MOI.txt" << EOF
╔══════════════════════════════════════════════════════════════════════════════╗
║                     SENTINEL AGENT v$VERSION                                 ║
║                     Cyber Threat Consulting                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

INSTALLATION (MÉTHODE RECOMMANDÉE)
==================================
1. Double-cliquez sur "Installer.command"
2. Suivez les instructions à l'écran
3. C'est tout ! L'application est prête à utiliser.

INSTALLATION MANUELLE
=====================
1. Glissez "Sentinel Agent" vers le dossier "Applications"
2. Ouvrez Terminal et exécutez :
   xattr -cr "/Applications/Sentinel Agent.app"
3. Lancez l'application depuis le Launchpad
4. Si macOS demande une autorisation, allez dans :
   Préférences Système > Sécurité > "Ouvrir quand même"

FONCTIONNALITÉS
===============
• Surveillance de conformité en temps réel
• Vérification automatique des politiques de sécurité
• Synchronisation avec la plateforme Sentinel GRC
• Mode hors-ligne avec mise en cache locale
• Interface système tray pour contrôle rapide

MENU SYSTÈME (ICÔNE DANS LA BARRE)
===================================
• Statut et version de l'agent
• Pause/Reprise des vérifications
• Vérification immédiate
• Accès au tableau de bord en ligne
• Accès aux logs
• Guide utilisateur et site web

EMPLACEMENT DES DONNÉES
=======================
• Configuration : ~/Library/Application Support/SentinelGRC/agent.json
• Base de données : ~/Library/Application Support/SentinelGRC/agent.db
• Logs : ~/Library/Application Support/SentinelGRC/logs/

CONFIGURATION INITIALE
======================
Option 1 - Via ligne de commande :
  /Applications/Sentinel\\ Agent.app/Contents/MacOS/sentinel-agent enroll --token VOTRE_TOKEN

Option 2 - Via fichier de configuration :
  Créez ~/Library/Application Support/SentinelGRC/agent.json avec :
  {
    "enrollment_token": "VOTRE_TOKEN",
    "server_url": "https://app.cyber-threat-consulting.com"
  }

COMMANDES DISPONIBLES
=====================
  sentinel-agent enroll --token <TOKEN>   Enrôler l'agent
  sentinel-agent status                   Afficher le statut
  sentinel-agent run                      Lancer une vérification
  sentinel-agent --help                   Afficher l'aide

LIENS UTILES
============
• Site web      : https://cyber-threat-consulting.com
• Plateforme    : https://app.cyber-threat-consulting.com
• Documentation : https://cyber-threat-consulting.com/docs/sentinel-agent

CONTACT
=======
Email : ***REMOVED***

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
© 2024-2026 Cyber Threat Consulting. Tous droits réservés.
EOF

# Create DMG using hdiutil
hdiutil create -volname "$APP_NAME" \
    -srcfolder "$DMG_TEMP" \
    -ov -format UDZO \
    "$DMG_PATH"

# Create latest copy
cp "$DMG_PATH" "$DMG_LATEST_PATH"

# Cleanup
rm -rf "$DMG_TEMP"

echo ""
echo "=== Build complete ==="
echo "App bundle: $APP_BUNDLE"
echo "DMG: $DMG_PATH"
echo "DMG (latest): $DMG_LATEST_PATH"
echo ""
echo "To install:"
echo "  1. Open the DMG"
echo "  2. Drag 'Sentinel Agent' to Applications"
echo "  3. Launch from Launchpad"
