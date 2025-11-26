#!/bin/bash

# Redimensionner les screenshots aux dimensions App Store
set -e

echo "📐 Redimensionnement des screenshots aux dimensions App Store..."
echo ""

cd /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod

# Backup
mkdir -p screenshots/backup
cp -r screenshots/iphone-6.7 screenshots/backup/ 2>/dev/null || true

# Redimensionner pour iPhone 6.7" (1290x2796)
echo "📱 iPhone 6.7\" (1290x2796)..."
for file in screenshots/iphone-6.7/*.png; do
    if [ -f "$file" ]; then
        sips -z 2796 1290 "$file" --out "$file" > /dev/null 2>&1
        echo "  ✅ $(basename "$file")"
    fi
done

# Redimensionner pour iPhone 6.5" (1242x2688)
echo ""
echo "📱 iPhone 6.5\" (1242x2688)..."
for file in screenshots/iphone-6.5/*.png; do
    if [ -f "$file" ]; then
        sips -z 2688 1242 "$file" --out "$file" > /dev/null 2>&1
        echo "  ✅ $(basename "$file")"
    fi
done

# Redimensionner pour iPad 12.9" (2048x2732)
echo ""
echo "📱 iPad 12.9\" (2048x2732)..."
for file in screenshots/ipad-12.9/*.png; do
    if [ -f "$file" ]; then
        sips -z 2732 2048 "$file" --out "$file" > /dev/null 2>&1
        echo "  ✅ $(basename "$file")"
    fi
done

echo ""
echo "=============================================================="
echo "✅ Redimensionnement terminé!"
echo "=============================================================="
echo ""
echo "📊 Vérification des dimensions:"
echo ""
echo "iPhone 6.7\":"
sips -g pixelWidth -g pixelHeight screenshots/iphone-6.7/1-screen.png | grep pixel
echo ""
echo "iPhone 6.5\":"
sips -g pixelWidth -g pixelHeight screenshots/iphone-6.5/1-screen.png | grep pixel
echo ""
echo "iPad 12.9\":"
sips -g pixelWidth -g pixelHeight screenshots/ipad-12.9/1-screen.png | grep pixel
echo ""
echo "⚠️  Note: La qualité peut être légèrement dégradée."
echo "   Pour une qualité optimale, recapturez depuis le simulateur iOS."
echo ""
echo "📁 Backup des originaux: screenshots/backup/"
echo "=============================================================="
