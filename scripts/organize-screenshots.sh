#!/bin/bash

# Organiser les screenshots pour l'App Store
set -e

echo "📸 Organisation des screenshots..."

cd /Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod

# Créer les dossiers
mkdir -p screenshots/iphone-6.7
mkdir -p screenshots/iphone-6.5
mkdir -p screenshots/ipad-12.9

# Copier les screenshots valides
i=1
for file in resources/Capture*.png; do
    if [ -f "$file" ] && [ -s "$file" ]; then
        size=$(stat -f%z "$file")
        if [ $size -gt 100000 ]; then
            cp "$file" "screenshots/iphone-6.7/$i-screen.png"
            echo "✅ Screenshot $i copié"
            ((i++))
            if [ $i -gt 5 ]; then
                break
            fi
        fi
    fi
done

# Dupliquer pour les autres devices
cp screenshots/iphone-6.7/*.png screenshots/iphone-6.5/ 2>/dev/null || true
cp screenshots/iphone-6.7/*.png screenshots/ipad-12.9/ 2>/dev/null || true

echo ""
echo "✅ Screenshots organisés :"
echo "   iPhone 6.7\": $(ls screenshots/iphone-6.7/*.png 2>/dev/null | wc -l | tr -d ' ') fichiers"
echo "   iPhone 6.5\": $(ls screenshots/iphone-6.5/*.png 2>/dev/null | wc -l | tr -d ' ') fichiers"
echo "   iPad 12.9\": $(ls screenshots/ipad-12.9/*.png 2>/dev/null | wc -l | tr -d ' ') fichiers"
echo ""
echo "📁 Dossier: screenshots/"
