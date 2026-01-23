---
stepsCompleted: [1, 2]
inputDocuments: ['prd-agent-grc.md', 'architecture-agent-grc.md']
project_name: 'Agent GRC Sentinel'
---

# Agent GRC Sentinel - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Agent GRC Sentinel, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Agent Core (FR1-FR8):**
- FR1: L'agent peut s'installer silencieusement sur Windows 10+ sans redémarrage
- FR2: L'agent peut s'installer silencieusement sur Linux (Ubuntu 20.04+, RHEL 8+) via package manager
- FR3: L'agent peut s'exécuter en tant que service système avec démarrage automatique
- FR4: L'agent peut se configurer via fichier JSON ou variables d'environnement
- FR5: L'agent peut s'enregistrer auprès du SaaS Sentinel avec token d'authentification
- FR6: L'agent peut envoyer un heartbeat périodique (état, métriques) au SaaS
- FR7: L'agent peut se désinstaller proprement sans laisser de résidus
- FR8: L'agent peut fonctionner avec une empreinte ressources minimale (< 2% CPU, < 100MB RAM)

**Compliance Checks (FR9-FR22):**
- FR9: L'agent peut exécuter des checks de conformité selon les règles configurées
- FR10: L'agent peut vérifier l'état du chiffrement disque (BitLocker/LUKS)
- FR11: L'agent peut vérifier l'état de l'antivirus (actif, définitions à jour)
- FR12: L'agent peut vérifier l'état du pare-feu (activé, règles)
- FR13: L'agent peut vérifier la politique de mot de passe (complexité, expiration)
- FR14: L'agent peut vérifier le verrouillage automatique de session
- FR15: L'agent peut vérifier l'état des mises à jour système
- FR16: L'agent peut vérifier les protocoles obsolètes désactivés (SMBv1, TLS 1.0/1.1)
- FR17: L'agent peut vérifier la configuration sauvegarde (active, date dernière)
- FR18: L'agent peut vérifier les comptes administrateurs locaux
- FR19: L'agent peut vérifier la configuration MFA si applicable
- FR20: L'agent peut vérifier la sécurité du bureau à distance (NLA/SSH hardened)
- FR21: L'agent peut générer une preuve horodatée pour chaque check exécuté
- FR22: L'agent peut calculer un score de conformité local basé sur les résultats

**Synchronization & Offline (FR23-FR30):**
- FR23: L'agent peut télécharger les règles de checks depuis le SaaS
- FR24: L'agent peut mettre en cache les règles localement pour exécution offline
- FR25: L'agent peut stocker les résultats de checks et preuves localement (SQLite)
- FR26: L'agent peut fonctionner en mode offline pendant 7 jours minimum
- FR27: L'agent peut synchroniser les données en attente lors du retour de connectivité
- FR28: L'agent peut gérer les conflits de synchronisation après période offline
- FR29: L'agent peut télécharger sa configuration depuis le SaaS
- FR30: L'agent peut uploader les résultats de checks vers le SaaS

**Dashboard & Visualization - SaaS (FR31-FR38):**
- FR31: Le RSSI peut visualiser le score de conformité global de son parc
- FR32: Le RSSI peut visualiser le score de conformité par endpoint
- FR33: Le RSSI peut visualiser les écarts de conformité détaillés par check
- FR34: Le RSSI peut visualiser la tendance historique du score (30 jours minimum)
- FR35: Le RSSI peut filtrer la vue par référentiel (NIS2, DORA, RGPD)
- FR36: Le RSSI peut filtrer la vue par statut de conformité (conforme, non-conforme)
- FR37: Le RSSI peut recevoir une alerte lors de dégradation du score
- FR38: Le DPO peut visualiser une vue filtrée RGPD des endpoints

**Administration (FR39-FR47):**
- FR39: L'administrateur IT peut visualiser la liste des agents déployés
- FR40: L'administrateur IT peut visualiser l'état de connexion de chaque agent
- FR41: L'administrateur IT peut visualiser la version de chaque agent
- FR42: L'administrateur IT peut télécharger les packages d'installation (MSI, DEB, RPM)
- FR43: L'administrateur IT peut générer un token d'enregistrement pour nouveaux agents
- FR44: L'administrateur IT peut configurer la fréquence des checks
- FR45: L'administrateur IT peut activer/désactiver des checks spécifiques
- FR46: L'administrateur IT peut forcer une synchronisation d'un agent
- FR47: L'administrateur IT peut désinscrire un agent du parc

**Audit & Reporting (FR48-FR54):**
- FR48: L'auditeur peut accéder en lecture seule aux données de conformité
- FR49: L'auditeur peut visualiser les preuves techniques horodatées
- FR50: L'auditeur peut exporter un rapport de conformité par référentiel (PDF)
- FR51: L'auditeur peut visualiser l'historique de conformité sur 12 mois
- FR52: Le système peut conserver les preuves pendant 12 mois minimum
- FR53: Le système peut horodater chaque preuve au format ISO 8601 UTC
- FR54: Le système peut garantir l'intégrité des preuves (hash SHA-256)

**Security & Authentication (FR55-FR61):**
- FR55: L'agent peut s'authentifier auprès du SaaS via mTLS
- FR56: L'agent peut valider le certificat serveur (certificate pinning)
- FR57: L'agent peut vérifier sa propre intégrité au démarrage (self-check)
- FR58: L'agent peut chiffrer les données stockées localement
- FR59: L'agent peut signer les logs pour garantir leur intégrité
- FR60: Le système peut valider la signature du binaire agent avant installation
- FR61: Le système peut révoquer un agent compromis à distance

**Updates & Deployment (FR62-FR68):**
- FR62: L'agent peut vérifier la disponibilité d'une nouvelle version
- FR63: L'agent peut télécharger et appliquer une mise à jour automatiquement
- FR64: L'agent peut effectuer un rollback vers la version précédente en cas d'échec
- FR65: Le système peut déployer les mises à jour par phases (staged rollout)
- FR66: L'administrateur peut configurer la politique de mise à jour (automatique, manuel, différé)
- FR67: L'administrateur peut déclencher une mise à jour manuelle sur un agent
- FR68: L'administrateur peut bloquer une version spécifique

**Support & Diagnostics (FR69-FR72):**
- FR69: L'équipe support peut visualiser les logs d'un agent spécifique
- FR70: L'équipe support peut visualiser l'état de connexion détaillé d'un agent
- FR71: L'équipe support peut identifier les erreurs récentes d'un agent
- FR72: L'équipe support peut déclencher un diagnostic à distance

### Non-Functional Requirements

**Performance (NFR-P1 to NFR-P10):**
- NFR-P1: Impact CPU agent au repos < 0.5%
- NFR-P2: Impact CPU agent pendant check < 5%
- NFR-P3: Consommation mémoire agent < 100 MB
- NFR-P4: Taille binaire agent < 20 MB
- NFR-P5: Temps démarrage agent < 5s
- NFR-P6: Temps exécution check unitaire < 2s
- NFR-P7: Temps exécution scan complet (20 checks) < 30s
- NFR-P8: Latence heartbeat < 1s (p95)
- NFR-P9: Temps synchronisation post-offline < 5 min
- NFR-P10: Impact I/O disque < 10 IOPS moyen

**Security (NFR-S1 to NFR-S11):**
- NFR-S1: Chiffrement transport TLS 1.3 minimum, mTLS obligatoire
- NFR-S2: Chiffrement stockage local SQLite avec SQLCipher (AES-256)
- NFR-S3: Signature binaire Windows Authenticode avec certificat EV
- NFR-S4: Signature binaire Linux GPG avec clé dédiée
- NFR-S5: Certificate pinning empreinte SHA-256 du certificat serveur
- NFR-S6: Intégrité runtime Self-check SHA-256 au démarrage
- NFR-S7: Protection credentials jamais stockés en clair, token rotatif
- NFR-S8: Logs signés HMAC-SHA256 pour chaque entrée
- NFR-S9: Permissions fichiers 0600 (Linux) / ACL restrictives (Windows)
- NFR-S10: Isolation processus service dédié, pas de shell externe
- NFR-S11: Audit vulnérabilités cargo-audit CI, pentest externe avant GA

