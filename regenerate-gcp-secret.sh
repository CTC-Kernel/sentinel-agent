#!/bin/bash

# Script pour régénérer et encoder correctement une clé GCP Service Account
# Usage: ./regenerate-gcp-secret.sh <path_to_json_file>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path_to_service_account_json>"
    echo ""
    echo "Instructions:"
    echo "1. Téléchargez une nouvelle clé JSON depuis Google Cloud Console"
    echo "2. Exécutez: $0 chemin/vers/clé.json"
    echo "3. Copiez le résultat et mettez à jour le secret GCP_SA_KEY dans GitHub"
    exit 1
fi

JSON_FILE="$1"

if [ ! -f "$JSON_FILE" ]; then
    echo "Error: File $JSON_FILE not found"
    exit 1
fi

echo "=== Validation du fichier JSON ==="

# Validation JSON
if ! python3 -m json.tool "$JSON_FILE" > /dev/null 2>&1; then
    echo "❌ Le fichier n'est pas du JSON valide"
    exit 1
fi
echo "✅ Format JSON valide"

# Validation clé privée
PRIVATE_KEY=$(grep "private_key" "$JSON_FILE" | cut -d'"' -f4)
if ! echo "$PRIVATE_KEY" | grep -q "BEGIN PRIVATE KEY"; then
    echo "❌ Format de clé privée invalide"
    echo "La clé privée doit commencer par '-----BEGIN PRIVATE KEY-----'"
    exit 1
fi
echo "✅ Format de clé privée valide"

echo ""
echo "=== Encodage Base64 ==="

# Encoder en Base64
BASE64_ENCODED=$(cat "$JSON_FILE" | base64 -w 0)

echo "Secret encodé en Base64 (à copier dans GitHub Secrets):"
echo ""
echo "$BASE64_ENCODED"
echo ""

# Test de décodage
echo "=== Test de décodage ==="
if echo "$BASE64_ENCODED" | base64 -d | python3 -m json.tool > /dev/null 2>&1; then
    echo "✅ Test de décodage réussi"
else
    echo "❌ Test de décodage échoué"
    exit 1
fi

echo ""
echo "🎉 Secret prêt à être utilisé dans GitHub!"
echo ""
echo "Étapes suivantes:"
echo "1. Copiez le secret encodé ci-dessus"
echo "2. Allez dans GitHub → Repository → Settings → Secrets and variables → Actions"
echo "3. Mettez à jour le secret 'GCP_SA_KEY'"
echo "4. Lancez un nouveau release"
