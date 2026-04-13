<h1 align="center">GUIDE UTILISATEUR</h1>

<p align="center">
  <strong>Maîtrise Opérationnelle du Sentinel GRC Agent</strong>
</p>

---

L'**Agent Sentinel GRC** est le pilier de votre posture de sécurité. Ce guide vous accompagne dans l'installation, la configuration et l'utilisation quotidienne de l'agent pour garantir une conformité totale de votre environnement.

## 🛡️ Philosophie de l'Agent

L'agent est conçu pour être à la fois **puissant** et **discret**. Il opère en arrière-plan avec un impact minimal sur vos performances (< 1% CPU).

> [!NOTE]
> **Transparence Totale** : L'agent ne collecte que des métadonnées de sécurité et de conformité. Aucune donnée personnelle, historique de navigation ou contenu de fichier privé n'est transmis.

### Capacités Clés
- **Score de Conformité** : Évaluation continue contre les référentiels CIS et ISO.
- **Vigilance Multi-Vectorielle** : Détection de vulnérabilités, menaces réseau et altérations de fichiers (FIM).
- **Intelligence Locale** : Analyse intelligente des événements via LLM local (MistralRS).
- **CMDB & Assets** : Découverte et synchronisation automatique des endpoints vers la plateforme.
- **Actions EDR** : Réponse automatique aux menaces (kill process, quarantine, block IP).
- **Self-Protection** : Détection de tamper (intégrité binaire, config, debugger).

---

## 🔑 Enrollment (Première Connexion)

Avant de pouvoir communiquer avec la plateforme Sentinel GRC, l'agent doit s'enrôler.

### Obtenir un token d'enrollment
1. Connectez-vous à la plateforme Sentinel GRC en tant qu'administrateur.
2. Allez dans **Paramètres > Agents > Enrollment**.
3. Cliquez sur **Générer un token** — un JWT est créé contenant votre `organizationId`.
4. Copiez le token et configurez-le dans `agent.json` (champ `enrollment_token`).

### Processus d'enrollment
1. Au premier démarrage, l'agent détecte qu'il n'est pas encore enrôlé.
2. Il envoie une `EnrollmentRequest` à la plateforme avec le token JWT.
3. La plateforme vérifie le token, extrait l'`organizationId` et crée les credentials agent.
4. Les credentials sont stockés localement dans une sous-collection sécurisée (`credentials/main`).
5. Un heartbeat de validation confirme que l'enrollment est actif.

> [!NOTE]
> Si l'enrollment échoue, vérifiez que le token n'a pas expiré et que le port 443 est ouvert.

---

## 💓 Heartbeat & Communication

L'agent envoie périodiquement un heartbeat à la plateforme :

| Donnée envoyée | Description |
| :--- | :--- |
| **Statut** | `online`, `degraded`, ou `offline` |
| **Métriques** | CPU, RAM, disque, uptime |
| **Résultats de scan** | Conformité, vulnérabilités, FIM |
| **Self-check** | Intégrité binaire, état des services |