**Reliability (NFR-R1 to NFR-R8):**
- NFR-R1: Uptime agent ≥ 99.5%
- NFR-R2: Mode offline ≥ 7 jours
- NFR-R3: Récupération crash redémarrage automatique < 30s
- NFR-R4: Perte données offline 0%
- NFR-R5: Rollback update < 2 min
- NFR-R6: Tolérance réseau retry avec backoff jusqu'à 24h
- NFR-R7: Corruption données détection et récupération automatique
- NFR-R8: Watchdog service détection agent bloqué < 60s

**Scalability (NFR-SC1 to NFR-SC6):**
- NFR-SC1: Agents simultanés 10 000+ par tenant
- NFR-SC2: Agents totaux plateforme 100 000+
- NFR-SC3: Heartbeats simultanés 500 req/s
- NFR-SC4: Upload résultats 200 req/s
- NFR-SC5: Stockage preuves < 50 MB par endpoint/mois
- NFR-SC6: Dégradation performance < 20% latence à 10x charge

**Compliance (NFR-C1 to NFR-C8):**
- NFR-C1: Localisation données EU uniquement
- NFR-C2: Rétention preuves 12 mois minimum
- NFR-C3: Horodatage preuves ISO 8601 UTC, source NTP
- NFR-C4: Intégrité preuves Hash SHA-256 signé
- NFR-C5: Audit trail toute modification tracée avec acteur
- NFR-C6: Droit à l'oubli suppression données agent possible
- NFR-C7: Export données format structuré JSON sur demande
- NFR-C8: Sous-traitants conformité RGPD avec clauses contractuelles

**Integration (NFR-I1 to NFR-I8):**
- NFR-I1: Protocole API REST/HTTPS, JSON
- NFR-I2: Authentification API Bearer token + mTLS
- NFR-I3: Compatibilité proxy HTTP/SOCKS5 avec authentification
- NFR-I4: Ports réseau 443 uniquement
- NFR-I5: Déploiement Windows GPO, SCCM, Intune compatible
- NFR-I6: Déploiement Linux apt, yum, Ansible compatible
- NFR-I7: Format logs JSON structuré, compatible SIEM
- NFR-I8: Compression gzip pour tous les transfers

**Maintainability (NFR-M1 to NFR-M8):**
- NFR-M1: Couverture tests ≥ 80%
- NFR-M2: Documentation code Rustdoc pour modules publics
- NFR-M3: CI/CD Build + tests automatiques sur PR
- NFR-M4: Versioning SemVer strict
- NFR-M5: Backward compatibility API stable sur version majeure
- NFR-M6: Logging structuré tracing avec niveaux
- NFR-M7: Métriques runtime CPU, RAM, état checks exposés
- NFR-M8: Cross-compile build unique pour Windows + Linux

**Usability - Dashboard SaaS (NFR-U1 to NFR-U4):**
- NFR-U1: Temps chargement dashboard < 3s initial, < 1s navigation
- NFR-U2: Responsive design Desktop + tablette
- NFR-U3: Langues supportées FR, EN, DE
- NFR-U4: Export données PDF, CSV, JSON

### Additional Requirements (from Architecture)

**Starter Template:**
- Architecture specifies Cargo Workspace multi-crates as project structure
- Initialization command defined for Epic 1 Story 1
- 6 crates: agent-common, agent-system, agent-storage, agent-scanner, agent-sync, agent-core

**Implementation Sequence (Architecture-defined):**
1. agent-common → Types, Config, Error
2. agent-storage → SQLite + SQLCipher
3. agent-system → Windows + Linux abstraction
4. agent-sync → HTTP client + mTLS
5. agent-scanner → 20 checks NIS2/DORA
6. agent-core → Main + Service + Scheduler

**Technical Decisions impacting implementation:**
- SQLite schema with 5 normalized tables (agent_config, check_rules, check_results, proofs, sync_queue)
- mTLS authentication with API Key for enrollment
- SQLCipher AES-256 encryption for local storage
- JSON with gzip compression for API payloads
- Exponential backoff with circuit breaker for retry
- Shadow copy update mechanism with rollback
- Structured logging with tracing + JSON upload

**Security Requirements (Architecture):**
- Code signing: Authenticode (Windows), GPG (Linux)
- Certificate pinning for server validation
- Self-integrity check at startup
- Signed logs with HMAC-SHA256

**CI/CD Requirements:**
- cargo fmt --check
- cargo clippy -- -D warnings
- cargo deny check
- cargo test
- cargo build --release
- cargo xtask sign (release only)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 2 | Installation Windows silencieuse |
| FR2 | Epic 2 | Installation Linux via package manager |
| FR3 | Epic 2 | Service système avec démarrage auto |
| FR4 | Epic 2 | Configuration via JSON/env vars |
| FR5 | Epic 4 | Enregistrement SaaS avec token |
| FR6 | Epic 4 | Heartbeat périodique |
| FR7 | Epic 2 | Désinstallation propre |
| FR8 | Epic 2 | Empreinte ressources minimale |
| FR9 | Epic 5 | Exécution checks conformité |
| FR10 | Epic 5 | Vérification chiffrement disque |
| FR11 | Epic 5 | Vérification antivirus |
| FR12 | Epic 5 | Vérification pare-feu |
| FR13 | Epic 5 | Vérification politique mot de passe |
| FR14 | Epic 5 | Vérification verrouillage session |
| FR15 | Epic 5 | Vérification mises à jour système |
| FR16 | Epic 5 | Vérification protocoles obsolètes |
| FR17 | Epic 5 | Vérification configuration sauvegarde |
| FR18 | Epic 5 | Vérification comptes admin locaux |
| FR19 | Epic 5 | Vérification MFA |
| FR20 | Epic 5 | Vérification bureau à distance |
| FR21 | Epic 5 | Génération preuve horodatée |
| FR22 | Epic 5 | Calcul score conformité local |
| FR23 | Epic 6 | Téléchargement règles depuis SaaS |
| FR24 | Epic 6 | Cache règles local |
| FR25 | Epic 3 | Stockage résultats SQLite |
| FR26 | Epic 6 | Mode offline 7 jours |
| FR27 | Epic 6 | Synchronisation retour connectivité |
| FR28 | Epic 6 | Gestion conflits sync |
| FR29 | Epic 6 | Téléchargement config SaaS |
| FR30 | Epic 6 | Upload résultats vers SaaS |
| FR31 | Epic 7 | Visualisation score global |
| FR32 | Epic 7 | Visualisation score par endpoint |
| FR33 | Epic 7 | Visualisation écarts détaillés |
| FR34 | Epic 7 | Tendance historique 30 jours |
| FR35 | Epic 7 | Filtre par référentiel |
| FR36 | Epic 7 | Filtre par statut conformité |
| FR37 | Epic 7 | Alerte dégradation score |
| FR38 | Epic 7 | Vue filtrée DPO RGPD |
| FR39 | Epic 8 | Liste agents déployés |
| FR40 | Epic 8 | État connexion agents |
| FR41 | Epic 8 | Version agents |
| FR42 | Epic 8 | Téléchargement packages |
| FR43 | Epic 8 | Génération token enregistrement |
| FR44 | Epic 8 | Configuration fréquence checks |
| FR45 | Epic 8 | Activation/désactivation checks |
| FR46 | Epic 8 | Force sync agent |
| FR47 | Epic 8 | Désinscription agent |
| FR48 | Epic 9 | Accès auditeur lecture seule |
| FR49 | Epic 9 | Visualisation preuves techniques |
| FR50 | Epic 9 | Export rapport PDF |
| FR51 | Epic 9 | Historique 12 mois |
| FR52 | Epic 3 | Conservation preuves 12 mois |
| FR53 | Epic 3 | Horodatage ISO 8601 UTC |
| FR54 | Epic 3 | Intégrité preuves SHA-256 |
| FR55 | Epic 4 | Authentification mTLS |
| FR56 | Epic 4 | Certificate pinning |
| FR57 | Epic 4 | Self-check intégrité démarrage |
| FR58 | Epic 3 | Chiffrement données locales |
| FR59 | Epic 11 | Signature logs |
| FR60 | Epic 11 | Validation signature binaire |
| FR61 | Epic 11 | Révocation agent à distance |
| FR62 | Epic 10 | Vérification nouvelle version |
| FR63 | Epic 10 | Téléchargement mise à jour auto |
| FR64 | Epic 10 | Rollback version précédente |
| FR65 | Epic 10 | Déploiement par phases |
| FR66 | Epic 10 | Configuration politique update |
| FR67 | Epic 10 | Mise à jour manuelle |
| FR68 | Epic 10 | Blocage version spécifique |
| FR69 | Epic 12 | Visualisation logs agent |
| FR70 | Epic 12 | État connexion détaillé |
| FR71 | Epic 12 | Identification erreurs récentes |
| FR72 | Epic 12 | Diagnostic à distance |

