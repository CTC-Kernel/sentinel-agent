# Package d'Installation Locale - Agent Sentinel GRC

## 📦 Contenu du Package

Ce package contient tout ce dont vous avez besoin pour installer l'Agent Sentinel GRC sans dépendance de téléchargement externe :

### 🚀 Méthodes d'Installation

#### 1. Interface Graphique (Recommandé)
- Double-cliquez sur `Installateur Local Français.app`
- Suivez les instructions en français
- Choisissez les options de démarrage

#### 2. Ligne de Commande
```bash
./installation-locale-francais.sh
```

### 📁 Structure des Fichiers

```
Package Installation Locale/
├── Installateur Local Français.app    # Installeur graphique
├── installation-locale-francais.sh    # Script shell
├── public/
│   └── SentinelAgent-2.0.0.pkg        # Package d'installation
└── README.md                          # Ce fichier
```

### ✅ Fonctionnalités

- **Interface 100% française**
- **Installation locale** - Pas de téléchargement externe
- **Option démarrage automatique** - Au démarrage de macOS
- **Option lancement immédiat** - Après installation
- **Vérification d'intégrité** - Package validé
- **Contournement Gatekeeper** - Installation sans avertissements

### 🔧 Prérequis

- macOS 10.15 (Catalina) ou plus récent
- 50MB d'espace disque disponible
- Accès administrateur (pour l'installation système)

### 🚀 Étapes d'Installation

1. **Décompresser** le package si nécessaire
2. **Lancer** l'installeur graphique ou le script shell
3. **Accepter** le contrat de licence
4. **Choisir** les options de démarrage
5. **Patienter** pendant l'installation
6. **Configurer** l'agent avec votre jeton d'inscription

### 📋 Post-Installation

1. Obtenez votre jeton depuis : https://sentinel-grc-v2-prod.web.app
2. Lancez l'agent depuis Applications ou ligne de commande
3. Inscrivez l'agent : `sentinel-agent enroll VOTRE_JETON`
4. Vérifiez le statut : `sentinel-agent status`

### 🔒 Sécurité

- Package signé et vérifié
- Installation locale sécurisée
- Pas de communication externe pendant l'installation
- Contournement sécurisé de Gatekeeper

### 🆘 Support

- Documentation : https://docs.sentinel-grc.com
- Problèmes : Contacter votre administrateur IT
- Logs : `/var/log/sentinel-agent.log`

### 💡 Notes

- L'agent créera un lien symbolique `/usr/local/bin/sentinel-agent`
- Les fichiers sont installés dans `/Applications/SentinelAgent.app`
- Le démarrage automatique utilise les éléments de connexion macOS
- L'agent apparaîtra dans la barre de menu une fois lancé
