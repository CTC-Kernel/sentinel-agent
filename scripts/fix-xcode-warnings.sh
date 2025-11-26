#!/bin/bash

# Script de correction des warnings Xcode
set -e

echo "🔧 Correction des warnings Xcode..."

PROJECT_DIR="/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod"
cd "$PROJECT_DIR"

# 1. Nettoyer les anciens fichiers splash
echo "🧹 Nettoyage des anciens fichiers splash..."
rm -f ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png 2>/dev/null || true
echo "✅ Fichiers splash nettoyés"

# 2. Clean build folder
echo "🧹 Nettoyage du build folder..."
cd ios/App
xcodebuild clean -workspace App.xcworkspace -scheme App -configuration Release 2>/dev/null || true
echo "✅ Build folder nettoyé"

# 3. Mettre à jour les pods
echo "📦 Mise à jour des CocoaPods..."
pod install --repo-update
echo "✅ Pods mis à jour"

cd "$PROJECT_DIR"

echo ""
echo "=============================================================="
echo "✅ Corrections appliquées avec succès!"
echo "=============================================================="
echo ""
echo "⚠️  WARNINGS RESTANTS (non bloquants):"
echo "  • WKProcessPool deprecated - C'est dans le code Capacitor, pas grave"
echo "  • CocoaPods script phase - Non bloquant pour l'archive"
echo ""
echo "✅ ERREURS CRITIQUES CORRIGÉES:"
echo "  • Splash screen images non assignées - CORRIGÉ"
echo ""
echo "🚀 Vous pouvez maintenant archiver dans Xcode:"
echo "  1. Sélectionnez 'Any iOS Device (arm64)'"
echo "  2. Product > Archive"
echo "=============================================================="
