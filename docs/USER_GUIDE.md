# Sentinel GRC Agent - Guide Utilisateur

## Qu'est-ce que l'Agent Sentinel ?

L'Agent Sentinel est un logiciel de conformité qui s'exécute en arrière-plan sur votre ordinateur. Il vérifie automatiquement que votre poste de travail respecte les politiques de sécurité de votre organisation.

### Ce que fait l'agent :

- **Vérification de conformité** : Analyse les paramètres de sécurité de votre système
- **Rapport automatique** : Envoie les résultats à la plateforme Sentinel GRC
- **Surveillance continue** : Fonctionne silencieusement en arrière-plan
- **Mises à jour automatiques** : Se met à jour sans intervention

### Ce que l'agent NE fait PAS :

- Ne collecte PAS vos données personnelles
- Ne surveille PAS votre activité (sites web, emails, etc.)
- Ne modifie PAS vos fichiers
- Ne ralentit PAS votre ordinateur (< 1% CPU)

---

## Installation

### macOS

1. Téléchargez `Sentinel Agent.dmg`
2. Ouvrez le fichier DMG
3. Glissez l'application dans le dossier Applications
4. Lancez "Sentinel Agent" depuis le Launchpad
5. Autorisez l'application si macOS le demande

### Windows

1. Téléchargez `SentinelAgentSetup.exe`
2. Exécutez l'installateur en tant qu'administrateur
3. Suivez les instructions à l'écran
4. L'agent démarre automatiquement

---

## Utilisation

### Icône dans la barre système

Une fois lancé, l'agent apparaît dans votre barre système :
- **macOS** : En haut à droite, près de l'horloge
- **Windows** : En bas à droite, dans la zone de notification

### Couleurs de l'icône

| Couleur | Signification |
|---------|---------------|
| 🟢 Vert | Agent actif et conforme |
| 🟡 Jaune | Agent en pause |
| 🔴 Rouge | Erreur ou non-conformité |
| 🔵 Bleu | Synchronisation en cours |

### Menu contextuel

Cliquez sur l'icône pour accéder au menu :

- **Statut** : Affiche l'état actuel de l'agent
- **Mettre en pause** : Suspend temporairement les vérifications
- **Reprendre** : Reprend les vérifications après une pause
- **Vérifier maintenant** : Lance une vérification immédiate
- **Ouvrir les logs** : Accède aux fichiers journaux
- **Tableau de bord** : Ouvre l'interface web de gestion
- **Quitter** : Arrête l'agent (non recommandé)

---

## Configuration

### Fichier de configuration

L'agent utilise un fichier de configuration JSON :

- **macOS/Linux** : `/etc/sentinel/agent.json`
- **Windows** : `C:\ProgramData\Sentinel\agent.json`

### Paramètres disponibles

```json
{
  "server_url": "https://app.cyber-threat-consulting.com",
  "enrollment_token": "votre-token-ici",
  "check_interval_secs": 3600,
  "log_level": "info"
}
```

| Paramètre | Description | Défaut |
|-----------|-------------|--------|
| `server_url` | URL du serveur Sentinel | app.cyber-threat-consulting.com |
| `enrollment_token` | Token d'enrôlement (requis au 1er lancement) | - |
| `check_interval_secs` | Intervalle entre les vérifications | 3600 (1h) |
| `log_level` | Niveau de log (debug, info, warn, error) | info |

---

## Enrôlement

### Première utilisation

1. Obtenez un token d'enrôlement auprès de votre administrateur
2. Créez le fichier de configuration avec le token
3. Lancez l'agent
4. L'agent s'enregistre automatiquement

### Via l'interface web

1. Connectez-vous à app.cyber-threat-consulting.com
2. Allez dans Paramètres → Agents
3. Cliquez sur "Enrôler un Agent"
4. Copiez le token généré
5. Configurez l'agent avec ce token

---

## Dépannage

### L'agent ne démarre pas

1. Vérifiez que le fichier de configuration existe
2. Vérifiez que le token d'enrôlement est valide
3. Consultez les logs pour plus de détails

### L'agent est hors ligne

1. Vérifiez votre connexion internet
2. Vérifiez que le pare-feu autorise les connexions HTTPS
3. L'agent fonctionne en mode hors ligne jusqu'à 7 jours

### Où trouver les logs ?

- **macOS** : `/var/log/sentinel-grc/`
- **Windows** : `C:\ProgramData\Sentinel\logs\`

---

## Désinstallation

### macOS

1. Quittez l'agent via le menu
2. Supprimez l'application du dossier Applications
3. (Optionnel) Supprimez `/etc/sentinel` et `/var/log/sentinel-grc`

### Windows

1. Ouvrez "Programmes et fonctionnalités"
2. Sélectionnez "Sentinel Agent"
3. Cliquez sur "Désinstaller"

---

## Support

- **Documentation** : docs.cyber-threat-consulting.com
- **Support** : support@cyber-threat-consulting.com
- **Interface** : app.cyber-threat-consulting.com

---

## Confidentialité et Sécurité

L'Agent Sentinel est conçu avec la confidentialité comme priorité :

- **Chiffrement** : Toutes les communications sont chiffrées (TLS 1.3)
- **Données minimales** : Seules les données de conformité sont collectées
- **Pas de keylogger** : L'agent ne capture pas vos frappes clavier
- **Pas de capture d'écran** : L'agent ne prend jamais de screenshots
- **Open audit** : Votre administrateur peut voir exactement ce qui est vérifié

### Données collectées

| Donnée | But | Exemple |
|--------|-----|---------|
| Nom de l'ordinateur | Identification | "MacBook-Pro-de-Jean" |
| Système d'exploitation | Compatibilité | "macOS 14.2" |
| Paramètres de sécurité | Conformité | "FileVault: activé" |
| Score de conformité | Rapport | "85%" |

---

*Version 1.0.0 - Sentinel GRC Agent*
