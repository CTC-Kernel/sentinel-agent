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

---

## 💻 Interface Graphique (Next-Gen GUI)

Accédez à une visibilité complète via notre tableau de bord immersif composé de 14 modules spécialisés.

| Module | Usage Stratégique |
| :--- | :--- |
| **Tableau de Bord** | Vue holistique du score de sécurité et du statut système. |
| **Surveillance** | Télémétrie temps réel des ressources (CPU, RAM, Disque). |
| **Sécurité/FIM** | Historique des alertes d'intégrité et détection de menaces. |
| **Réseau** | Cartographie de la topologie et découverte passive. |
| **IA/LLM** | Interface de chat pour l'analyse assistée des événements. |

---

## 🚀 Protocoles d'Installation

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
> - **macOS** : `~/Library/Application Support/SentinelGRC/agent.json`
> - **Windows** : `C:\ProgramData\Sentinel\agent.json`

### Structure de Référence
```json
{
  "server_url": "https://votre-instance.sentinel.com",
  "enrollment_token": "TOKEN_ALPHA_SECURE",
  "check_interval_secs": 3600,
  "log_level": "info"
}
```

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
> [!TIP]
> En cas de problème de connexion, vérifiez que le port `443` (HTTPS) est ouvert en sortie vers votre instance Sentinel.

- **Logs Systèmes** : Accessibles directement via l'onglet **Terminal** de l'interface.
- **Assistance** : [***REMOVED***](mailto:***REMOVED***)

---

<p align="center">
  <em>Souveraineté. Sécurité. Excellence.</em><br>
  <strong>Version 2.0.113 - Sentinel GRC Agent</strong>
</p>
