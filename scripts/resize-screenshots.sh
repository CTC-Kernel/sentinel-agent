#!/bin/bash

# Script pour redimensionner les screenshots aux dimensions App Store
set -e

echo "📐 Redimensionnement des screenshots pour l'App Store"
echo "====================================================="

PROJECT_DIR="/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod"
SOURCE_DIR="$PROJECT_DIR/resources"
DEST_DIR="$PROJECT_DIR/screenshots"

cd "$PROJECT_DIR"

# Créer les dossiers de destination
mkdir -p "$DEST_DIR/iphone-6.7"
mkdir -p "$DEST_DIR/iphone-6.5"
mkdir -p "$DEST_DIR/ipad-12.9"

echo ""
echo "⚠️  PROBLÈME DÉTECTÉ:"
echo "Les screenshots capturés ont des dimensions incorrectes:"
echo "  - Actuelles: ~1100x1500px"
echo "  - Requises iPhone 6.7\": 1290x2796px"
echo "  - Requises iPhone 6.5\": 1242x2688px"
echo "  - Requises iPad 12.9\": 2048x2732px"
echo ""
echo "📱 SOLUTION RECOMMANDÉE:"
echo ""
echo "Option 1: Recapturer depuis le Simulateur iOS (RECOMMANDÉ)"
echo "=========================================================="
echo ""
echo "1. Dans Xcode, sélectionnez le bon simulateur:"
echo "   - iPhone 15 Pro Max (pour 6.7\")"
echo "   - iPhone 11 Pro Max (pour 6.5\")"
echo "   - iPad Pro 12.9\""
echo ""
echo "2. Lancez l'app (Cmd+R)"
echo ""
echo "3. Dans le SIMULATEUR (pas Xcode), appuyez sur Cmd+S"
echo "   Les screenshots auront automatiquement les bonnes dimensions"
echo ""
echo "4. Les fichiers seront sur votre Bureau"
echo ""
echo "5. Déplacez-les dans:"
echo "   screenshots/iphone-6.7/"
echo "   screenshots/iphone-6.5/"
echo "   screenshots/ipad-12.9/"
echo ""
echo "Option 2: Utiliser sips pour redimensionner (MOINS BON)"
echo "========================================================"
echo ""
echo "Si vous voulez quand même utiliser les screenshots actuels,"
echo "nous pouvons les redimensionner, mais la qualité sera dégradée."
echo ""
read -p "Voulez-vous redimensionner les screenshots existants? (o/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Oo]$ ]]; then
    echo ""
    echo "🔧 Redimensionnement en cours..."
    
    # Compter les fichiers valides
    VALID_FILES=($(ls -1 "$SOURCE_DIR"/Capture*.png 2>/dev/null | while read f; do
        if [ -s "$f" ]; then
            echo "$f"
        fi
    done))
    
    COUNT=${#VALID_FILES[@]}
    echo "Fichiers valides trouvés: $COUNT"
    
    if [ $COUNT -eq 0 ]; then
        echo "❌ Aucun fichier valide trouvé"
        exit 1
    fi
    
    # Redimensionner pour iPhone 6.7"
    echo ""
    echo "📱 Redimensionnement pour iPhone 6.7\" (1290x2796)..."
    i=1
    for file in "${VALID_FILES[@]}"; do
        if [ $i -le 5 ]; then
            output="$DEST_DIR/iphone-6.7/$i-screen.png"
            sips -z 2796 1290 "$file" --out "$output" > /dev/null 2>&1
            echo "  ✅ $i-screen.png créé"
            ((i++))
        fi
    done
    
    # Redimensionner pour iPhone 6.5"
    echo ""
    echo "📱 Redimensionnement pour iPhone 6.5\" (1242x2688)..."
    i=1
    for file in "${VALID_FILES[@]}"; do
        if [ $i -le 5 ]; then
            output="$DEST_DIR/iphone-6.5/$i-screen.png"
            sips -z 2688 1242 "$file" --out "$output" > /dev/null 2>&1
            echo "  ✅ $i-screen.png créé"
            ((i++))
        fi
    done
    
    # Redimensionner pour iPad 12.9"
    echo ""
    echo "📱 Redimensionnement pour iPad 12.9\" (2048x2732)..."
    i=1
    for file in "${VALID_FILES[@]}"; do
        if [ $i -le 5 ]; then
            output="$DEST_DIR/ipad-12.9/$i-screen.png"
            sips -z 2732 2048 "$file" --out "$output" > /dev/null 2>&1
            echo "  ✅ $i-screen.png créé"
            ((i++))
        fi
    done
    
    echo ""
    echo "=============================================================="
    echo "✅ Redimensionnement terminé!"
    echo "=============================================================="
    echo ""
    echo "📁 Screenshots disponibles dans:"
    echo "   $DEST_DIR/"
    echo ""
    echo "⚠️  ATTENTION: La qualité peut être dégradée."
    echo "   Pour de meilleurs résultats, recapturez depuis le simulateur."
    echo ""
else
    echo ""
    echo "❌ Redimensionnement annulé"
    echo ""
    echo "📋 INSTRUCTIONS POUR RECAPTURER:"
    echo ""
    echo "1. Ouvrez Xcode:"
    echo "   open ios/App/App.xcworkspace"
    echo ""
    echo "2. Sélectionnez 'iPhone 15 Pro Max' en haut"
    echo ""
    echo "3. Lancez l'app: Cmd+R"
    echo ""
    echo "4. Dans le SIMULATEUR, appuyez sur Cmd+S pour chaque écran"
    echo ""
    echo "5. Répétez pour iPhone 11 Pro Max et iPad Pro 12.9\""
    echo ""
fi

echo "=============================================================="
