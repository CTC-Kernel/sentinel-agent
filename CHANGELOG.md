<h1 align="center">JOURNAL DES MODIFICATIONS</h1>

<p align="center">
  <strong>Registre Historique d'Évolution du Sentinel GRC Agent</strong>
</p>

---

Tous les changements notables apportés au projet **Sentinel GRC Agent** sont consignés dans ce document, conformément aux standards du [Versionnage Sémantique](https://semver.org/).

## 🚀 [Non publié]

### 🔧 Modifié
- Centralisation des constantes de configuration Firebase dans `agent-common`.
- Implémentation de l'utilitaire `silent_command()` pour la suppression des terminaux fantômes sous Windows.

### 🛡️ Sécurité
- Élimination des vecteurs d'authentification statiques dans le code source.
- Migration des secrets de certificats vers un stockage cryptographique d'environnement.
- Nettoyage profond de l'historique Git des données sensibles.
- Transition stratégique vers la licence **MIT**.

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
- **Scan de vulnérabilités** : Analyse des paquets système contre les bases CVE.
- **Interface 14 modules** : Dashboard egui avec monitoring temps réel.
- **FIM BLAKE3/SHA2** : Surveillance d'intégrité des fichiers critiques.
- **Découverte réseau** : Cartographie L2/L3, mDNS, SSDP, ARP.
- **Connecteurs SIEM** : Export Splunk, Sentinel, ELK.

---

## 📦 [2.0.112] - 2026-02-28

### 🩹 Corrigé
- Optimisation de la capture d'erreurs `notarytool` lors des cycles de signature macOS.

---

## 📦 [2.0.111] - 2026-02-27

### 🩹 Corrigé
- Redéfinition des raccourcis Windows vers le binaire natif (`.exe`).
- Déploiement automatisé du certificat Root auto-signé via `install-with-cert.bat`.

---

## 📦 [2.0.113] - 2026-02-09 (Version Initiale)

### ✨ Ajouté
- **Core Orchestration** : Workspace Rust modulaire de 12 crates majeures.
- **Premium GUI** : Interface 14 modules (egui) avec monitoring temps réel.
- **Compliance Engine** : 21 contrôles natifs (ISO 27001, NIS2, DORA).
- **Security Suite** : FIM (BLAKE3), Scan CVE, Détection de menaces (processus/réseau).
- **Interopérabilité** : Moteur SIEM pour Splunk, Sentinel et ELK.

---

<p align="center">
  <em>Traçabilité et Transparence.</em>
</p>