## Epic List

### Epic 1: Foundation & Development Setup
**Goal:** L'équipe de développement peut initialiser, builder et tester le projet agent avec une structure Cargo Workspace conforme à l'architecture.

**FRs couverts:** Architecture requirements (Cargo Workspace, CI/CD)
**NFRs couverts:** NFR-M1 à NFR-M8 (Maintainability)

**Scope:**
- Initialisation Cargo Workspace multi-crates
- Configuration CI/CD (GitHub Actions)
- Setup cargo-audit, cargo-deny, clippy
- Structure projet complète (150+ fichiers)

---

### Epic 2: Agent Core & Service Lifecycle
**Goal:** L'administrateur IT peut déployer l'agent sur les endpoints Windows et Linux comme service système avec installation silencieuse.

**FRs couverts:** FR1, FR2, FR3, FR4, FR7, FR8
**NFRs couverts:** NFR-P1 à NFR-P5, NFR-I5, NFR-I6

**Scope:**
- Installation silencieuse Windows (MSI) et Linux (DEB/RPM)
- Service système avec démarrage automatique
- Configuration via JSON/variables environnement
- Désinstallation propre
- Empreinte ressources minimale (<2% CPU, <100MB RAM)

---

### Epic 3: Secure Local Storage
**Goal:** L'agent peut stocker les données de conformité de manière sécurisée et chiffrée localement avec intégrité garantie.

**FRs couverts:** FR25, FR52, FR53, FR54, FR58
**NFRs couverts:** NFR-S2, NFR-C2, NFR-C3, NFR-C4

**Scope:**
- Base SQLite avec SQLCipher (AES-256)
- Schéma 5 tables (agent_config, check_rules, check_results, proofs, sync_queue)
- Horodatage ISO 8601 UTC
- Hash SHA-256 pour intégrité preuves
- Conservation 12 mois

---

### Epic 4: Agent-SaaS Connectivity
**Goal:** L'agent peut se connecter de façon sécurisée au SaaS Sentinel et l'administrateur voit l'agent en ligne dans la console.

**FRs couverts:** FR5, FR6, FR55, FR56, FR57
**NFRs couverts:** NFR-S1, NFR-S5, NFR-S6, NFR-S7, NFR-I1, NFR-I2, NFR-I4

**Scope:**
- Enrollment avec token API + génération certificat mTLS
- Heartbeat périodique avec métriques
- Certificate pinning SHA-256
- Self-check intégrité au démarrage
- Communication port 443 uniquement

---

### Epic 5: Compliance Check Engine
**Goal:** L'agent vérifie les 20 points de conformité NIS2/DORA sur l'endpoint et génère les preuves horodatées avec score.

**FRs couverts:** FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22
**NFRs couverts:** NFR-P6, NFR-P7

**Scope:**
- Check runner avec scheduler
- 20 checks: chiffrement, AV, firewall, password, MFA, etc.
- Génération preuve horodatée par check
- Calcul score conformité local
- Abstraction Windows/Linux pour chaque check

---

### Epic 6: Synchronization & Offline Mode
**Goal:** L'agent fonctionne en mode déconnecté pendant 7 jours et synchronise automatiquement au retour de connectivité sans perte de données.

**FRs couverts:** FR23, FR24, FR26, FR27, FR28, FR29, FR30
**NFRs couverts:** NFR-R2, NFR-R4, NFR-R6, NFR-P9

**Scope:**
- Téléchargement et cache règles localement
- Queue de synchronisation avec retry exponential backoff
- Mode offline 7 jours minimum
- Réconciliation conflits après reconnexion
- Upload résultats vers SaaS

---

### Epic 7: Dashboard & Compliance Visualization (SaaS)
**Goal:** Le RSSI visualise le score de conformité global et par endpoint avec filtres par référentiel et alertes de dégradation.

**FRs couverts:** FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38
**NFRs couverts:** NFR-U1 à NFR-U4

**Scope:**
- Score conformité global parc
- Score par endpoint avec détail écarts
- Tendance historique 30 jours
- Filtres NIS2, DORA, RGPD
- Alertes dégradation score
- Vue DPO filtrée RGPD

---

### Epic 8: Agent Fleet Administration (SaaS)
**Goal:** L'administrateur IT gère l'ensemble des agents déployés depuis la console SaaS avec génération tokens et configuration à distance.

**FRs couverts:** FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46, FR47
**NFRs couverts:** NFR-SC1, NFR-SC2

**Scope:**
- Liste agents avec état connexion et version
- Téléchargement packages (MSI, DEB, RPM)
- Génération tokens d'enregistrement
- Configuration fréquence et activation checks
- Force sync et désinscription agents

---

### Epic 9: Audit & Compliance Reporting
**Goal:** L'auditeur accède aux preuves de conformité vérifiables et génère des rapports officiels par référentiel.

**FRs couverts:** FR48, FR49, FR50, FR51
**NFRs couverts:** NFR-C5, NFR-C7

**Scope:**
- Accès auditeur lecture seule
- Visualisation preuves techniques horodatées
- Export rapport conformité PDF par référentiel
- Historique conformité 12 mois

---

### Epic 10: Agent Self-Update System
**Goal:** L'agent se met à jour automatiquement de façon sécurisée avec staged rollout et rollback automatique si échec.

**FRs couverts:** FR62, FR63, FR64, FR65, FR66, FR67, FR68
**NFRs couverts:** NFR-R5, NFR-S3, NFR-S4

**Scope:**
- Vérification disponibilité nouvelle version
- Téléchargement et application auto (shadow copy)
- Rollback automatique si échec
- Déploiement par phases (1%→10%→50%→100%)
- Configuration politique update (auto/manuel/différé)

---

### Epic 11: Security Hardening & Integrity
**Goal:** L'agent garantit son intégrité et celle des logs avec signatures cryptographiques et possibilité de révocation.

**FRs couverts:** FR59, FR60, FR61
**NFRs couverts:** NFR-S6, NFR-S8, NFR-S9, NFR-S10, NFR-S11

**Scope:**
- Signature logs HMAC-SHA256
- Validation signature binaire avant installation
- Révocation agent compromis à distance
- Permissions fichiers restrictives
- Isolation processus

---

### Epic 12: Support & Diagnostics
**Goal:** L'équipe support peut diagnostiquer et résoudre les problèmes d'agents à distance efficacement.

**FRs couverts:** FR69, FR70, FR71, FR72
**NFRs couverts:** NFR-M6, NFR-M7

**Scope:**
- Visualisation logs agent spécifique
- État connexion détaillé
- Identification erreurs récentes
- Diagnostic à distance

---

## Epic 1: Foundation & Development Setup - Stories

### Story 1.1: Initialize Cargo Workspace Structure

As a **developer**,
I want **to have a properly configured Cargo Workspace with all 6 crates initialized**,
So that **I can start implementing agent features with proper module separation**.

**Acceptance Criteria:**

**Given** a new repository
**When** I run `cargo build` in the workspace root
**Then** all 6 crates compile successfully (agent-common, agent-system, agent-storage, agent-scanner, agent-sync, agent-core)
**And** the workspace uses Rust 2024 Edition with resolver v3
**And** workspace dependencies are configured for shared crates (tokio, serde, tracing, etc.)

