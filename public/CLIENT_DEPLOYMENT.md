# 🚀 Guide de Déployment Client - Sentinel GRC Agent

## Contournement Complet de la Signature Apple et Notarisation

Ce guide fournit des solutions complètes pour déployer Sentinel GRC Agent auprès de vos clients sans passer par les processus de signature et notarisation Apple.

## 📋 Options de Déployment

### 1. 🎯 **Installation One-Click (Recommandé pour les clients)**

```bash
./deploy-client.sh
```

Cette commande offre un menu interactif avec 4 options :
- **Installation complète** : Installation système avec contournement Gatekeeper
- **Installation portable** : Exécution depuis Desktop, sans droits admin
- **Package auto-extractible** : Distribution .zip pour déploiement facile
- **Installateur GUI** : Interface graphique conviviale

### 2. 🖥️ **Installation Directe**

```bash
# Installation utilisateur (pas de sudo requis)
./install-client.sh --user

# Installation système (requiert sudo)
sudo ./install-client.sh --system
```

### 3. 📦 **Package Auto-Extractible pour Distribution**

Créez un package .zip que vos clients peuvent télécharger et installer :

```bash
./deploy-client.sh --package
```

Le fichier `SentinelAgent_SelfExtract_2.0.0.zip` sera créé dans le répertoire courant.

### 4. 🎨 **Installateur Graphique**

Pour une expérience utilisateur professionnelle :

```bash
osascript client-installer.applescript
```

Ou directement :
```bash
./deploy-client.sh --gui
```

## 🔧 Fonctionnalités de Contournement

### Bypass Gatekeeper
- Désactivation temporaire de Gatekeeper pendant l'installation
- Suppression des attributs de quarantaine (`com.apple.quarantine`)
- Configuration des permissions d'exécution appropriées

### Installation Portable
- Exécution depuis Desktop sans installation système
- Pas de droits administrateurs requis
- Facile à désinstaller (supprimer le dossier)

### Auto-Signature
- Création de certificat auto-signé pour l'application
- Configuration des bundles macOS appropriés
- Info.plist complet pour compatibilité système

## 📁 Structure des Fichiers Créés

### Installation Complète
```
/Applications/SentinelAgent.app/          # Application système
/usr/local/bin/sentinel-agent             # Ligne de commande
/Library/Application Support/Sentinel GRC/ # Configuration
/var/log/sentinel-agent.log               # Logs système
```

### Installation Utilisateur
```
~/Applications/SentinelAgent.app/        # Application utilisateur
~/.local/bin/sentinel-agent               # Ligne de commande
~/Library/Application Support/Sentinel GRC/ # Configuration
~/Library/Logs/SentinelAgent.log          # Logs utilisateur
```

### Installation Portable
```
~/Desktop/SentinelAgent_Portable/         # Dossier portable
├── SentinelAgent                         # Binaire principal
├── Start Sentinel Agent.command          # Lanceur
├── Stop Sentinel Agent.command           # Arrêt
├── config.json                           # Configuration
└── README.txt                            # Documentation
```

## 🎯 Scénarios d'Utilisation

### Pour les Clients Finaux
1. **Télécharger** le package auto-extractible
2. **Double-cliquer** sur `INSTALL.command`
3. **Suivre** les instructions
4. **Lancer** l'agent depuis Applications ou Desktop

### Pour les Administrateurs IT
1. **Utiliser** `./deploy-client.sh --full` pour déploiement en masse
2. **Déployer** via MDM avec le script d'installation
3. **Configurer** les politiques de conformité via l'agent

### Pour les Développements/Test
1. **Utiliser** `./deploy-client.sh --portable` pour tests rapides
2. **Exécuter** depuis Desktop sans installation
3. **Facilement** désinstallable

## 🔍 Vérification d'Installation

### Commandes de base
```bash
# Vérifier le statut
sentinel-agent --status

# Démarrer l'agent
sentinel-agent --start

# Arrêter l'agent
sentinel-agent --stop

# Vérifier les logs
tail -f ~/Library/Logs/SentinelAgent.log
```

### Vérification système
```bash
# Vérifier l'application
ls -la /Applications/SentinelAgent.app

# Vérifier le service
launchctl list | grep sentinel

# Vérifier les processus
ps aux | grep SentinelAgent
```

## 🛡️ Sécurité et Confiance

### Mesures de Sécurité Implémentées
- ✅ **Vérification d'intégrité** : Hash SHA256 des fichiers
- ✅ **Scan de sécurité** : Détection de patterns malveillants
- ✅ **Validation structure** : Format .pkg et .app vérifiés
- ✅ **Permissions contrôlées** : Droits minimum nécessaires
- ✅ **Journalisation** : Traçabilité complète des actions

### Pour les Clients Soucieux de la Sécurité
1. **Vérifier** le hash SHA256 du package
2. **Consulter** le code source disponible publiquement
3. **Scanner** avec votre antivirus entreprise
4. **Tester** dans un environnement isolé

## 📞 Support et Dépannage

### Problèmes Communs
- **Gatekeeper bloque l'installation** : Utiliser l'option portable
- **Permissions refusées** : Exécuter avec sudo pour installation système
- **Application ne démarre pas** : Vérifier les logs et permissions

### Obtention d'Aide
1. **Vérifier** les logs d'installation
2. **Consulter** la documentation en ligne
3. **Contacter** votre administrateur système
4. **Visiter** https://docs.sentinel-grc.com

## 🔄 Mises à Jour

### Processus de Mise à Jour
1. **Télécharger** la nouvelle version
2. **Exécuter** le script d'installation
3. **L'ancienne version** sera automatiquement remplacée
4. **Configuration** préservée automatiquement

### Mise à Jour Automatisée
```bash
# Script de mise à jour (à planifier via cron)
./deploy-client.sh --full
```

## 📊 Résumé des Avantages

| Avantage | Description |
|----------|-------------|
| 🚀 **Déploiement Rapide** | Installation en une commande |
| 🔓 **Pas de Restrictions Apple** | Contournement complet Gatekeeper |
| 👥 **Multi-Utilisateurs** | Support utilisateur et système |
- 📱 **Interface Graphique** | GUI professionnelle pour les clients |
| 🎒 **Portable** | Option sans installation |
| 📦 **Distribution Facile** | Package auto-extractible |
| 🔒 **Sécurisé** | Vérifications intégrées |
| 📝 **Traçable** | Logs complets |

---

**Version** : 2.0.0  
**Dernière mise à jour** : 2026-02-01  
**Développeur** : Cyber Threat Consulting  
**Support** : support@sentinel-grc.com
