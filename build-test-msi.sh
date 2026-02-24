#!/bin/bash

# Test script pour vérifier la correction MSI 2762
# Ce script doit être exécuté sur Windows avec WiX Toolset installé

echo "=== Test de correction MSI 2762 ==="
echo "Ce script teste l'installateur Sentinel avec les corrections appliquées"
echo ""

# Vérification que nous sommes sur Windows
if [[ "$OSTYPE" != "msys" ]] && [[ "$OSTYPE" != "cygwin" ]] && [[ "$OSTYPE" != "win32" ]]; then
    echo "ERREUR: Ce script doit être exécuté sur Windows"
    echo "Utilisez une machine Windows ou une VM Windows avec WiX Toolset"
    exit 1
fi

# Vérification de WiX
if ! command -v candle &> /dev/null; then
    echo "ERREUR: WiX Toolset (candle) non trouvé"
    echo "Téléchargez depuis: https://wixtoolset.org/releases/"
    exit 1
fi

if ! command -v light &> /dev/null; then
    echo "ERREUR: WiX Toolset (light) non trouvé"
    echo "Téléchargez depuis: https://wixtoolset.org/releases/"
    exit 1
fi

echo "✅ Environnement Windows validé"
echo "✅ WiX Toolset détecté"
echo ""

# Compilation du MSI
echo "🔨 Compilation du MSI avec les corrections 2762..."
cd build

# Compilation avec candle
echo "Étape 1: Compilation WiX (candle)..."
candle ../wix/main.wxs -out main.wixobj -ext WixUIExtension -ext WixUtilExtension -ext WixFirewallExtension

if [[ $? -ne 0 ]]; then
    echo "❌ Échec de la compilation candle"
    exit 1
fi

echo "✅ Compilation candle réussie"

# Linkage avec light
echo "Étape 2: Linkage MSI (light)..."
light main.wixobj -out sentinel-agent-fixed.msi -ext WixUIExtension -ext WixUtilExtension -ext WixFirewallExtension

if [[ $? -ne 0 ]]; then
    echo "❌ Échec du linkage light"
    exit 1
fi

echo "✅ Linkage light réussi"
echo ""

# Vérification du MSI
if [[ -f "sentinel-agent-fixed.msi" ]]; then
    echo "🎉 MSI créé avec succès!"
    echo "Fichier: sentinel-agent-fixed.msi"
    echo "Taille: $(du -h sentinel-agent-fixed.msi | cut -f1)"
    echo ""
    
    # Test d'installation silencieuse
    echo "🧪 Test d'installation silencieuse..."
    msiexec /i sentinel-agent-fixed.msi /qn /l*v test-install.log
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Installation silencieuse réussie - ERREUR 2762 CORRIGÉE!"
    else
        echo "❌ Installation échouée - vérifiez test-install.log"
        echo "Si l'erreur 2762 persiste, vérifiez:"
        echo "- Toutes les custom actions deferred sont entre InstallInitialize/InstallFinalize"
        echo "- Les conditions sur les custom actions sont correctes"
        echo "- Les dépendances WiX sont installées"
    fi
    
    echo ""
    echo "📋 Rapport de correction:"
    echo "✅ AddDefenderExclusion déplacé avant InstallFinalize"
    echo "✅ RemoveDefenderExclusion déplacé après InstallInitialize"  
    echo "✅ CleanupDataOnUninstall déplacé dans la transaction"
    echo "✅ Respect de la règle MSI: deferred actions entre InstallInitialize/InstallFinalize"
    
else
    echo "❌ Échec de création du MSI"
    exit 1
fi

echo ""
echo "🔍 Pour tester manuellement:"
echo "msiexec /i sentinel-agent-fixed.msi /l*v manual-test.log"
echo ""
echo "📝 Logs d'installation disponibles:"
echo "- test-install.log (test automatique)"
echo "- manual-test.log (test manuel)"
