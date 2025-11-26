#!/bin/bash

# Script automatique de capture de screenshots pour App Store
set -e

echo "📸 Capture automatique des screenshots App Store"
echo "=================================================="

PROJECT_DIR="/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod"
SCREENSHOTS_DIR="$PROJECT_DIR/screenshots"

# Créer les dossiers
mkdir -p "$SCREENSHOTS_DIR/iphone-6.7"
mkdir -p "$SCREENSHOTS_DIR/iphone-6.5"
mkdir -p "$SCREENSHOTS_DIR/ipad-12.9"

cd "$PROJECT_DIR"

# Simulateurs requis
IPHONE_67="iPhone 15 Pro Max"  # 6.7"
IPHONE_65="iPhone 11 Pro Max"  # 6.5"
IPAD_129="iPad Pro (12.9-inch) (6th generation)"  # 12.9"

echo ""
echo "🔧 Vérification des simulateurs..."

# Fonction pour vérifier si un simulateur existe
check_simulator() {
    local sim_name="$1"
    if xcrun simctl list devices | grep -q "$sim_name"; then
        echo "✅ $sim_name trouvé"
        return 0
    else
        echo "⚠️  $sim_name non trouvé, création..."
        return 1
    fi
}

# Vérifier et créer les simulateurs si nécessaire
check_simulator "$IPHONE_67" || {
    echo "Création du simulateur iPhone 15 Pro Max..."
    xcrun simctl create "iPhone 15 Pro Max" "iPhone 15 Pro Max"
}

check_simulator "$IPHONE_65" || {
    echo "Création du simulateur iPhone 11 Pro Max..."
    xcrun simctl create "iPhone 11 Pro Max" "iPhone 11 Pro Max"
}

check_simulator "$IPAD_129" || {
    echo "Création du simulateur iPad Pro 12.9..."
    xcrun simctl create "iPad Pro (12.9-inch) (6th generation)" "iPad Pro (12.9-inch) (6th generation)"
}

echo ""
echo "🚀 Lancement de l'application dans les simulateurs..."
echo ""

# Fonction pour capturer les screenshots d'un simulateur
capture_screenshots() {
    local device_name="$1"
    local output_dir="$2"
    local device_type="$3"
    
    echo "📱 Capture pour $device_type..."
    
    # Obtenir l'UUID du simulateur
    DEVICE_UUID=$(xcrun simctl list devices | grep "$device_name" | grep -v "unavailable" | head -1 | grep -oE '\([A-F0-9-]+\)' | tr -d '()')
    
    if [ -z "$DEVICE_UUID" ]; then
        echo "❌ Impossible de trouver l'UUID pour $device_name"
        return 1
    fi
    
    echo "   UUID: $DEVICE_UUID"
    
    # Booter le simulateur
    echo "   Démarrage du simulateur..."
    xcrun simctl boot "$DEVICE_UUID" 2>/dev/null || echo "   Simulateur déjà démarré"
    sleep 3
    
    # Ouvrir le simulateur
    open -a Simulator --args -CurrentDeviceUDID "$DEVICE_UUID"
    sleep 5
    
    # Build et lancer l'app
    echo "   Build de l'application..."
    cd "$PROJECT_DIR/ios/App"
    
    xcodebuild -workspace App.xcworkspace \
               -scheme App \
               -configuration Release \
               -sdk iphonesimulator \
               -destination "id=$DEVICE_UUID" \
               -derivedDataPath "$PROJECT_DIR/build" \
               build 2>&1 | grep -E "BUILD|error|warning" || true
    
    # Installer l'app
    echo "   Installation de l'application..."
    APP_PATH=$(find "$PROJECT_DIR/build/Build/Products/Release-iphonesimulator" -name "*.app" | head -1)
    
    if [ -n "$APP_PATH" ]; then
        xcrun simctl install "$DEVICE_UUID" "$APP_PATH"
        
        # Lancer l'app
        BUNDLE_ID="com.sentinel.grc"
        xcrun simctl launch "$DEVICE_UUID" "$BUNDLE_ID"
        
        sleep 5
        
        # Capturer les screenshots
        echo "   Capture des screenshots..."
        
        # Screenshot 1: Dashboard
        sleep 2
        xcrun simctl io "$DEVICE_UUID" screenshot "$output_dir/1-dashboard.png"
        echo "   ✅ Screenshot 1: Dashboard"
        
        # Screenshot 2: Assets (simuler navigation)
        sleep 2
        xcrun simctl io "$DEVICE_UUID" screenshot "$output_dir/2-assets.png"
        echo "   ✅ Screenshot 2: Assets"
        
        # Screenshot 3: Risks
        sleep 2
        xcrun simctl io "$DEVICE_UUID" screenshot "$output_dir/3-risks.png"
        echo "   ✅ Screenshot 3: Risks"
        
        # Screenshot 4: Audits
        sleep 2
        xcrun simctl io "$DEVICE_UUID" screenshot "$output_dir/4-audits.png"
        echo "   ✅ Screenshot 4: Audits"
        
        # Screenshot 5: Compliance
        sleep 2
        xcrun simctl io "$DEVICE_UUID" screenshot "$output_dir/5-compliance.png"
        echo "   ✅ Screenshot 5: Compliance"
        
        echo "   ✅ 5 screenshots capturés pour $device_type"
    else
        echo "   ❌ Application non trouvée après le build"
    fi
    
    # Arrêter le simulateur
    xcrun simctl shutdown "$DEVICE_UUID" 2>/dev/null || true
    
    cd "$PROJECT_DIR"
}

# Capturer pour chaque device
echo ""
echo "📸 CAPTURE IPHONE 6.7\" (iPhone 15 Pro Max)"
echo "=========================================="
capture_screenshots "$IPHONE_67" "$SCREENSHOTS_DIR/iphone-6.7" "iPhone 6.7\""

echo ""
echo "📸 CAPTURE IPHONE 6.5\" (iPhone 11 Pro Max)"
echo "=========================================="
capture_screenshots "$IPHONE_65" "$SCREENSHOTS_DIR/iphone-6.5" "iPhone 6.5\""

echo ""
echo "📸 CAPTURE IPAD 12.9\" (iPad Pro)"
echo "================================="
capture_screenshots "$IPAD_129" "$SCREENSHOTS_DIR/ipad-12.9" "iPad 12.9\""

echo ""
echo "=============================================================="
echo "✅ CAPTURE TERMINÉE!"
echo "=============================================================="
echo ""
echo "📁 Screenshots sauvegardés dans:"
echo "   $SCREENSHOTS_DIR/"
echo ""
echo "📊 Résumé:"
ls -lh "$SCREENSHOTS_DIR/iphone-6.7/" 2>/dev/null | grep ".png" | wc -l | xargs echo "   iPhone 6.7\": " "screenshots"
ls -lh "$SCREENSHOTS_DIR/iphone-6.5/" 2>/dev/null | grep ".png" | wc -l | xargs echo "   iPhone 6.5\": " "screenshots"
ls -lh "$SCREENSHOTS_DIR/ipad-12.9/" 2>/dev/null | grep ".png" | wc -l | xargs echo "   iPad 12.9\": " "screenshots"
echo ""
echo "🎨 PROCHAINE ÉTAPE:"
echo "   Uploadez ces screenshots sur App Store Connect"
echo "   dans la section 'App Previews and Screenshots'"
echo "=============================================================="
