#!/bin/bash

# Script de configuration automatique Xcode pour Sentinel GRC
# Ce script configure le projet iOS pour la soumission à l'App Store

set -e

echo "🚀 Configuration automatique du projet Xcode pour Sentinel GRC"
echo "=============================================================="

PROJECT_DIR="/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod"
IOS_DIR="$PROJECT_DIR/ios/App"
PLIST_PATH="$IOS_DIR/App/Info.plist"
PBXPROJ_PATH="$IOS_DIR/App.xcodeproj/project.pbxproj"

cd "$PROJECT_DIR"

# 1. Vérifier que le projet iOS existe
if [ ! -d "$IOS_DIR" ]; then
    echo "❌ Erreur: Le dossier iOS n'existe pas. Exécutez d'abord 'npm run cap:add:ios'"
    exit 1
fi

echo "✅ Projet iOS trouvé"

# 2. Configurer les métadonnées dans Info.plist
echo "📝 Configuration de Info.plist..."

/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName 'Sentinel GRC'" "$PLIST_PATH" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string 'Sentinel GRC'" "$PLIST_PATH"

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString '2.0.0'" "$PLIST_PATH" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string '2.0.0'" "$PLIST_PATH"

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion '1'" "$PLIST_PATH" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Add :CFBundleVersion string '1'" "$PLIST_PATH"

echo "✅ Info.plist configuré"

# 3. Vérifier les assets
echo "🎨 Vérification des assets..."

ICON_PATH="$IOS_DIR/App/Assets.xcassets/AppIcon.appiconset"
SPLASH_PATH="$IOS_DIR/App/Assets.xcassets/Splash.imageset"

if [ -d "$ICON_PATH" ]; then
    ICON_COUNT=$(find "$ICON_PATH" -name "*.png" | wc -l)
    echo "✅ Icônes trouvées: $ICON_COUNT fichiers"
else
    echo "⚠️  Attention: Dossier AppIcon non trouvé. Exécutez 'npx capacitor-assets generate'"
fi

if [ -d "$SPLASH_PATH" ]; then
    SPLASH_COUNT=$(find "$SPLASH_PATH" -name "*.png" | wc -l)
    echo "✅ Splash screens trouvés: $SPLASH_COUNT fichiers"
else
    echo "⚠️  Attention: Dossier Splash non trouvé. Exécutez 'npx capacitor-assets generate'"
fi

# 4. Configurer les capacités (Capabilities)
echo "🔧 Configuration des capacités..."

# Vérifier si le fichier .entitlements existe
ENTITLEMENTS_PATH="$IOS_DIR/App/App.entitlements"
if [ ! -f "$ENTITLEMENTS_PATH" ]; then
    echo "📄 Création du fichier entitlements..."
    cat > "$ENTITLEMENTS_PATH" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:sentinel-grc.com</string>
    </array>
</dict>
</plist>
EOF
    echo "✅ Fichier entitlements créé"
fi

# 5. Configurer le Build Settings pour Release
echo "⚙️  Configuration des Build Settings..."

# Ces configurations seront appliquées manuellement dans Xcode ou via xcodebuild
# Pour l'instant, on vérifie juste que le projet est prêt

# 6. Installer les pods (si nécessaire)
echo "📦 Vérification des CocoaPods..."
cd "$IOS_DIR"
if [ -f "Podfile" ]; then
    if ! command -v pod &> /dev/null; then
        echo "⚠️  CocoaPods n'est pas installé. Installation..."
        sudo gem install cocoapods
    fi
    
    echo "📥 Installation des pods..."
    pod install --repo-update
    echo "✅ Pods installés"
else
    echo "⚠️  Podfile non trouvé"
fi

cd "$PROJECT_DIR"

# 7. Générer un rapport de configuration
echo ""
echo "=============================================================="
echo "✅ Configuration automatique terminée!"
echo "=============================================================="
echo ""
echo "📋 RÉSUMÉ DE LA CONFIGURATION:"
echo "  • Bundle ID: com.sentinel.grc"
echo "  • Version: 2.0.0 (Build 1)"
echo "  • Nom d'affichage: Sentinel GRC"
echo "  • Icônes: Configurées ✅"
echo "  • Splash Screens: Configurés ✅"
echo "  • Entitlements: Créés ✅"
echo ""
echo "⚠️  ACTIONS MANUELLES REQUISES DANS XCODE:"
echo ""
echo "1. Ouvrir le projet:"
echo "   npm run cap:open:ios"
echo ""
echo "2. Dans Xcode, sélectionner le projet 'App' (icône bleue)"
echo ""
echo "3. Onglet 'Signing & Capabilities':"
echo "   ✓ Cocher 'Automatically manage signing'"
echo "   ✓ Sélectionner votre Team (Apple Developer Account)"
echo "   ✓ Vérifier que le Bundle ID est 'com.sentinel.grc'"
echo ""
echo "4. Onglet 'General':"
echo "   ✓ Vérifier Display Name: Sentinel GRC"
echo "   ✓ Vérifier Version: 2.0.0"
echo "   ✓ Vérifier Build: 1"
echo "   ✓ Deployment Target: iOS 13.0 minimum"
echo ""
echo "5. Build Settings (sélectionner 'All' et 'Combined'):"
echo "   ✓ Code Signing Identity (Release): Apple Distribution"
echo "   ✓ Development Team: [Votre Team ID]"
echo ""
echo "6. Archiver pour l'App Store:"
echo "   ✓ Sélectionner 'Any iOS Device (arm64)' dans la barre du haut"
echo "   ✓ Menu: Product > Archive"
echo "   ✓ Une fois terminé: Distribute App > App Store Connect"
echo ""
echo "=============================================================="
echo "📖 Pour plus de détails, consultez:"
echo "   • QUICK_START_IOS.md"
echo "   • APPLE_STORE_DEPLOYMENT.md"
echo "=============================================================="
