#!/bin/bash

# Script pour valider un secret GCP SA encodé en Base64
# Usage: ./validate-base64-secret.sh <base64_string>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <base64_encoded_service_account>"
    echo ""
    echo "Pour tester le secret de GitHub :"
    echo "1. Copiez le contenu du secret GCP_SA_KEY"
    echo "2. Exécutez: $0 '<coller_le_secret>'"
    exit 1
fi

BASE64_SECRET="$1"

echo "=== Validation du secret GCP SA (Base64) ==="

# Test décodage Base64
echo "🔍 Test du décodage Base64..."
if ! echo "$BASE64_SECRET" | base64 -d > /tmp/decoded-secret.json 2>/dev/null; then
    echo "❌ Échec du décodage Base64"
    echo "Vérifiez que le secret n'a pas de sauts de ligne ou d'espaces supplémentaires"
    exit 1
fi
echo "✅ Décodage Base64 réussi"

# Validation JSON
echo "🔍 Validation du format JSON..."
if ! python3 -m json.tool /tmp/decoded-secret.json > /dev/null 2>&1; then
    echo "❌ Le contenu décodé n'est pas du JSON valide"
    echo "Contenu décodé :"
    cat /tmp/decoded-secret.json
    rm -f /tmp/decoded-secret.json
    exit 1
fi
echo "✅ Format JSON valide"

# Champs requis
echo "🔍 Vérification des champs requis..."
REQUIRED_FIELDS=("type" "project_id" "private_key_id" "private_key" "client_email" "client_id")
for field in "${REQUIRED_FIELDS[@]}"; do
    if ! grep -q "\"$field\"" /tmp/decoded-secret.json; then
        echo "❌ Champ requis manquant: $field"
        rm -f /tmp/decoded-secret.json
        exit 1
    fi
done
echo "✅ Tous les champs requis sont présents"

# Validation clé privée
echo "🔍 Validation de la clé privée..."
PRIVATE_KEY=$(grep "\"private_key\"" /tmp/decoded-secret.json | cut -d'"' -f4)
if ! echo "$PRIVATE_KEY" | grep -q "BEGIN PRIVATE KEY"; then
    echo "❌ Format de clé privée invalide"
    echo "La clé privée doit commencer par '-----BEGIN PRIVATE KEY-----'"
    rm -f /tmp/decoded-secret.json
    exit 1
fi
echo "✅ Format de clé privée valide"

# Nettoyage
rm -f /tmp/decoded-secret.json

echo ""
echo "🎉 Le secret GCP SA est valide !"
echo ""
echo "Le secret peut être utilisé dans GitHub Actions avec le workflow modifié."