---

### Story 1.2: Configure CI/CD Pipeline with Quality Gates

As a **developer**,
I want **automated CI/CD checks on every PR**,
So that **code quality is enforced consistently across the team**.

**Acceptance Criteria:**

**Given** a pull request is opened
**When** GitHub Actions CI runs
**Then** `cargo fmt --check` passes (formatting)
**And** `cargo clippy -- -D warnings` passes (linting)
**And** `cargo test` passes (all unit tests)
**And** `cargo deny check` passes (license/security)
**And** the pipeline fails if any check fails

---

### Story 1.3: Implement agent-common Core Types and Error Handling

As a **developer**,
I want **shared types, configuration structs, and error enums in agent-common**,
So that **all crates have consistent type definitions and error handling**.

**Acceptance Criteria:**

**Given** the agent-common crate exists
**When** I define shared types
**Then** `AgentConfig` struct with all configuration fields is available
**And** `CommonError` enum with thiserror derives is available
**And** common types (`CheckResult`, `Proof`, `AgentStatus`) are defined
**And** all types implement Serialize/Deserialize with snake_case
**And** unit tests verify type serialization roundtrip

---

### Story 1.4: Configure Security Tooling (cargo-audit, cargo-deny)

As a **developer**,
I want **security tooling configured to catch vulnerabilities and license issues**,
So that **we maintain a secure and compliant codebase**.

**Acceptance Criteria:**

**Given** the workspace is initialized
**When** I run `cargo audit`
**Then** the RustSec advisory database is checked for vulnerabilities
**And** `deny.toml` is configured with license allowlist (MIT, Apache-2.0, MPL-2.0)
**And** known-bad crates are blocked
**And** CI fails if vulnerabilities or license violations are detected

---

## Epic 2: Agent Core & Service Lifecycle - Stories

### Story 2.1: Implement Agent Configuration Loading

As an **administrator**,
I want **the agent to load configuration from JSON file or environment variables**,
So that **I can configure agent behavior without recompiling**.

**Acceptance Criteria:**

**Given** a configuration file `agent.json` exists
**When** the agent starts
**Then** configuration is loaded from the JSON file
**And** environment variables override file values (e.g., `SENTINEL_SERVER_URL`)
**And** missing required config results in clear error message
**And** default values are used for optional settings

---

### Story 2.2: Create Windows Service with Automatic Startup

As an **administrator**,
I want **the agent to run as a Windows Service with automatic startup**,
So that **it starts on boot and runs in the background**.

**Acceptance Criteria:**

**Given** the agent binary is installed on Windows
**When** I register it as a Windows Service
**Then** the service appears in services.msc as "Sentinel GRC Agent"
**And** the service starts automatically on system boot
**And** the service runs under SYSTEM account
**And** the service restarts automatically on crash (recovery settings)

---

### Story 2.3: Create Linux Daemon with systemd Integration

As an **administrator**,
I want **the agent to run as a Linux daemon via systemd**,
So that **it integrates with standard Linux service management**.

**Acceptance Criteria:**

**Given** the agent binary is installed on Linux
**When** I enable the systemd service
**Then** a unit file `sentinel-agent.service` exists in `/etc/systemd/system/`
**And** the service starts on boot (`systemctl enable sentinel-agent`)
**And** the service can be controlled via `systemctl start/stop/restart`
**And** the service restarts automatically on crash (Restart=always)

---

### Story 2.4: Build Windows MSI Installer Package

As an **administrator**,
I want **an MSI installer for silent deployment on Windows**,
So that **I can deploy via GPO, SCCM, or Intune**.

**Acceptance Criteria:**

