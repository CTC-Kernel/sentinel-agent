#!/bin/bash

# Agent Sentinel GRC - Installation Locale Française
# Installation sans dépendance de téléchargement externe

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🍎 Agent Sentinel GRC - Installation Locale Française${NC}"
echo -e "${BLUE}=====================================================${NC}"

# Vérifier si on est sur macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ Ce script est pour macOS uniquement${NC}"
    exit 1
fi

# Vérifier si on n'est pas en root
if [[ $EUID -eq 0 ]]; then
    echo -e "${YELLOW}⚠️  Veuillez exécuter ce script en tant qu'utilisateur normal, pas en root${NC}"
    exit 1
fi

# Répertoires
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_PATH="$SCRIPT_DIR/public/SentinelAgent-2.0.0.pkg"
INSTALL_PATH="/Applications/Sentinel GRC"

echo -e "${YELLOW}📦 Vérification du package local...${NC}"

# Vérifier si le package existe
if [[ ! -f "$PACKAGE_PATH" ]]; then
    echo -e "${RED}❌ Package non trouvé : $PACKAGE_PATH${NC}"
    echo -e "${YELLOW}💡 Assurez-vous que le fichier SentinelAgent-2.0.0.pkg est dans le répertoire public/${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Package trouvé localement${NC}"

# Vérifier l'intégrité du package
echo -e "${YELLOW}🔍 Vérification de l'intégrité du package...${NC}"

if pkgutil --expand "$PACKAGE_PATH" "/tmp/sentinel-verify" 2>/dev/null; then
    echo -e "${GREEN}✅ Vérification du package réussie${NC}"
    rm -rf "/tmp/sentinel-verify"
else
    echo -e "${RED}❌ Échec de la vérification du package${NC}"
    exit 1
fi

echo -e "${YELLOW}🔓 Préparation de l'installation (contournement Gatekeeper)...${NC}"

# Supprimer l'attribut de quarantaine
xattr -d com.apple.quarantine "$PACKAGE_PATH" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Impossible de supprimer l'attribut de quarantaine (c'est normal)${NC}"
}

echo -e "${YELLOW}🚀 Début de l'installation...${NC}"

# Installer le package
sudo installer -pkg "$PACKAGE_PATH" -target /

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Installation terminée avec succès !${NC}"
else
    echo -e "${RED}❌ Échec de l'installation${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Étapes post-installation :${NC}"
echo -e "${YELLOW}1. Lancez l'Agent Sentinel depuis Applications${NC}"
echo -e "${YELLOW}2. Obtenez votre jeton d'inscription depuis : https://sentinel-grc-v2-prod.web.app${NC}"
echo -e "${YELLOW}3. Configurez l'agent avec votre jeton${NC}"

echo -e "${GREEN}🎉 L'Agent Sentinel GRC est maintenant installé !${NC}"
echo -e "${BLUE}Documentation : https://docs.sentinel-grc.com${NC}"

# Demander si l'utilisateur veut lancer l'agent
read -p "Voulez-vous lancer l'Agent Sentinel maintenant ? (o/n) : " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    open "/Applications/SentinelAgent.app"
    echo -e "${GREEN}✅ Agent Sentinel lancé${NC}"
fi

# Demander si l'utilisateur veut le démarrage automatique
read -p "Voulez-vous que l'Agent Sentinel démarre automatiquement au démarrage de macOS ? (o/n) : " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    osascript -e 'tell application "System Events" to make login item at end with properties {path:"/Applications/SentinelAgent.app", hidden:false}'
    echo -e "${GREEN}✅ Démarrage automatique configuré${NC}"
fi

echo -e "${YELLOW}💡 Astuce : L'agent démarrera automatiquement à la connexion si vous avez choisi cette option${NC}"
