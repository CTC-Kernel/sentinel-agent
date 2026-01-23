---
stepsCompleted: [1]
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

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
