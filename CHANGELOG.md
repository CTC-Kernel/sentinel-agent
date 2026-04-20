<h1 align="center">JOURNAL DES MODIFICATIONS</h1>

<p align="center">
  <strong>Registre Historique d'Évolution du Sentinel GRC Agent</strong>
</p>

---

Tous les changements notables apportés au projet **Sentinel GRC Agent** sont consignés dans ce document, conformément aux standards du [Versionnage Sémantique](https://semver.org/).

## 🚀 [Non publié]

*Aucun changement non publié.*

---

## 📦 [2.0.219] - 2026-04-13

### 🔧 Modifié
- Centralisation des constantes de configuration Firebase dans `agent-common`.
- Implémentation de l'utilitaire `silent_command()` pour la suppression des terminaux fantômes sous Windows.

### 🛡️ Sécurité
- Élimination des vecteurs d'authentification statiques dans le code source.
- Migration des secrets de certificats vers un stockage cryptographique d'environnement.
- Nettoyage profond de l'historique Git des données sensibles.
- Transition stratégique vers la licence **MIT**.

### 🛡️ Audit de Sécurité (~20 corrections sur 10 fichiers)

#### Fuites d'information et logging
- Correction de la fuite d'URL serveur dans les logs d'incident (`api_client.rs`) — utilisation de `safe_log_url()`.
- Passage de `warn!` à `error!` pour les échecs d'upload de vulnérabilités et d'incidents (`scanning.rs`).
- Passage de `warn!` à `error!` pour les échecs de lecture DB playbooks/règles (`heartbeat.rs`).
- Passage de `warn!` à `error!` pour le poisonnement de mutex avec message explicite sur la corruption (`heartbeat.rs`).
- Ajout d'un `warn!` quand le fichier config existe mais n'a pas de hash baseline (`self_protection.rs`).

#### Débordements d'entiers
- Protection du cast `i64 → u32` pour `get_pending_sync_count()` avec clamping sécurisé (`heartbeat.rs`).
- Protection du cast `i32 → u32` pour `match_count` (`heartbeat.rs`).
- Protection des casts `u32 → i32` pour `match_count` et `escalation_minutes` (`sync_init.rs`, `orchestrator.rs`).

#### Erreurs silencieuses
- Remplacement de `unwrap_or_default()` par `unwrap_or_else` avec logging pour les erreurs JSON playbooks/règles (`heartbeat.rs`).
- Remplacement de 5 occurrences de `unwrap_or_default()` par `unwrap_or_else` avec logging pour les erreurs de sérialisation JSON (`sync_init.rs`).

#### Corrections de robustesse
- Métrique `disk_kbps` : remplacement de `unwrap_or(u32::MAX)` par `unwrap_or(0)` (`resources.rs`).
- Introduction de l'enum `DirectoryRemoveError` pour une détection d'erreur indépendante de la locale (`cleanup.rs`).

#### Dead code
- Correction des gardes `#[cfg]` pour les fonctions GUI-only : ajout de `feature = "gui"` sur 8 fonctions/constantes (`main.rs`).
- Suppression d'un import `std::process::Command` inutilisé.

### 📖 Documentation
- Ajout des README pour 6 crates manquants (agent-common, agent-fim, agent-gui, agent-siem, agent-persistence, agent_llm).
- Mise à jour du README principal avec index de documentation des crates.
- Mise à jour du CHANGELOG, USER_GUIDE et CONTRIBUTING.

---

## 📦 [2.0.218] - 2026-04-12

### 🩹 Corrigé
- Corrections mineures de stabilité.

---

## 📦 [2.0.217] - 2026-03-29

### ✨ Ajouté
- **CMDB & Asset Sync** : Synchronisation automatique des managed assets vers la plateforme GRC (`asset_sync.rs`).
- **Réconciliation CMDB** : Normalisation criticality (snake_case → PascalCase), device_type → ciType/hardwareType.
- **Promotion d'assets** : Trigger `onManagedAssetSync` pour promouvoir les assets agent vers `cmdb_cis`.
- **Pipeline de menaces autonome** (`threat_pipeline.rs`) : Détection → Classification IA → Réponse automatique.
- **Moteur de Playbooks** (`playbook_engine.rs`) : Évaluation de conditions, déclenchement d'actions avec scoring de confiance IA.
- **Actions EDR** (`edr_actions.rs`) : `kill_process`, `quarantine_file`, `block_ip` avec protection anti-tamper (Anti-Draper).
- **Self-Protection** (`self_protection.rs`) : Vérification intégrité binaire SHA-256, détection debugger, monitoring services.
- **Self-Update** (`self_update.rs`) : Mise à jour automatique avec reporting de statut vers la plateforme.
- **Remédiation GUI** (`remediation_ops.rs`) : Exécution d'actions correctives depuis l'interface avec timeout 5 min.
- 9 tests de sécurité EDR (path traversal, symlinks, system path rejection, loopback IP, shell metacharacters).

### 🔧 Modifié
- **Enrollment** : Credentials migrés du document principal vers sous-collection `credentials/main` (enrollment, re-enrollment, cert renewal).
- **Heartbeat** : Ajout du statut `degraded` dans le schema Zod de la plateforme.
- **Severity enum** : Ajout `#[serde(rename_all = "lowercase")]` pour alignement PascalCase→lowercase avec la plateforme.
- **SelfCheckResult** : Ajout des champs agent dans le schema + normalisation dans le heartbeat handler.
- **SecureConfig** : RAII wrapper pour `AgentConfig` avec auto-zeroize on drop, intégré dans `AgentRuntime`.
- **panic="unwind"** dans Cargo.toml (remplace "abort") pour permettre ZeroizeOnDrop.

### 🛡️ Sécurité
- Correction de la capture `hmac_secret` dans `EnrollmentResponse`.
- Documentation mTLS no-op sur Firebase dans `client.rs` et `api.js`.

---

## 📦 [2.0.169] - 2026-03-14

### ✨ Ajouté
- **Heartbeat avancé** (`heartbeat.rs`) : Communication périodique avec métriques, statut et traitement des commandes serveur.
- **Enrollment automatique** (`enrollment.rs`) : Authentification par token JWT avec extraction `organizationId`.
- **Asset Discovery** : Inventaire automatique des endpoints (IP, hostname, MAC, vendor, device_type, criticality).
- **Audit Trail** (`audit_trail.rs`) : Journalisation complète des actions agent.
- **Risk Generation** (`risk_generation.rs`) : Calcul automatique de score de risque.
- **GUI Bridge** (`gui_bridge.rs`) : Pont de communication entre le runtime et l'interface egui.
- **SIEM Enrichment** (`siem_enrichment.rs`) : Enrichissement des données avant export SIEM.
- **Tracing Layer** (`tracing_layer.rs`) : Observabilité structurée avec tracing-appender.
- **Update Manager** (`update_manager.rs`) : Gestion du cycle de mise à jour logicielle.

### 🔧 Modifié
- Migration vers Rust Edition 2024 avec `rust-version = "1.85"`.
- Optimisation des requêtes réseau avec reqwest 0.13 + rustls.
- Amélioration de la persistence GUI (`agent-persistence`).

---

## 📦 [2.0.113] - 2026-02-09

### ✨ Ajouté
- **Core Orchestration** : Workspace Rust modulaire de 12 crates majeures.
- **Premium GUI** : Interface 19 modules (egui) avec monitoring temps réel.
- **Compliance Engine** : 21 contrôles natifs (ISO 27001, NIS2, DORA).
- **Security Suite** : FIM (BLAKE3), Scan CVE, Détection de menaces (processus/réseau).
- **Interopérabilité** : Moteur SIEM pour Splunk, Sentinel et ELK.
- **Scan de vulnérabilités** : Analyse des paquets système contre les bases CVE.
- **Découverte réseau** : Cartographie L2/L3, mDNS, SSDP, ARP.

---

## 📦 [2.0.112] - 2026-02-08

### 🩹 Corrigé
- Optimisation de la capture d'erreurs `notarytool` lors des cycles de signature macOS.

---

## 📦 [2.0.111] - 2026-02-07

### ✨ Ajouté (Version Initiale)
- Redéfinition des raccourcis Windows vers le binaire natif (`.exe`).
- Déploiement automatisé du certificat Root auto-signé via `install-with-cert.bat`.

---

<p align="center">
  <em>Traçabilité et Transparence.</em>
</p>
