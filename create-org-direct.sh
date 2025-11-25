#!/bin/bash

# Script pour créer l'organisation directement via Firebase REST API

echo "🚀 Création de l'organisation wn6qlze5ln..."

# Obtenir le token d'accès
echo "🔐 Obtention du token Firebase..."
TOKEN=$(firebase login:ci 2>/dev/null || gcloud auth print-access-token 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Impossible d'obtenir le token. Essayons avec firebase..."
    firebase login
    TOKEN=$(firebase login:ci)
fi

# Créer l'organisation via Firestore REST API
curl -X PATCH \
  "https://firestore.googleapis.com/v1/projects/sentinel-grc-a8701/databases/(default)/documents/organizations/wn6qlze5ln" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "id": {"stringValue": "wn6qlze5ln"},
      "name": {"stringValue": "Mon Organisation"},
      "slug": {"stringValue": "mon-organisation"},
      "ownerId": {"stringValue": "system"},
      "createdAt": {"stringValue": "2025-11-25T20:37:00.000Z"},
      "updatedAt": {"stringValue": "2025-11-25T20:37:00.000Z"},
      "subscription": {
        "mapValue": {
          "fields": {
            "planId": {"stringValue": "discovery"},
            "status": {"stringValue": "active"},
            "startDate": {"stringValue": "2025-11-25T20:37:00.000Z"},
            "stripeCustomerId": {"nullValue": null},
            "stripeSubscriptionId": {"nullValue": null},
            "currentPeriodEnd": {"nullValue": null},
            "cancelAtPeriodEnd": {"booleanValue": false}
          }
        }
      }
    }
  }'

echo ""
echo "✅ Organisation créée !"
echo "🔄 Rafraîchissez votre application pour voir les changements."