**Given** the agent binary is built for Windows
**When** I run the MSI installer silently (`msiexec /i agent.msi /qn`)
**Then** the agent binary is installed to `C:\Program Files\Sentinel\`
**And** the Windows Service is registered and started
**And** configuration file is created with defaults
**And** installation completes without user interaction or reboot

---

### Story 2.5: Build Linux DEB and RPM Packages

As an **administrator**,
I want **DEB and RPM packages for Linux deployment**,
So that **I can deploy via apt, yum, or Ansible**.

**Acceptance Criteria:**

**Given** the agent binary is built for Linux
**When** I install via `apt install ./sentinel-agent.deb` or `yum install sentinel-agent.rpm`
**Then** the agent binary is installed to `/opt/sentinel/`
**And** the systemd service is registered and enabled
**And** configuration file is created at `/etc/sentinel/agent.json`
**And** proper file permissions (0755 binary, 0600 config) are set

---

### Story 2.6: Implement Clean Uninstallation

As an **administrator**,
I want **the agent to uninstall cleanly without leaving residues**,
So that **I can remove agents from endpoints completely**.

**Acceptance Criteria:**

**Given** the agent is installed
**When** I uninstall via MSI or package manager
**Then** the service is stopped and unregistered
**And** all agent files are removed from installation directory
**And** configuration files are optionally preserved (configurable)
**And** logs are preserved for audit purposes
**And** no orphan registry keys (Windows) or files remain

---

### Story 2.7: Implement Resource Usage Limits

As an **administrator**,
I want **the agent to operate within strict resource limits**,
So that **it doesn't impact endpoint performance**.

**Acceptance Criteria:**

**Given** the agent is running
**When** the agent is idle
**Then** CPU usage is < 0.5% average
**And** when running checks, CPU usage is < 5% peak
**And** memory usage is always < 100 MB
**And** disk I/O is < 10 IOPS average
**And** agent startup time is < 5 seconds

---

## Epic 3: Secure Local Storage - Stories

### Story 3.1: Initialize SQLite Database with SQLCipher Encryption

As a **security officer**,
I want **all local data stored in an encrypted SQLite database**,
So that **confidential compliance data is protected at rest**.

**Acceptance Criteria:**

**Given** the agent starts for the first time
**When** the database is initialized
**Then** a SQLite database is created at the designated location
**And** SQLCipher encryption is enabled with AES-256-CBC
**And** the encryption key is derived from machine-specific data (DPAPI on Windows, keyring on Linux)
**And** the database cannot be read without the correct key
**And** unit tests verify encryption is active

---

### Story 3.2: Implement Database Schema with Migrations

As a **developer**,
I want **a versioned database schema with migration support**,
So that **database updates can be applied safely across agent versions**.

**Acceptance Criteria:**

**Given** the encrypted database is initialized
**When** the agent runs schema migrations
**Then** 5 tables are created: `agent_config`, `check_rules`, `check_results`, `proofs`, `sync_queue`
**And** a `schema_version` table tracks applied migrations
**And** migrations run in order and are idempotent
**And** failed migrations trigger rollback and error logging
**And** foreign key constraints are enforced

---

### Story 3.3: Implement Check Results Repository

As an **agent**,
I want **to store check results with full context**,
So that **compliance history is available locally for offline operation**.

**Acceptance Criteria:**

**Given** a compliance check has executed
**When** the result is stored
**Then** the `check_results` table contains: check_id, timestamp, status, score, raw_data
**And** timestamp is in ISO 8601 UTC format
**And** results can be queried by date range and check type
**And** concurrent writes are handled safely (WAL mode)
**And** unit tests verify CRUD operations

---

### Story 3.4: Implement Proof Storage with Integrity Hash

As an **auditor**,
I want **each proof to have a SHA-256 integrity hash**,
So that **I can verify proofs have not been tampered with**.

**Acceptance Criteria:**

**Given** a compliance check generates proof data
**When** the proof is stored
**Then** the `proofs` table contains: proof_id, check_result_id, data, hash, created_at
**And** hash is computed as SHA-256 of (check_result_id + data + created_at)
**And** timestamp is in ISO 8601 UTC format (NFR-C3)
**And** proof data is stored as JSON blob
**And** integrity can be verified by recomputing the hash
**And** unit tests verify hash computation and verification

---

### Story 3.5: Implement Data Retention Policy (12 Months)

As a **compliance officer**,
I want **proofs retained for 12 months then automatically purged**,
So that **storage is managed and compliance requirements (NFR-C2) are met**.

**Acceptance Criteria:**

**Given** proofs older than 12 months exist in the database
**When** the retention policy job runs (daily)
**Then** proofs older than 12 months are deleted
**And** associated check results are marked as archived
**And** deletion is logged with count and date range
**And** sync_queue entries for deleted data are also cleaned
**And** storage usage is reported after cleanup

---

## Epic 4: Agent-SaaS Connectivity - Stories

### Story 4.1: Implement Agent Enrollment with API Token

As an **administrator**,
I want **to enroll a new agent using a registration token**,
So that **only authorized agents can connect to my organization**.

**Acceptance Criteria:**

**Given** an administrator has generated a registration token in the SaaS console
**When** the agent starts with the token in configuration
**Then** the agent calls the `/v1/agents/enroll` endpoint with the token
**And** the SaaS validates the token and returns agent credentials (agent_id, client certificate)
**And** the agent stores credentials securely in the encrypted database
**And** subsequent restarts use stored credentials (no re-enrollment)
**And** invalid/expired tokens result in clear error message and retry

---

### Story 4.2: Implement mTLS Certificate Management

As a **security officer**,
I want **all agent-SaaS communication secured with mTLS**,
So that **both parties are mutually authenticated**.

**Acceptance Criteria:**

**Given** the agent has enrolled successfully
**When** the agent communicates with the SaaS
**Then** mTLS is used with the agent's client certificate
**And** TLS 1.3 is enforced as minimum version (NFR-S1)
**And** the client certificate is stored encrypted (SQLCipher)
**And** certificate renewal is handled automatically before expiry
**And** communication fails gracefully if certificate is invalid

---

### Story 4.3: Implement Heartbeat Mechanism with Metrics

As an **administrator**,
I want **agents to send periodic heartbeats with health metrics**,
So that **I can monitor agent connectivity and health in real-time**.

**Acceptance Criteria:**

**Given** the agent is enrolled and running
**When** the heartbeat interval elapses (default: 60 seconds)
**Then** the agent sends a heartbeat to `/v1/agents/{id}/heartbeat`
**And** the payload includes: agent_version, os_info, cpu_usage, memory_usage, last_check_timestamp, compliance_score
**And** heartbeat latency is < 1s at p95 (NFR-P8)
**And** failed heartbeats are retried with exponential backoff
**And** 3 consecutive failures trigger offline mode

---

### Story 4.4: Implement Certificate Pinning for Server Validation

As a **security officer**,
I want **the agent to validate the server certificate against a pinned fingerprint**,
So that **MITM attacks are prevented even with compromised CAs**.

**Acceptance Criteria:**

**Given** the agent connects to the SaaS API
**When** the TLS handshake occurs
**Then** the server certificate SHA-256 fingerprint is validated against the pinned value
**And** pinned fingerprints are stored in agent configuration (updatable via SaaS)
**And** connection is rejected if fingerprint doesn't match
**And** backup pins are supported for certificate rotation
**And** pin validation failures are logged with details

---

### Story 4.5: Implement Agent Self-Integrity Check at Startup

As a **security officer**,
I want **the agent to verify its own binary integrity at startup**,
So that **tampered agents are detected and refused to run**.

**Acceptance Criteria:**

**Given** the agent binary is installed
**When** the agent starts
**Then** the agent computes SHA-256 hash of its own binary
**And** the hash is compared against the expected value (embedded or from secure storage)
**And** if hash mismatch, agent logs critical error and exits
**And** self-check result is included in first heartbeat
**And** the check completes in < 1 second

---

## Epic 5: Compliance Check Engine - Stories

### Story 5.1: Implement Check Runner Framework and Scheduler

As a **developer**,
I want **a pluggable check runner with configurable scheduling**,
So that **compliance checks execute reliably at defined intervals**.

**Acceptance Criteria:**

**Given** the agent is running with configured check rules
**When** the scheduler triggers
**Then** enabled checks are executed according to their configured frequency
**And** checks run in parallel with configurable concurrency limit
**And** each check has a timeout (default 30s) to prevent hangs
**And** check execution time is < 2s per check (NFR-P6)
**And** full scan of 20 checks completes in < 30s (NFR-P7)
**And** check results are passed to the storage layer

---

### Story 5.2: Implement Disk Encryption Check (BitLocker/LUKS)

As a **CISO**,
I want **the agent to verify disk encryption status**,
So that **I know endpoints have data-at-rest protection**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the disk encryption check executes
**Then** BitLocker status is retrieved via WMI/PowerShell
**And** result includes: enabled (bool), encryption_percentage, protection_status, key_protectors

**Given** the agent runs on Linux
**When** the disk encryption check executes
**Then** LUKS status is retrieved via `cryptsetup status`
**And** result includes: encrypted_partitions[], encryption_type, is_unlocked

**And** proof contains raw command output with timestamp

---

### Story 5.3: Implement Antivirus Status Check

As a **CISO**,
I want **the agent to verify antivirus is active with current definitions**,
So that **I know endpoints have malware protection**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the antivirus check executes
**Then** Windows Security Center is queried for AV status
**And** result includes: av_name, enabled, real_time_protection, definition_date, definition_version

**Given** the agent runs on Linux
**When** the antivirus check executes
**Then** common AV agents are detected (ClamAV, Sophos, etc.)
**And** result includes: av_name, service_running, last_scan_date

**And** definitions older than 7 days trigger non-compliant status

---

### Story 5.4: Implement Firewall Configuration Check

As a **CISO**,
I want **the agent to verify firewall is enabled**,
So that **I know endpoints have network protection**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the firewall check executes
**Then** Windows Firewall status is retrieved for all profiles (Domain, Private, Public)
**And** result includes: profile_name, enabled, default_inbound_action, default_outbound_action

**Given** the agent runs on Linux
**When** the firewall check executes
**Then** iptables/nftables/ufw status is retrieved
**And** result includes: firewall_type, enabled, rule_count, default_policy

---

### Story 5.5: Implement Password Policy Check

As a **CISO**,
I want **the agent to verify password policy compliance**,
So that **I know credential policies meet security standards**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the password policy check executes
**Then** Local Security Policy is queried
**And** result includes: min_length, complexity_required, max_age_days, history_count, lockout_threshold

**Given** the agent runs on Linux
**When** the password policy check executes
**Then** PAM configuration and /etc/login.defs are parsed
**And** result includes: min_length, complexity_modules, max_age_days, password_history

**And** non-compliance is flagged if min_length < 12 or complexity disabled

---

### Story 5.6: Implement Session Lock Check

As a **CISO**,
I want **the agent to verify automatic session lock is configured**,
So that **unattended endpoints are protected**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the session lock check executes
**Then** Screen saver and lock settings are retrieved from registry/GPO
**And** result includes: lock_enabled, timeout_minutes, require_password

**Given** the agent runs on Linux
**When** the session lock check executes
**Then** Desktop environment lock settings are retrieved (GNOME, KDE, etc.)
**And** result includes: lock_enabled, timeout_minutes, lock_on_suspend

**And** non-compliance if timeout > 15 minutes or lock disabled

---

### Story 5.7: Implement System Updates Check

As a **CISO**,
I want **the agent to verify system updates are current**,
So that **I know endpoints have security patches applied**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the updates check executes
**Then** Windows Update status is retrieved
**And** result includes: last_check_date, pending_updates_count, pending_security_updates, last_install_date

**Given** the agent runs on Linux
**When** the updates check executes
**Then** Package manager (apt/yum) is queried
**And** result includes: last_update_date, upgradable_packages_count, security_updates_pending

**And** non-compliance if security updates pending > 7 days

---

### Story 5.8: Implement Obsolete Protocols Check

As a **CISO**,
I want **the agent to verify obsolete protocols are disabled**,
So that **I know endpoints don't expose legacy vulnerabilities**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the protocols check executes
**Then** SMBv1 status is checked via registry/feature
**And** TLS 1.0/1.1 status is checked via registry
**And** result includes: smbv1_enabled, tls10_enabled, tls11_enabled, sslv3_enabled

**Given** the agent runs on Linux
**When** the protocols check executes
**Then** OpenSSL/system crypto policy is checked
**And** result includes: min_tls_version, weak_ciphers_enabled

**And** any legacy protocol enabled triggers non-compliant

---

### Story 5.9: Implement Backup Configuration Check

As a **CISO**,
I want **the agent to verify backup is configured and recent**,
So that **I know data recovery is possible**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the backup check executes
**Then** Windows Backup / File History status is retrieved
**And** result includes: backup_enabled, last_backup_date, backup_destination, backup_size

**Given** the agent runs on Linux
**When** the backup check executes
**Then** Common backup tools are detected (rsync cron, timeshift, etc.)
**And** result includes: backup_configured, last_backup_date, backup_location

**And** non-compliance if last backup > 30 days or not configured

---

### Story 5.10: Implement Local Admin Accounts Check

As a **CISO**,
I want **the agent to audit local administrator accounts**,
So that **I know privileged access is controlled**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the admin accounts check executes
**Then** Local Administrators group members are enumerated
**And** result includes: admin_accounts[], count, non_standard_admins[]

**Given** the agent runs on Linux
**When** the admin accounts check executes
**Then** Users with sudo/wheel group or UID 0 are enumerated
**And** result includes: root_enabled, sudo_users[], wheel_members[]

**And** warning if admin count > 3 or unexpected accounts found

---

### Story 5.11: Implement MFA Configuration Check

As a **CISO**,
I want **the agent to verify MFA is configured where applicable**,
So that **I know authentication is strengthened**.

**Acceptance Criteria:**

**Given** the agent runs on Windows domain-joined machine
**When** the MFA check executes
**Then** Azure AD / Windows Hello status is checked
**And** result includes: mfa_provider, mfa_enforced, enrollment_status

**Given** the agent runs on Linux
**When** the MFA check executes
**Then** PAM MFA modules are detected (Google Authenticator, Duo, etc.)
**And** result includes: mfa_module, mfa_required_for_sudo, mfa_required_for_ssh

**And** check is marked "not_applicable" if no MFA infrastructure detected

---

### Story 5.12: Implement Remote Access Security Check

As a **CISO**,
I want **the agent to verify remote access is secured**,
So that **I know RDP/SSH are hardened**.

**Acceptance Criteria:**

**Given** the agent runs on Windows
**When** the remote access check executes
**Then** RDP settings are retrieved
**And** result includes: rdp_enabled, nla_required, encryption_level, port

**Given** the agent runs on Linux
**When** the remote access check executes
**Then** SSH configuration is parsed
**And** result includes: ssh_enabled, password_auth, root_login, key_only, port, protocol_version

**And** non-compliance if NLA disabled (Windows) or root login enabled (Linux)

---

### Story 5.13: Implement Proof Generation Engine

As an **auditor**,
I want **each check to generate a timestamped proof**,
So that **compliance evidence is verifiable and tamper-evident**.

**Acceptance Criteria:**

**Given** a compliance check has executed
**When** the proof is generated
**Then** proof contains: check_id, timestamp (ISO 8601 UTC), raw_output, computed_result
**And** SHA-256 hash is computed over the proof content
**And** proof is stored in the `proofs` table via Story 3.4
**And** proof generation adds < 100ms overhead per check
**And** proofs are linked to check_results via foreign key

---

### Story 5.14: Implement Local Compliance Score Calculator

As a **CISO**,
I want **the agent to calculate a local compliance score**,
So that **I have immediate visibility into endpoint compliance**.

**Acceptance Criteria:**

**Given** all checks have completed
**When** the score is calculated
**Then** score is computed as: (compliant_checks / total_checks) * 100
**And** weighted scoring is supported (critical checks have higher weight)
**And** score is stored locally with timestamp
**And** score is included in heartbeat payload
**And** score trend (vs last scan) is calculated
**And** checks marked "not_applicable" are excluded from calculation

---

## Epic 6: Synchronization & Offline Mode - Stories

### Story 6.1: Download and Cache Check Rules from SaaS

As an **agent**,
I want **to download check rules from the SaaS and cache them locally**,
So that **I can execute compliance checks even when offline**.

**Acceptance Criteria:**

**Given** the agent is connected to the SaaS
**When** a sync cycle runs or rules are updated server-side
**Then** the agent downloads check rules from `/v1/agents/{id}/rules`
**And** rules are stored in the `check_rules` table with version hash
**And** only changed rules are downloaded (delta sync via ETag)
**And** cached rules remain valid for 7 days minimum
**And** rule download failure doesn't prevent using cached rules

---

### Story 6.2: Download Agent Configuration from SaaS

As an **administrator**,
I want **agent configuration to sync from the SaaS console**,
So that **I can manage agent settings centrally**.

**Acceptance Criteria:**

**Given** the agent is connected to the SaaS
**When** configuration is updated in the console
**Then** the agent downloads new config from `/v1/agents/{id}/config`
**And** configuration is stored in `agent_config` table
**And** configuration changes take effect without agent restart (hot reload)
**And** local config file overrides are preserved (merge strategy)
**And** config sync occurs on heartbeat response signal

---

### Story 6.3: Upload Check Results to SaaS

As a **CISO**,
I want **check results uploaded to the SaaS in real-time**,
So that **I see compliance status as soon as checks complete**.

**Acceptance Criteria:**

**Given** a compliance check has completed
**When** the agent is online
**Then** results are uploaded to `/v1/agents/{id}/results` within 60s
**And** payload includes: check_id, timestamp, status, score, proof_hash
**And** upload uses gzip compression (NFR-I8)
**And** successful upload marks local record as synced
**And** upload rate is limited to 200 req/s (NFR-SC4)

---

### Story 6.4: Implement Offline Mode with 7-Day Autonomy

As an **agent**,
I want **to operate fully offline for at least 7 days**,
So that **disconnected endpoints maintain compliance monitoring**.

**Acceptance Criteria:**

**Given** the agent loses connectivity to the SaaS
**When** 7 days pass without connection
**Then** checks continue executing on schedule using cached rules
**And** results and proofs are stored locally (NFR-R4: 0% data loss)
**And** compliance score continues updating locally
**And** agent logs offline duration and queued item count
**And** no functionality degrades during offline period

---

### Story 6.5: Implement Sync Queue with Retry Logic

As an **agent**,
I want **pending uploads queued and retried with exponential backoff**,
So that **data is eventually synchronized without overwhelming the server**.

**Acceptance Criteria:**

**Given** an upload fails due to network error
**When** retry logic executes
**Then** the item is queued in `sync_queue` table with attempt count
**And** retry uses exponential backoff: 1s, 2s, 4s, 8s... up to 1 hour max
**And** circuit breaker opens after 5 consecutive failures (pause 5 min)
**And** queue is processed FIFO with oldest items first
**And** sync completes within 5 minutes after reconnection (NFR-P9)
**And** retry continues up to 24 hours (NFR-R6)

---

### Story 6.6: Handle Synchronization Conflicts

As an **administrator**,
I want **conflicts handled gracefully after offline periods**,
So that **no data is lost and state is consistent**.

**Acceptance Criteria:**

**Given** the agent was offline and configuration changed on SaaS
**When** the agent reconnects
**Then** server configuration takes precedence (server wins)
**And** local results are uploaded regardless of config changes
**And** conflicting check rules are resolved by version timestamp
**And** conflict resolution is logged with before/after state
**And** manual conflict items are flagged for admin review (edge cases)

---

## Epic 7: Dashboard & Compliance Visualization (SaaS) - Stories

### Story 7.1: Display Global Compliance Score Dashboard

As a **CISO**,
I want **to see a global compliance score for my entire fleet**,
So that **I have immediate visibility into organizational risk posture**.

**Acceptance Criteria:**

**Given** I am logged into the SaaS console
**When** I navigate to the Endpoints dashboard
**Then** I see a prominent global compliance score (0-100%)
**And** the score is calculated as weighted average of all endpoint scores
**And** the score updates in real-time as agent results arrive
**And** color coding indicates status: green (≥80%), yellow (60-79%), red (<60%)
**And** dashboard loads in < 3s initial, < 1s navigation (NFR-U1)

---

### Story 7.2: Display Per-Endpoint Compliance View

As a **CISO**,
I want **to see compliance score for each individual endpoint**,
So that **I can identify which machines need attention**.

**Acceptance Criteria:**

**Given** I am on the Endpoints dashboard
**When** I view the endpoints list
**Then** each endpoint shows: hostname, OS, compliance_score, last_check_time, status
**And** endpoints are sortable by score, name, or last check time
**And** clicking an endpoint opens detail view
**And** offline endpoints are visually distinguished
**And** pagination supports 10,000+ agents (NFR-SC1)

---

### Story 7.3: Display Compliance Gap Details

As a **CISO**,
I want **to see detailed compliance gaps per check**,
So that **I understand exactly what needs remediation**.

**Acceptance Criteria:**

**Given** I select an endpoint
**When** I view the compliance details
**Then** I see each check with: name, status, score, last_run, framework_mapping
**And** non-compliant checks are highlighted with reason
**And** I can expand each check to see proof data
**And** remediation guidance is shown for failed checks
**And** checks are grouped by category (encryption, access, network, etc.)

---

### Story 7.4: Display Historical Compliance Trend

As a **CISO**,
I want **to see compliance score trends over time**,
So that **I can track improvement or degradation**.

**Acceptance Criteria:**

**Given** I am viewing the dashboard or endpoint detail
**When** I view the trend chart
**Then** a line chart shows daily compliance score for last 30 days minimum
**And** I can change the time range (7d, 30d, 90d, 12m)
**And** significant changes (>5% delta) are marked on the chart
**And** hovering shows exact score and date
**And** trend data is available for global and per-endpoint views

---

### Story 7.5: Filter by Regulatory Framework

As a **CISO**,
I want **to filter compliance view by regulatory framework**,
So that **I can focus on specific compliance requirements**.

**Acceptance Criteria:**

**Given** I am on the Endpoints dashboard
**When** I select a framework filter (NIS2, DORA, RGPD)
**Then** only checks mapped to that framework are included in scores
**And** global and endpoint scores recalculate for selected framework
**And** multiple frameworks can be selected (OR logic)
**And** filter selection persists across navigation
**And** "All frameworks" option resets to default view

---

### Story 7.6: Filter by Compliance Status

As a **CISO**,
I want **to filter endpoints by compliance status**,
So that **I can focus on non-compliant machines**.

**Acceptance Criteria:**

**Given** I am on the Endpoints dashboard
**When** I apply a status filter
**Then** I can filter by: Compliant (≥80%), At Risk (60-79%), Non-Compliant (<60%)
**And** endpoint count per status is shown in filter UI
**And** filters combine with framework filter (AND logic)
**And** "Show all" clears status filter
**And** filtered view URL is shareable

---

### Story 7.7: Configure Score Degradation Alerts

As a **CISO**,
I want **to receive alerts when compliance score degrades**,
So that **I'm notified of emerging risks immediately**.

**Acceptance Criteria:**

**Given** I have configured alert thresholds
**When** global or endpoint score drops below threshold
**Then** an alert is generated with: scope, previous_score, new_score, delta, trigger_time
**And** alert is delivered via configured channel (email, webhook, in-app)
**And** configurable thresholds: critical (<60%), warning (<80%)
**And** alert cooldown prevents spam (min 1 hour between same alert)
**And** alert history is viewable in console

---

### Story 7.8: Provide DPO GDPR-Filtered View

As a **DPO**,
I want **a dedicated view filtered for GDPR-relevant checks**,
So that **I can assess data protection compliance specifically**.

**Acceptance Criteria:**

**Given** I am logged in with DPO role
**When** I access the DPO dashboard
**Then** only RGPD-mapped checks are shown
**And** endpoints processing personal data are highlighted
**And** encryption and access control checks are prioritized
**And** I can generate RGPD-specific compliance report
**And** view is read-only (no configuration changes)

---

## Epic 8: Agent Fleet Administration (SaaS) - Stories

### Story 8.1: Display Agent Fleet List with Status

As an **IT Administrator**,
I want **to see all deployed agents with their connection status and version**,
So that **I can monitor the health of my agent fleet**.

**Acceptance Criteria:**

**Given** I am logged in as IT Administrator
**When** I navigate to the Agent Management page
**Then** I see a list of all registered agents
**And** each agent shows: hostname, OS, agent_version, connection_status, last_seen
**And** connection status shows: Online (green), Offline (red), Unknown (gray)
**And** I can search and filter by hostname, OS, status, or version
**And** list supports pagination for 10,000+ agents (NFR-SC1)

---

### Story 8.2: Download Agent Installation Packages

As an **IT Administrator**,
I want **to download installation packages for all supported platforms**,
So that **I can deploy agents to new endpoints**.

**Acceptance Criteria:**

**Given** I am on the Agent Management page
**When** I click "Download Agent"
**Then** I see download options: Windows MSI, Linux DEB, Linux RPM
**And** each package shows version number and file size
**And** download includes SHA-256 checksum for verification
**And** packages are the latest stable version
**And** previous versions are available for rollback scenarios

---

### Story 8.3: Generate Agent Registration Tokens

As an **IT Administrator**,
I want **to generate time-limited registration tokens**,
So that **I can securely enroll new agents**.

**Acceptance Criteria:**

**Given** I am on the Agent Management page
**When** I click "Generate Token"
**Then** a new registration token is generated
**And** I can set token expiry (1h, 24h, 7d, 30d)
**And** I can set max usage count (1, 10, 100, unlimited)
**And** token is displayed once and can be copied to clipboard
**And** I can revoke active tokens
**And** token usage history is logged

---

### Story 8.4: Configure Check Frequency

As an **IT Administrator**,
I want **to configure how often compliance checks run**,
So that **I can balance thoroughness with resource usage**.

**Acceptance Criteria:**

**Given** I am on the Agent Configuration page
**When** I set the check frequency
**Then** I can choose: Every 15 min, Hourly, Every 4 hours, Daily
**And** configuration can apply to: All agents, Agent group, Individual agent
**And** change is pushed to agents on next heartbeat
**And** agents confirm configuration receipt
**And** different frequencies can be set per check category

---

### Story 8.5: Enable or Disable Specific Checks

As an **IT Administrator**,
I want **to enable or disable specific compliance checks**,
So that **I can customize checks for different endpoint types**.

**Acceptance Criteria:**

**Given** I am on the Agent Configuration page
**When** I view the checks list
**Then** I see all available checks with enable/disable toggle
**And** disabled checks are excluded from agent execution and scoring
**And** I can bulk enable/disable checks
**And** check profiles can be saved and applied to agent groups
**And** default profile enables all checks
**And** change is pushed to agents on next sync

---

### Story 8.6: Force Agent Synchronization

As an **IT Administrator**,
I want **to force an immediate sync on a specific agent**,
So that **I can push configuration changes or retrieve results urgently**.

**Acceptance Criteria:**

**Given** I select an agent from the fleet list
**When** I click "Force Sync"
**Then** a sync command is sent to the agent
**And** agent responds within 60 seconds if online
**And** sync status shows: Pending, In Progress, Completed, Failed
**And** I can force sync multiple agents at once
**And** force sync is logged in audit trail

---

### Story 8.7: Unregister Agent from Fleet

As an **IT Administrator**,
I want **to remove an agent from the managed fleet**,
So that **decommissioned endpoints no longer appear in reports**.

**Acceptance Criteria:**

**Given** I select an agent from the fleet list
**When** I click "Unregister"
**Then** a confirmation dialog appears with agent details
**And** unregistered agent certificate is revoked
**And** agent is removed from fleet list
**And** historical compliance data is retained for audit (12 months)
**And** agent receives revocation notice and stops communicating
**And** unregistration is logged in audit trail

---

## Epic 9: Audit & Compliance Reporting - Stories

### Story 9.1: Provide Auditor Read-Only Access

As an **Auditor**,
I want **read-only access to compliance data**,
So that **I can review evidence without risk of modification**.

**Acceptance Criteria:**

**Given** I am logged in with Auditor role
**When** I access the compliance dashboard
**Then** I can view all compliance scores, checks, and proofs
**And** all modification controls are hidden or disabled
**And** I cannot change agent configuration or settings
**And** I cannot force sync or unregister agents
**And** audit access is logged with timestamp and user ID
**And** session timeout is enforced (30 min inactivity)

---

### Story 9.2: View Technical Proofs with Timestamps

As an **Auditor**,
I want **to view timestamped technical proofs for each check**,
So that **I can verify compliance evidence is authentic**.

**Acceptance Criteria:**

**Given** I select a check result for an endpoint
**When** I view the proof details
**Then** I see: raw_output, timestamp (ISO 8601 UTC), agent_id, check_version
**And** SHA-256 integrity hash is displayed
**And** I can verify hash by recomputing (verification button)
**And** proof chain of custody is shown (agent → upload → storage)
**And** proofs are displayed in a secure, non-editable format

---

### Story 9.3: Export Compliance Report by Framework (PDF)

As an **Auditor**,
I want **to export a formal compliance report in PDF format**,
So that **I have official documentation for audit purposes**.

**Acceptance Criteria:**

**Given** I am on the compliance dashboard
**When** I click "Export Report"
**Then** I can select framework: NIS2, DORA, RGPD, or All
**And** I can select scope: All endpoints, Specific group, Single endpoint
**And** I can select date range for report
**Then** PDF is generated with:
  - Executive summary with global score
  - Per-endpoint compliance breakdown
  - Failed checks with details
  - Proof references (hash, timestamp)
  - Report generation metadata (date, user, filters)
**And** PDF includes Sentinel branding and page numbers
**And** export completes within 30 seconds for 1000 endpoints

---

### Story 9.4: View 12-Month Compliance History

As an **Auditor**,
I want **to view compliance history spanning 12 months**,
So that **I can assess compliance trends and demonstrate continuous improvement**.

**Acceptance Criteria:**

**Given** I am viewing the compliance dashboard
**When** I access historical data
**Then** I can view compliance scores for any date in the past 12 months
**And** I can compare current state vs any historical point
**And** timeline shows major compliance events (score changes >10%)
**And** I can drill down into historical check results
**And** historical proofs are accessible and verifiable
**And** data older than 12 months is marked as archived (NFR-C2)

---

## Epic 10: Agent Self-Update System - Stories

### Story 10.1: Check for Available Updates

As an **agent**,
I want **to check for new versions periodically**,
So that **I can stay up-to-date with the latest security and features**.

**Acceptance Criteria:**

**Given** the agent is running and connected
**When** the update check interval elapses (default: 4 hours)
**Then** the agent queries `/v1/updates/check` with current version
**And** response includes: available (bool), version, release_notes, mandatory, sha256
**And** update availability is logged
**And** if update available, agent evaluates update policy before proceeding
**And** check respects staged rollout assignment (rollout_group)

---

### Story 10.2: Download and Apply Update Automatically

As an **agent**,
I want **to download and install updates automatically**,
So that **endpoints stay current without manual intervention**.

**Acceptance Criteria:**

**Given** an update is available and policy allows automatic update
**When** the update process starts
**Then** new binary is downloaded to staging directory
**And** SHA-256 hash is verified against expected value
**And** code signature is verified (Authenticode/GPG)
**And** shadow copy mechanism preserves current binary for rollback
**And** service is restarted with new binary
**And** post-update health check confirms successful start
**And** update result is reported to SaaS

---

### Story 10.3: Implement Automatic Rollback on Failure

As an **agent**,
I want **to rollback to previous version if update fails**,
So that **endpoints remain functional even if update is faulty**.

**Acceptance Criteria:**

**Given** an update has been applied
**When** the post-update health check fails
**Then** the agent restores the shadow copy of previous binary
**And** service restarts with previous version
**And** rollback completes in < 2 minutes (NFR-R5)
**And** failure is reported to SaaS with error details
**And** failed version is marked for investigation
**And** agent continues operating on previous version

---

### Story 10.4: Implement Staged Rollout Deployment

As a **Platform Operator**,
I want **updates deployed in phases**,
So that **faulty updates are caught before affecting all agents**.

**Acceptance Criteria:**

**Given** a new version is released
**When** staged rollout is configured
**Then** agents are assigned to rollout groups (1%, 10%, 50%, 100%)
**And** each phase waits for success signals before proceeding
**And** failure rate threshold (>5%) halts rollout
**And** operator can manually advance or pause rollout
**And** rollout status is visible in SaaS console
**And** emergency rollback affects all updated agents

---

### Story 10.5: Configure Update Policy

As an **IT Administrator**,
I want **to configure how agents handle updates**,
So that **I control when and how updates are applied**.

**Acceptance Criteria:**

**Given** I am on the Agent Configuration page
**When** I configure update policy
**Then** I can select: Automatic, Manual approval, Deferred (delay days)
**And** policy can apply to: All agents, Agent group, Individual agent
**And** maintenance window can be set (e.g., weekends only)
**And** mandatory security updates can override policy
**And** policy is pushed to agents on next sync

---

### Story 10.6: Trigger Manual Update on Agent

As an **IT Administrator**,
I want **to manually trigger an update on specific agents**,
So that **I can update critical endpoints immediately**.

**Acceptance Criteria:**

**Given** I select an agent with available update
**When** I click "Update Now"
**Then** update command is sent to the agent
**And** agent bypasses policy and downloads update immediately
**And** update progress is shown: Downloading, Verifying, Installing, Restarting
**And** completion or failure is displayed
**And** I can bulk update multiple selected agents

---

### Story 10.7: Block Specific Version

As an **IT Administrator**,
I want **to block a specific agent version**,
So that **faulty versions cannot be installed or remain running**.

**Acceptance Criteria:**

**Given** I am on the Version Management page
**When** I block a version
**Then** agents on that version are prompted to update immediately
**And** blocked version cannot be installed by any agent
**And** staged rollout using blocked version is halted
**And** block reason and admin are recorded
**And** block can be lifted if issue is resolved

---

## Epic 11: Security Hardening & Integrity - Stories

### Story 11.1: Sign Logs with HMAC-SHA256

As a **security officer**,
I want **all agent logs signed with HMAC-SHA256**,
So that **log tampering can be detected**.

**Acceptance Criteria:**

**Given** the agent generates a log entry
**When** the entry is written
**Then** HMAC-SHA256 signature is computed using agent's secret key
**And** signature is appended to log entry (NFR-S8)
**And** each entry includes: timestamp, level, message, previous_hash (chain)
**And** log chain can be verified for integrity
**And** tampering detection alerts are generated on verification failure
**And** signing adds < 1ms overhead per entry

---

### Story 11.2: Validate Binary Signature Before Installation

As a **security officer**,
I want **agent binary signatures validated before installation**,
So that **only authentic binaries are deployed**.

**Acceptance Criteria:**

**Given** an agent installer is executed
**When** installation begins
**Then** Windows validates Authenticode signature (EV certificate)
**And** Linux validates GPG signature against trusted key
**And** installation is blocked if signature is invalid or missing
**And** signature validation result is logged
**And** certificate/key revocation is checked (CRL/OCSP)
**And** self-update also validates signature before applying

---

### Story 11.3: Revoke Compromised Agent Remotely

As a **security officer**,
I want **to revoke a compromised agent remotely**,
So that **it can no longer access the SaaS or report data**.

**Acceptance Criteria:**

**Given** I identify a compromised agent
**When** I click "Revoke Agent" in the console
**Then** agent's mTLS certificate is added to revocation list
**And** all active sessions for the agent are terminated immediately
**And** agent receives revocation notice and stops all operations
**And** revoked agent cannot re-enroll without new token
**And** revocation is logged with reason and admin ID
**And** compliance data from compromised agent is flagged for review