La plateforme peut répondre avec des **commandes** (scan immédiat, mise à jour, changement d'intervalle).

**En cas de perte de connexion** : l'agent continue de fonctionner en mode autonome et stocke les données localement (SQLCipher). La synchronisation reprend automatiquement au rétablissement de la connexion.

---

## 💻 Interface Graphique (Next-Gen GUI)

Accédez à une visibilité complète via notre tableau de bord immersif composé de 19 modules spécialisés.

| Module | Usage Stratégique |
| :--- | :--- |
| **Tableau de Bord** | Vue holistique du score de sécurité et du statut système. |
| **Surveillance** | Télémétrie temps réel des ressources (CPU, RAM, Disque). |
| **Conformité** | Statut de conformité par référentiel (NIS2, DORA, ISO 27001). |
| **Logiciels** | Inventaire des logiciels installés et versions. |
| **Vulnérabilités** | CVE détectées avec prioritisation et scoring. |
| **Sécurité/FIM** | Historique des alertes d'intégrité et détection de menaces. |
| **Menaces** | Centre d'analyse multi-niveaux (événements, timeline, MITRE ATT&CK, playbooks). |
| **Journal d'Audit** | Traçabilité complète des actions agent. |
| **Réseau** | Cartographie de la topologie et connexions actives. |
| **Découverte** | Découverte passive d'appareils réseau. |
| **Cartographie** | Visualisation graphique de la cartographie réseau. |
| **Assets/CMDB** | Inventaire des endpoints découverts et assets managés. |
| **Risques** | Scoring et priorisation des risques. |
| **Rapports** | Génération de rapports de conformité et sécurité. |
| **Notifications** | Centre d'alertes et notifications. |
| **Synchronisation** | Statut de synchronisation avec la plateforme. |
| **Terminal** | Console de logs et diagnostics en temps réel. |
| **IA/LLM** | Interface de chat pour l'analyse assistée des événements. |
| **Paramètres** | Configuration de l'agent et préférences. |

---

## 🚀 Protocoles d'Installation

### 🐧 Linux (Ubuntu, RHEL, Debian)
1. Téléchargez le paquet correspondant à votre distribution (.deb ou .rpm) depuis les GitHub Releases.
2. Installez le paquet :
   ```bash
   # Debian/Ubuntu
   sudo dpkg -i sentinel-agent_2.0.219_amd64.deb

   # RHEL/CentOS
   sudo rpm -i sentinel-agent-2.0.219.x86_64.rpm
   ```
3. Configurez l'agent : `sudo nano /etc/sentinel/agent.json`
4. Démarrez et activez le service :
   ```bash
   sudo systemctl start sentinel-agent
   sudo systemctl enable sentinel-agent
   ```

### 🍏 macOS (Silicon & Intel)
1. Téléchargez l'image disque `SentinelAgent.dmg`.
2. Déployez l'application dans votre dossier `/Applications`.
3. Autorisez les permissions système (Fichiers & Réseau) lors du premier lancement.

### 🪟 Windows (Enterprise Ready)
1. Exécutez `SentinelAgentSetup.exe` avec privilèges Administrateur.
2. Suivez l'assistant de déploiement automatique.
3. L'agent s'enregistre immédiatement comme service système.

---

## ⚙️ Configuration Stratégique

L'agent est piloté par un fichier de configuration structuré (JSON).

> [!IMPORTANT]
> **Localisation du fichier** :
> - **Linux** : `/etc/sentinel/agent.json`
> - **macOS** : `~/Library/Application Support/SentinelGRC/agent.json`
> - **Windows** : `C:\ProgramData\Sentinel\agent.json`

### Structure de Référence
```json
{
  "server_url": "https://votre-instance.sentinel.com",
  "enrollment_token": "eyJhbGciOiJIUzI1NiIs...<JWT contenant organizationId>",
  "check_interval_secs": 3600,
  "heartbeat_interval_secs": 300,
  "vulnerability_scan_interval_secs": 3600,
  "fim_enabled": true,
  "auto_remediation": false,
  "siem_endpoint": "",
  "log_level": "info"
}
```

> [!TIP]
> Les champs peuvent être surchargés par des variables d'environnement `SENTINEL_*` (voir `config/README.md`).
> L'intervalle du heartbeat est dynamique : le serveur peut l'ajuster via sa réponse.

---

## 🚦 Indicateurs de Statut

L'icône dans votre barre système (Tray) reflète l'état de santé en temps réel :

- 🟢 **Vert** : Système conforme et sécurisé.
- 🔵 **Bleu Animé** : Synchronisation ou mise à jour en cours.
- 🟡 **Jaune** : Agent en pause ou vérification différée.
- 🔴 **Rouge** : **ALERTE CRITIQUE**. Une non-conformité ou une menace a été détectée.

---

## 🆘 Support & Dépannage

### Diagnostic Rapide

| Problème | Solution |
| :--- | :--- |
| **Enrollment échoue** | Vérifier que le token JWT n'est pas expiré. Régénérer depuis la plateforme si nécessaire. |
| **Heartbeat en erreur** | Vérifier connectivité réseau (port 443 HTTPS ouvert en sortie). |
| **Statut "degraded"** | Un ou plusieurs checks ont échoué. Consulter l'onglet Sécurité pour les détails. |
| **Statut "offline" sur la plateforme** | L'agent n'a pas envoyé de heartbeat. Vérifier que le service est actif (`systemctl status sentinel-agent`). |
| **Assets non synchronisés** | Vérifier que l'enrollment est valide. Les assets se synchronisent après chaque heartbeat. |
| **EDR action échoue** | Vérifier les privilèges (administrateur/root requis pour kill/quarantine/block). |
| **Self-update bloqué** | Vérifier l'accès aux GitHub Releases. Timeout de 5 minutes par défaut. |

> [!TIP]
> En cas de problème de connexion, vérifiez que le port `443` (HTTPS) est ouvert en sortie vers votre instance Sentinel.

- **Logs Systèmes** : Accessibles directement via l'onglet **Terminal** de l'interface.
- **Logs fichier** : `journalctl -u sentinel-agent -f` (Linux) ou Event Viewer (Windows).
- **Mode debug** : `sentinel-agent --log-level debug` pour des logs détaillés.
- **Assistance** : [contact@cyber-threat-consulting.com](mailto:contact@cyber-threat-consulting.com)

---

<p align="center">
  <em>Souveraineté. Sécurité. Excellence.</em><br>
  <strong>Version 2.0.219 - Sentinel GRC Agent</strong>
</p>
