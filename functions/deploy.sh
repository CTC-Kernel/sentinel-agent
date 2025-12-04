#!/bin/bash

# ===================================
# Script de Déploiement Automatique
# Sentinel GRC - Cloud Functions
# ===================================

echo "🚀 Déploiement des Cloud Functions Sentinel GRC"
echo "================================================"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si on est dans le bon dossier
if [ ! -f "index.js" ]; then
    echo -e "${RED}❌ Erreur: Exécutez ce script depuis le dossier functions/${NC}"
    exit 1
fi

echo "📋 Étape 1/5 : Vérification des prérequis..."
echo ""

# Vérifier Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI non installé${NC}"
    echo "Installez-le avec: npm install -g firebase-tools"
    exit 1
fi
echo -e "${GREEN}✅ Firebase CLI installé${NC}"

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js non installé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js installé ($(node --version))${NC}"

echo ""
echo "🔍 Étape 2/5 : Test de la syntaxe..."
echo ""

# Tester la syntaxe
node test-functions.js
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Des variables d'environnement sont manquantes${NC}"
    echo -e "${YELLOW}   Le déploiement continuera, mais configurez-les après${NC}"
    echo ""
    read -p "Continuer quand même ? (o/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🔐 Étape 3/5 : Vérification des secrets..."
echo ""

# Vérifier STRIPE_WEBHOOK_SECRET
echo "Vérification de STRIPE_WEBHOOK_SECRET..."
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET &> /dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ STRIPE_WEBHOOK_SECRET non configuré${NC}"
    echo ""
    echo "Configurez-le avec:"
    echo "  firebase functions:secrets:set STRIPE_WEBHOOK_SECRET"
    echo ""
    read -p "Voulez-vous le configurer maintenant ? (o/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
    else
        echo -e "${YELLOW}⚠️  Déploiement sans STRIPE_WEBHOOK_SECRET${NC}"
        echo -e "${YELLOW}   Les webhooks Stripe ne fonctionneront pas${NC}"
    fi
else
    echo -e "${GREEN}✅ STRIPE_WEBHOOK_SECRET configuré${NC}"
fi

# Vérifier STRIPE_SECRET_KEY
echo "Vérification de STRIPE_SECRET_KEY..."
firebase functions:secrets:access STRIPE_SECRET_KEY &> /dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  STRIPE_SECRET_KEY non configuré (utilise fallback hardcodé)${NC}"
else
    echo -e "${GREEN}✅ STRIPE_SECRET_KEY configuré${NC}"
fi

echo ""
echo "📧 Étape 4/5 : Vérification de la config SMTP..."
echo ""

firebase functions:config:get > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Configuration SMTP présente${NC}"
else
    echo -e "${YELLOW}⚠️  Configuration SMTP non trouvée${NC}"
    echo ""
    echo "Configurez-la avec:"
    echo "  firebase functions:config:set smtp.host=\"smtp.gmail.com\""
    echo "  firebase functions:config:set smtp.port=\"465\""
    echo "  firebase functions:config:set smtp.user=\"contact@cyber-threat-consulting.com\""
    echo "  firebase functions:config:set smtp.pass=\"YOUR_APP_PASSWORD\""
fi

echo ""
echo "🚀 Étape 5/5 : Déploiement..."
echo ""

# Demander confirmation
echo -e "${YELLOW}Vous allez déployer les Cloud Functions suivantes :${NC}"
echo "  - setUserClaims"
echo "  - refreshUserToken"
echo "  - fixAllUsers"
echo "  - createCheckoutSession"
echo "  - createPortalSession"
echo "  - stripeWebhook"
echo "  - processMailQueue"
echo ""

read -p "Confirmer le déploiement ? (o/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "Déploiement annulé"
    exit 0
fi

echo ""
echo "📦 Déploiement en cours..."
echo ""

# Déployer
firebase deploy --only functions

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Déploiement réussi !${NC}"
    echo ""
    echo "📊 Vérification des logs..."
    echo "  firebase functions:log"
    echo ""
    echo "🔗 URLs des fonctions:"
    echo "  https://us-central1-sentinel-grc-a8701.cloudfunctions.net/createPortalSession"
    echo "  https://us-central1-sentinel-grc-a8701.cloudfunctions.net/createCheckoutSession"
    echo "  https://us-central1-sentinel-grc-a8701.cloudfunctions.net/stripeWebhook"
    echo ""
    echo "✅ Prochaines étapes:"
    echo "  1. Testez le portail Stripe depuis Settings"
    echo "  2. Vérifiez les logs: firebase functions:log"
    echo "  3. Configurez le webhook Stripe si pas encore fait"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Erreur lors du déploiement${NC}"
    echo ""
    echo "Consultez les logs pour plus d'informations"
    exit 1
fi
