# Sentinel GRC Agent - Guide Utilisateur

## Qu'est-ce que l'Agent Sentinel ?

L'Agent Sentinel est un logiciel de conformité et de sécurité qui s'exécute en arrière-plan sur votre ordinateur. Il vérifie automatiquement que votre poste de travail respecte les politiques de sécurité de votre organisation et détecte les menaces potentielles.

### Ce que fait l'agent :

- **Vérification de conformité** : Analyse les paramètres de sécurité de votre système (CIS, NIS2, ISO 27001, DORA, SOC2)
- **Scan de vulnérabilités** : Détecte les CVE connues sur les paquets installés
- **Surveillance des processus** : Identifie les processus suspects en cours d'exécution
- **Collecte et analyse réseau** : Inventaire des interfaces, connexions actives et routes
- **Surveillance de l'intégrité des fichiers (FIM)** : Détecte les modifications non autorisées sur les fichiers critiques
- **Détection de menaces en temps réel** : Alertes sur les événements USB, processus anormaux et activités suspectes
- **Remédiation automatisée** : Corrige automatiquement certaines non-conformités détectées
- **Interface graphique complète** : Application de bureau native avec 14 pages de visualisation et de gestion
- **Rapport automatique** : Envoie les résultats à la plateforme Sentinel GRC
- **Surveillance continue** : Fonctionne silencieusement en arrière-plan
- **Mises à jour automatiques** : Se met à jour sans intervention

### Ce que l'agent NE fait PAS :

- Ne collecte PAS vos données personnelles
- Ne surveille PAS votre activité (sites web, emails, etc.)
- Ne modifie PAS vos fichiers personnels
- Ne ralentit PAS votre ordinateur (< 1% CPU)
- Ne capture PAS vos frappes clavier ni vos écrans

---

## Interface graphique (GUI)

L'agent dispose d'une interface graphique de bureau native composée de 14 pages, accessible directement depuis l'application.

### Pages disponibles

| Page | Description |
|------|-------------|
| **Tableau de bord** | Vue d'ensemble avec score de conformité, statut de l'agent et utilisation des ressources |
| **Surveillance** | Graphiques temps réel du CPU, mémoire, disque et réseau (egui_plot) |
| **Conformité** | 21 vérifications couvrant CIS, NIS2, ISO 27001, DORA et SOC2 avec filtres et remédiation |
| **Logiciels** | Inventaire complet des paquets et applications installées |
| **Vulnérabilités** | Résultats des scans CVE avec niveau de sévérité |
| **Intégrité fichiers** | Alertes FIM et surveillance des modifications sur les fichiers critiques |
| **Menaces** | Processus suspects, événements USB et alertes de sécurité |
| **Réseau** | Interfaces réseau, connexions actives et tables de routage |
| **Synchronisation** | Historique et état de la synchronisation avec le serveur |
| **Terminal** | Logs en temps réel avec filtres par niveau (debug, info, warn, error) |
| **Découverte** | Scan réseau via ARP, mDNS et SSDP |
| **Cartographie** | Visualisation graphique du réseau découvert |
| **Notifications** | Centre de notifications regroupant toutes les alertes |
| **Paramètres** | Configuration de l'agent, thème clair/sombre, intervalles de vérification |

### Indicateur de synchronisation

La barre latérale affiche un indicateur animé indiquant l'état de synchronisation avec le serveur :

| Couleur | Signification |
|---------|---------------|
| Vert pulsant | Synchronisé (dernière sync < 5 min) |
| Bleu rapide | Synchronisation en cours |
| Orange | En attente (dernière sync > 5 min) |
| Rouge | Erreur de synchronisation |
| Gris | Jamais synchronisé |

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
| Vert | Agent actif et conforme |
| Jaune | Agent en pause |
| Rouge | Erreur ou non-conformité |
| Bleu | Synchronisation en cours |

### Menu contextuel

Cliquez sur l'icône pour accéder au menu :

- **Statut** : Affiche l'état actuel de l'agent
- **Mettre en pause** : Suspend temporairement les vérifications
- **Reprendre** : Reprend les vérifications après une pause
- **Vérifier maintenant** : Lance une vérification immédiate
- **Ouvrir les logs** : Accède aux fichiers journaux
- **Ouvrir l'interface** : Ouvre l'interface graphique de bureau
- **Quitter** : Arrête l'agent (non recommandé)

---

## Configuration

### Fichier de configuration

L'agent utilise un fichier de configuration JSON :

- **macOS** : `~/Library/Application Support/SentinelGRC/agent.json`
- **Linux** : `/etc/sentinel/agent.json`
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

- **macOS** : `~/Library/Application Support/SentinelGRC/logs/`
- **Windows** : `C:\ProgramData\Sentinel\logs\`

---

## Désinstallation

### macOS

1. Quittez l'agent via le menu
2. Supprimez l'application du dossier Applications
3. (Optionnel) Supprimez `~/Library/Application Support/SentinelGRC`

### Windows

1. Ouvrez "Programmes et fonctionnalités"
2. Sélectionnez "Sentinel Agent"
3. Cliquez sur "Désinstaller"

---

## Support

- **Documentation** : docs.cyber-threat-consulting.com
- **Contact** : contact@cyber-threat-consulting.com
- **Interface** : app.cyber-threat-consulting.com

---

## Confidentialité et Sécurité

L'Agent Sentinel est conçu avec la confidentialité comme priorité :

- **Chiffrement** : Toutes les communications sont chiffrées (TLS 1.3)
- **Données minimales** : Seules les données de conformité et de sécurité sont collectées
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
| Paquets installés | Inventaire logiciel | "openssl 3.2.1" |
| Vulnérabilités détectées | Sécurité | "CVE-2024-1234 (critique)" |
| Connexions réseau actives | Analyse réseau | "443/tcp → 192.168.1.1" |
| Processus en cours d'exécution | Détection de menaces | "nom du processus uniquement" |

---

*Version 2.0.0 - Sentinel GRC Agent*
