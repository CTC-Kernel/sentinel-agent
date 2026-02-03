#!/bin/bash

# Script pour tester la validité d'une clé GCP SA
# Usage: ./test-gcp-secret.sh <path_to_json_file>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path_to_service_account_json>"
    exit 1
fi

JSON_FILE="$1"

if [ ! -f "$JSON_FILE" ]; then
    echo "Error: File $JSON_FILE not found"
    exit 1
fi

echo "=== Validation de la clé GCP SA ==="

# Validation JSON
if ! python3 -m json.tool "$JSON_FILE" > /dev/null 2>&1; then
    echo "❌ Le fichier n'est pas du JSON valide"
    exit 1
fi
echo "✅ Format JSON valide"

# Champs requis
REQUIRED_FIELDS=("type" "project_id" "private_key_id" "private_key" "client_email" "client_id")
for field in "${REQUIRED_FIELDS[@]}"; do
    if ! grep -q "\"$field\"" "$JSON_FILE"; then
        echo "❌ Champ requis manquant: $field"
        exit 1
    fi
done
echo "✅ Tous les champs requis sont présents"

# Validation clé privée
PRIVATE_KEY=$(grep "\"private_key\"" "$JSON_FILE" | cut -d'"' -f4)
if ! echo "$PRIVATE_KEY" | grep -q "BEGIN PRIVATE KEY"; then
    echo "❌ Format de clé privée invalide"
    exit 1
fi
echo "✅ Format de clé privée valide"

# Test d'authentification (optionnel, nécessite gcloud)
echo ""
echo "=== Test d'authentification (optionnel) ==="
echo "Pour tester l'authentification :"
echo "gcloud auth activate-service-account --key-file=$JSON_FILE"
echo "gcloud storage ls gs://votre-bucket"

echo ""
echo "✅ La clé GCP SA semble valide pour être utilisée dans GitHub Actions"
