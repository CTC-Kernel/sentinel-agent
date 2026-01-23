---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
workflow_completed: true
completion_date: '2026-01-23'
inputDocuments: ['brainstorming-session-2026-01-23.md', 'comprehensive-agent-grc-research-2026-01-23.md', 'project-context.md', 'prd.md']
workflowType: 'prd'
lastStep: 1
briefCount: 0
researchCount: 1
brainstormingCount: 1
projectDocsCount: 2
project_type: 'endpoint_agent'
domain: 'grc_compliance'
complexity: 'high'
---

# Product Requirements Document - Agent GRC Sentinel

**Author:** Thibaultllopis
**Date:** 2026-01-23

## Executive Summary

L'**Agent GRC Sentinel** est un agent intelligent multi-plateforme qui comble le fossé critique entre la gouvernance (GRC) et la technique (endpoints). Alors que les solutions GRC SaaS actuelles (Vanta, Drata) restent agentless et que les solutions Endpoint Security (CrowdStrike, Tanium) n'offrent pas de mapping réglementaire, l'Agent GRC Sentinel est le premier à unifier ces deux mondes.

Connecté à la plateforme Sentinel GRC SaaS existante, l'agent déploie une **double fonction unique** :
- **Conseiller IA** : Assiste sur les mesures à implémenter pour atteindre la conformité NIS2, DORA et autres référentiels
- **Contrôleur Technique** : Vérifie factuellement l'application des mesures sur chaque endpoint

Cette boucle fermée (Conseil → Implémentation → Contrôle → Écart → Conseil) transforme la conformité de déclaratif à factuel.

### What Makes This Special

1. **Pont GRC ↔ Technique** — Positionnement unique sur un marché de $50-65B, aucun concurrent ne couvre ce gap
2. **Validation humaine obligatoire** — Pas d'auto-remediation, confiance et audit trail garantis
3. **Intelligence collective opt-in** — Effet réseau premium entre clients participants
4. **Score conformité enrichi temps réel** — Écarts détaillés + tendances historiques + recommandations
5. **UI-first, zero code** — Adoption massive sans expertise scripting requise
6. **Mode offline robuste** — Contrôles avec règles en cache, stockage local, synchronisation ultérieure

## Project Classification

**Technical Type:** endpoint_agent (Agent système natif multi-plateforme)
**Domain:** grc_compliance (Gouvernance, Risque, Conformité)
**Complexity:** HIGH
**Project Context:** Brownfield — Extension de la plateforme Sentinel GRC SaaS existante

### Justification de la complexité élevée

| Facteur | Impact |
|---------|--------|
| **Multi-OS** | Windows + Linux V1, macOS V1.1 — compilation croisée Rust |
| **Conformité réglementaire** | NIS2 (10 mesures Art.21), DORA (5 piliers) — sanctions jusqu'à €10M |
| **Sécurité endpoint** | Privilèges admin/root, code signing, TLS 1.3, certificate pinning |
| **Architecture distribuée** | Agent léger + Intelligence cloud, mode offline, synchronisation |
| **Intégration SaaS** | API bidirectionnelle avec Sentinel GRC existant |

### Stack technique validée

- **Langage :** Rust (sécurité mémoire, cross-compile natif, 1000x moins de bugs que C++)
- **Runtime :** Tokio (async)
- **Communication :** REST/HTTPS (universel, passe firewalls)
- **Stockage local :** SQLite (ACID, robuste, un fichier)
- **Déploiement :** Service/Daemon (toujours actif, peut bloquer)
- **Mise à jour :** Staged Rollout (1%→10%→50%→100%, rollback auto)

## Success Criteria

### User Success

**Persona cible :** Responsable Conformité / RSSI / DPO

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Automatisation contrôles** | % contrôles manuels automatisés | ≥ 80% |
| **Score temps réel** | Latence mise à jour score | < 5 minutes |
| **Alertes dégradation** | Notification sur baisse score | Immédiat (< 1 min) |
| **Réduction effort** | Temps économisé par endpoint/mois | ≥ 2h |
| **Visibilité conformité** | Écarts identifiés avec recommandations | 100% traçables |

**Moment "Aha!"** : L'utilisateur voit son score conformité se mettre à jour automatiquement après application d'une mesure, sans intervention manuelle.

**Succès émotionnel** : "Je sais exactement où j'en suis à tout moment, plus de surprises lors des audits."

### Business Success

| Horizon | Métrique | Cible |
|---------|----------|-------|
| **6 mois** | Endpoints déployés | 10 000+ |
| **6 mois** | Clients avec agent actif | 50+ |
| **6 mois** | Revenu additionnel MRR | €30-50k |
| **12 mois** | Endpoints déployés | 50 000+ |
| **12 mois** | Conversion SaaS → SaaS+Agent | ≥ 40% |
| **12 mois** | Revenu additionnel MRR | €150-250k |

**Pricing validé :** €3-5/endpoint/mois (tiering basé sur volume)

**Indicateur clé :** Taux de rétention clients agent > 95% (valeur prouvée)

### Technical Success

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Fiabilité agent** | Uptime service | ≥ 99.5% |
| **Performance** | CPU/RAM impact | < 2% CPU, < 100MB RAM |
| **Sécurité** | Vulnérabilités critiques | 0 en production |
| **Compatibilité** | OS supportés V1 | Windows 10+, Ubuntu 20.04+, RHEL 8+ |
| **Mode offline** | Durée autonomie | ≥ 7 jours |
| **Synchronisation** | Réconciliation après reconnexion | < 5 min |

### Measurable Outcomes

**Conformité réglementaire vérifiable :**

| Référentiel | Checks automatisables | Cible V1 |
|-------------|----------------------|----------|
| **NIS2 Art.21** | 6/10 mesures | 100% coverage |
| **DORA** | 2/5 piliers (ICT Risk, Resilience Testing) | 100% coverage |

**Impact client démontrable :**
- Réduction temps audit : -50%
- Écarts détectés proactivement : +300%
- Conformité factuelle vs déclarative : 100%

## Product Scope

### MVP - Minimum Viable Product

**Objectif :** Valider le concept Pont GRC ↔ Technique

| Composant | Périmètre MVP |
|-----------|---------------|
| **OS Support** | Windows 10/11, Ubuntu 20.04+ |
| **Checks** | 20 contrôles prioritaires (NIS2/DORA) |
| **Communication** | REST/HTTPS vers SaaS Sentinel |
| **Stockage local** | SQLite, cache règles, preuves |
| **Mode offline** | Contrôles en cache, sync ultérieure |
| **Dashboard** | Score endpoint, écarts, tendance 30j |
| **Authentification** | Token agent + mTLS |

**Hors scope MVP :**
- macOS
- Remediation automatique
- Intelligence collective
- Checks personnalisés

### Growth Features (Post-MVP)

| Feature | Valeur | Priorité |
|---------|--------|----------|
| **macOS Support** | Couverture 95%+ parc client | P1 |
| **Intelligence collective opt-in** | Effet réseau, premium | P1 |
| **Checks personnalisés (UI)** | Flexibilité client | P2 |
| **Alertes enrichies** | Intégration SIEM/SOAR | P2 |
| **API publique agent** | Intégrations tierces | P3 |

### Vision (Future)

**Agent GRC Sentinel 2.0 :**
- **Remediation assistée** : Propositions avec validation humaine one-click
- **IA prédictive** : Anticipation dérives conformité
- **Multi-tenant MSP** : Gestion centralisée pour MSSP
- **Marketplace checks** : Communauté de règles partagées
- **Certification continue** : Attestation temps réel pour auditeurs

## User Journeys

### Journey 1: Sophie Martin - RSSI qui reprend le contrôle de sa conformité

Sophie est RSSI d'une ETI de 800 collaborateurs dans le secteur financier. Avec l'entrée en vigueur de DORA et les exigences NIS2, elle croule sous les audits et les demandes de preuves. Chaque trimestre, elle passe 3 semaines à collecter manuellement les captures d'écran de configurations, à vérifier les antivirus, à contrôler les politiques de mots de passe sur 400 postes. Elle a l'impression de courir après un train qu'elle ne rattrapera jamais.

Un matin, lors d'une démo Sentinel GRC, elle découvre l'Agent. Sceptique au début — "encore un agent à déployer" — elle accepte un pilote sur 50 postes. L'installation se fait en 10 minutes via GPO. Dès le lendemain, son dashboard affiche un score conformité réel : 67%. Elle voit immédiatement les 12 postes sans chiffrement disque, les 8 avec antivirus désactivé, les 23 avec des mots de passe non conformes.

Le déclic arrive lors de l'audit DORA de mars. Au lieu de préparer frénétiquement pendant 3 semaines, Sophie génère un rapport en 2 clics. L'auditeur, impressionné par la traçabilité temps réel, valide le contrôle en une demi-journée au lieu de trois. Six mois plus tard, Sophie a déployé l'agent sur les 400 postes, son score est passé à 94%, et elle consacre enfin son temps à la stratégie sécurité plutôt qu'à la collecte de preuves.

**Capabilities révélées :** Dashboard RSSI, Score temps réel, Génération rapports audit, Détection écarts automatique, Historique tendances

---

### Journey 2: Thomas Dupont - Administrateur IT qui déploie sans friction

Thomas est admin système dans la même ETI que Sophie. Quand on lui annonce "un nouvel agent à déployer sur tout le parc", il soupire. Il a déjà l'EDR, l'antivirus, le MDM, l'agent de patch management... Chaque agent supplémentaire, c'est du CPU en plus, des conflits potentiels, du support utilisateur.

Il télécharge le package MSI depuis la console Sentinel. Le fichier fait 15 Mo — léger. Il configure les paramètres via un fichier JSON : URL du SaaS, token d'authentification, fréquence de sync. Il pousse via SCCM sur 50 postes pilotes. L'installation prend 2 minutes par poste, silencieuse, sans redémarrage.

Le lendemain, il vérifie : tous les agents sont connectés, CPU à 0.3% en moyenne, 45 Mo de RAM. Aucun ticket utilisateur. Il étend progressivement : 100 postes, puis 200, puis tout le parc. En 3 semaines, 400 agents tournent. Le seul incident : un poste hors réseau pendant 10 jours qui s'est parfaitement resynchronisé à la reconnexion. Thomas avoue à Sophie : "Pour une fois, un déploiement qui s'est bien passé."

**Capabilities révélées :** Installation silencieuse MSI/DEB, Configuration JSON/GPO, Monitoring santé agents, Faible empreinte ressources, Mode offline robuste, Console admin

---

### Journey 3: Marie Leroy - DPO qui vérifie la conformité RGPD endpoint

Marie est DPO de l'entreprise. Elle doit s'assurer que les données personnelles sont protégées sur chaque poste : chiffrement disque, verrouillage automatique, pas de stockage cloud non autorisé. Jusqu'ici, elle envoyait des questionnaires aux équipes IT et priait pour des réponses honnêtes.

Avec l'Agent GRC Sentinel, Marie accède à une vue filtrée "RGPD" dans le dashboard. Elle voit instantanément : 95% des postes ont le chiffrement BitLocker/LUKS activé, 89% ont le verrouillage écran < 5 minutes, 3 postes ont Dropbox personnel installé (non autorisé). Elle génère un rapport RGPD Article 32 en un clic.

Quand un collaborateur conteste "mais mon poste est conforme !", Marie peut montrer l'historique factuel : "Le 15 janvier à 14h32, le verrouillage automatique a été désactivé. Voici la preuve." La discussion passe du déclaratif au factuel. En 6 mois, le taux de conformité RGPD endpoint passe de 78% à 96%.

**Capabilities révélées :** Vue filtrée par référentiel, Checks RGPD spécifiques, Historique modifications, Preuves horodatées, Rapport Article 32

---

### Journey 4: Pierre Blanc - Auditeur externe qui gagne du temps

Pierre est auditeur pour un cabinet spécialisé conformité financière. Il audite 15 entreprises par an sur DORA et NIS2. Son cauchemar : les entreprises qui arrivent avec des classeurs Excel, des captures d'écran datées de 3 mois, des "on fait ça mais on n'a pas de preuve".

Chez son nouveau client équipé de Sentinel GRC + Agent, Pierre reçoit un accès auditeur en lecture seule. Il voit le score conformité temps réel par référentiel, les écarts détaillés, l'historique sur 12 mois. Chaque contrôle a une preuve technique horodatée : "Chiffrement vérifié le 23/01/2026 à 09:15:32 sur PC-COMPTA-047".

Ce qui prenait habituellement 5 jours prend 1,5 jour. Pierre peut se concentrer sur les vrais sujets : la gouvernance, les processus, la culture sécurité. Il recommande Sentinel à ses autres clients : "Enfin une entreprise qui comprend ce dont un auditeur a besoin."

**Capabilities révélées :** Accès auditeur lecture seule, Preuves techniques horodatées, Export rapport audit, Historique 12 mois, Traçabilité complète

---

### Journey 5: Julien Mercier - Intégrateur MSP qui gère 20 clients

Julien travaille pour un MSSP qui gère la sécurité de 20 PME. Chaque client a entre 20 et 200 postes. Avant, il passait son temps à jongler entre les consoles : un outil de patch ici, un RMM là, des audits manuels partout.

Avec Sentinel GRC multi-tenant, Julien a une vue consolidée de ses 20 clients. Il voit en un coup d'œil : Client A à 92% conformité, Client B à 67% (alerte rouge), Client C a 3 agents offline depuis 48h. Il peut drill-down par client, par référentiel, par type d'écart.

Quand Client B chute à 67%, Julien identifie la cause en 2 minutes : une mise à jour Windows a désactivé le pare-feu sur 15 postes. Il génère une alerte, contacte le client, et suit la remédiation en temps réel. Le score remonte à 89% en 24h. Julien facture ce service de monitoring conformité €2/endpoint/mois — marge nette sur la licence Sentinel.

**Capabilities révélées :** Console multi-tenant MSP, Vue consolidée clients, Alertes cross-clients, Drill-down par client, Facturation par endpoint

---

### Journey 6: Sarah Chen - Support Sentinel qui diagnostique à distance

Sarah fait partie de l'équipe support Sentinel. Un client appelle : "L'agent sur PC-FINANCE-012 ne remonte plus de données depuis 3 jours." Avant, c'était le début d'un long tunnel : demander des logs, attendre les réponses, deviner à distance.

Avec la console support, Sarah voit immédiatement l'état de l'agent : dernière communication il y a 72h, dernière erreur "Certificate validation failed", version agent 1.2.3 (à jour). Elle diagnostique : le certificat racine a expiré sur ce poste spécifique.

Elle guide le client par téléphone : "Allez dans Paramètres > Certificats > Installer le certificat racine Sentinel." 5 minutes plus tard, l'agent se reconnecte, synchronise 72h de données en cache, et le ticket est fermé. Temps de résolution : 12 minutes au lieu de 2 heures.

**Capabilities révélées :** Console support technique, Logs agent centralisés, Diagnostic à distance, État connexion temps réel, Cache offline avec sync

---

### Journey 7: Alexandre Petit - Développeur qui intègre au SIEM

Alexandre est ingénieur SecOps. Son SIEM (Splunk) centralise tous les événements sécurité. Il veut corréler les alertes Agent GRC avec les autres sources : si un poste devient non-conforme ET génère des alertes réseau suspectes, c'est un indicateur de compromission.

Il consulte la documentation API de l'Agent. En 2 heures, il configure un webhook qui pousse chaque changement de score vers Splunk. Il crée un dashboard corrélé : postes non-conformes + alertes EDR + connexions anormales.

La semaine suivante, son dashboard alerte : PC-DEV-034 a vu son score chuter de 94% à 45% (antivirus désactivé, pare-feu down) ET génère des connexions vers une IP en Russie. Alexandre isole le poste en 3 minutes. L'investigation révèle un malware qui désactivait les protections. Sans la corrélation Agent GRC + SIEM, la détection aurait pris des jours.

**Capabilities révélées :** API webhook événements, Export données SIEM, Intégration Splunk/ELK, Événements temps réel, Corrélation sécurité

---

### Journey Requirements Summary

| Journey | Persona | Capabilities clés |
|---------|---------|-------------------|
| **1. Sophie** | RSSI | Dashboard, Score temps réel, Rapports audit, Détection écarts |
| **2. Thomas** | Admin IT | Installation silencieuse, Config GPO, Monitoring agents, Mode offline |
| **3. Marie** | DPO | Vue par référentiel, Checks RGPD, Historique, Preuves horodatées |
| **4. Pierre** | Auditeur | Accès lecture seule, Export audit, Traçabilité complète |
| **5. Julien** | MSP | Multi-tenant, Vue consolidée, Alertes cross-clients |
| **6. Sarah** | Support | Console support, Logs centralisés, Diagnostic distance |
| **7. Alexandre** | SecOps | API webhook, Intégration SIEM, Événements temps réel |

**Functional Areas révélées :**

1. **Agent Core** — Installation, exécution, mode offline, sync
2. **Dashboard RSSI/DPO** — Scores, écarts, tendances, filtres référentiels
3. **Console Admin IT** — Déploiement, monitoring, configuration
4. **Module Audit** — Rapports, preuves, accès auditeur, export
5. **Multi-tenant MSP** — Gestion clients, vue consolidée, alertes
6. **Support Tools** — Logs, diagnostic, état agents
7. **API/Intégrations** — Webhooks, SIEM, événements

## Domain-Specific Requirements

### GRC Compliance — Regulatory Overview

L'Agent GRC Sentinel opère dans un contexte réglementaire européen exigeant, avec trois cadres principaux :

| Référentiel | Entrée en vigueur | Cibles | Sanctions max |
|-------------|-------------------|--------|---------------|
| **NIS2** | Oct 2024, enforcement 2026 | Entités essentielles/importantes | €10M ou 2% CA |
| **DORA** | Jan 2025 | 20 types entités financières | €10M ou 2% CA |
| **RGPD** | Mai 2018 | Toute organisation traitant données UE | €20M ou 4% CA |

### Key Domain Concerns

#### 1. Conformité Réglementaire Multi-Référentiel

L'agent doit supporter simultanément plusieurs référentiels avec mapping croisé :

| Exigence NIS2 Art.21 | Mapping DORA | Mapping RGPD | Check Agent |
|----------------------|--------------|--------------|-------------|
| Chiffrement (§8) | ICT Risk Mgmt | Art.32 mesures techniques | `disk_encryption_enabled` |
| Cyber-hygiène (§7) | ICT Risk Mgmt | — | `antivirus_active`, `firewall_enabled` |
| Authentification MFA (§10) | ICT Risk Mgmt | Art.32 | `mfa_configured` |
| Sauvegardes (§3) | Resilience Testing | — | `backup_configured` |
| Contrôle accès (§9) | ICT Risk Mgmt | Art.32 | `password_policy_compliant` |
| Évaluation efficacité (§6) | Resilience Testing | — | `compliance_score_tracked` |

#### 2. Rétention et Traçabilité

| Exigence | Valeur | Justification |
|----------|--------|---------------|
| **Rétention preuves** | 12 mois | Couverture cycle audit annuel |
| **Horodatage** | UTC, format ISO 8601 | Preuve légale |
| **Intégrité preuves** | Hash SHA-256 signé | Non-répudiation |
| **Audit trail** | Toute modification tracée | Exigence NIS2/DORA |

#### 3. Localisation Données — EU Only

| Composant | Localisation | Justification |
|-----------|--------------|---------------|
| **SaaS Sentinel** | EU (France/Allemagne) | RGPD, Schrems II |
| **Données agent** | Transit EU uniquement | Souveraineté |
| **Stockage preuves** | EU | RGPD Art.44+ |
| **Backups** | EU | Conformité totale |

**Implications architecture :**
- Infrastructure cloud EU exclusivement (GCP europe-west, AWS eu-central)
- Aucun transfert données hors EEE
- Sous-traitants conformes RGPD avec clauses contractuelles

### Compliance Requirements

#### Checks MVP Obligatoires (20 contrôles)

**Catégorie Chiffrement (NIS2 §8, RGPD Art.32) :**

| ID | Check | Windows | Linux |
|----|-------|---------|-------|
| `ENC-001` | Chiffrement disque système | BitLocker | LUKS |
| `ENC-002` | Chiffrement disques secondaires | BitLocker | LUKS |
| `ENC-003` | TPM activé | TPM 2.0 | — |

**Catégorie Cyber-Hygiène (NIS2 §7) :**

| ID | Check | Windows | Linux |
|----|-------|---------|-------|
| `HYG-001` | Antivirus actif et à jour | Defender/tiers | ClamAV/tiers |
| `HYG-002` | Pare-feu activé | Windows Firewall | iptables/nftables |
| `HYG-003` | Mises à jour automatiques | Windows Update | unattended-upgrades |
| `HYG-004` | Verrouillage écran < 5 min | GPO | screensaver |

**Catégorie Authentification (NIS2 §10) :**

| ID | Check | Windows | Linux |
|----|-------|---------|-------|
| `AUTH-001` | Politique mot de passe conforme | GPO | PAM |
| `AUTH-002` | Historique mots de passe | GPO | PAM |
| `AUTH-003` | Verrouillage après échecs | GPO | PAM faillock |
| `AUTH-004` | MFA configuré (si applicable) | Windows Hello | PAM TOTP |

**Catégorie Contrôle Accès (NIS2 §9) :**

| ID | Check | Windows | Linux |
|----|-------|---------|-------|
| `ACC-001` | Comptes admin limités | Administrators | sudoers |
| `ACC-002` | Compte invité désactivé | Guest disabled | guest disabled |
| `ACC-003` | Droits admin locaux restreints | LAPS | — |

**Catégorie Sauvegarde (NIS2 §3) :**

| ID | Check | Windows | Linux |
|----|-------|---------|-------|
| `BCK-001` | Sauvegarde configurée | Backup service | rsync/borgbackup |
| `BCK-002` | Dernière sauvegarde < 7j | Vérification date | Vérification date |

**Catégorie Réseau (NIS2 §7) :**

| ID | Check | Windows | Linux |
|----|-------|---------|-------|
| `NET-001` | Protocoles obsolètes désactivés | SMBv1, TLS 1.0/1.1 | SSLv3, TLS 1.0/1.1 |
| `NET-002` | Ports inutiles fermés | netstat analysis | ss analysis |
| `NET-003` | Remote Desktop sécurisé | NLA enabled | SSH hardened |

### Industry Standards & Best Practices

| Standard | Application | Implémentation Agent |
|----------|-------------|---------------------|
| **CIS Benchmarks** | Hardening OS | Base des checks Windows/Linux |
| **NIST CSF** | Framework risques | Mapping catégories |
| **ISO 27001** | SMSI | Contrôles Annexe A mappés |
| **ANSSI Guides** | Recommandations FR | Intégration guides durcissement |

### Required Expertise & Validation

#### Expertise nécessaire pour développement

| Domaine | Compétence | Niveau |
|---------|------------|--------|
| **Sécurité Windows** | GPO, Registry, WMI, Defender API | Expert |
| **Sécurité Linux** | PAM, systemd, auditd, SELinux/AppArmor | Expert |
| **Conformité** | NIS2, DORA, RGPD, ISO 27001 | Senior |
| **Rust** | Async, FFI Windows/Linux, cross-compile | Senior |
| **Cryptographie** | TLS, PKI, signature, hashing | Senior |

#### Validation requise avant production

| Phase | Validation | Responsable |
|-------|------------|-------------|
| **Alpha** | Tests unitaires checks (100% coverage) | Dev |
| **Beta** | Pentest agent (OWASP) | Externe |
| **RC** | Audit code Rust (sécurité mémoire) | Externe |
| **GA** | Validation juridique RGPD | DPO |

### Implementation Considerations

#### Priorités conformité pour roadmap

| Phase | Focus Conformité | Checks |
|-------|------------------|--------|
| **MVP** | NIS2 + DORA essentiels | 20 checks |
| **V1.1** | RGPD complet + macOS | +10 checks |
| **V1.2** | ISO 27001 mapping | +15 checks |
| **V2.0** | Checks personnalisés | Illimité |

#### Contraintes architecturales conformité

| Contrainte | Impact | Solution |
|------------|--------|----------|
| **EU-only** | Pas de cloud US | GCP/AWS régions EU |
| **Rétention 12 mois** | Stockage important | Archivage S3 Glacier EU |
| **Preuves signées** | PKI nécessaire | Certificats Sentinel |
| **Audit trail** | Logging exhaustif | Structured logging JSON |

#### Risques conformité identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Faux positif check** | Moyenne | Confiance | Tests exhaustifs, seuils configurables |
| **Agent compromis** | Faible | Critique | Code signing, intégrité runtime |
| **Données hors EU** | Faible | Critique | Validation archi, audits |
| **Rétention insuffisante** | Faible | Élevé | Monitoring espace, alertes |

## Innovation & Novel Patterns

### Detected Innovation Areas

#### 1. Pont GRC ↔ Technique (Innovation Principale)

**Le problème fondamental :** Les outils GRC actuels sont déconnectés de la réalité technique. Les RSSI déclarent être conformes via questionnaires, mais personne ne vérifie factuellement sur les endpoints.

**L'innovation :** L'Agent GRC Sentinel est le premier produit à créer un pont bidirectionnel entre :
- **GRC (Gouvernance)** : Référentiels, exigences, mapping contrôles
- **Technique (Endpoints)** : Configurations réelles, preuves, état temps réel

**Résultat :** Transformation de la conformité de **déclarative** à **factuelle**.

#### 2. Double Fonction Conseil IA + Contrôle Technique

**Approche traditionnelle :** Outils séparés — consultant pour le conseil, scanner pour les contrôles.

**L'innovation :** Un agent unique qui :
1. **Conseille** (via IA SaaS) sur les mesures à implémenter pour atteindre la conformité
2. **Vérifie** (via agent endpoint) que les mesures sont effectivement appliquées
3. **Boucle fermée** : Conseil → Implémentation → Contrôle → Écart → Conseil

**Avantage compétitif :** Les concurrents sans SaaS GRC ne peuvent pas répliquer cette boucle.

#### 3. Intelligence Collective Opt-In

**Modèle traditionnel :** Chaque entreprise gère sa conformité en silo.

**L'innovation :** Partage anonymisé opt-in entre clients participants :
- Benchmarks conformité par secteur
- Détection patterns d'écarts communs
- Recommandations enrichies par l'intelligence collective
- Effet réseau : plus de participants = meilleure intelligence

**Monétisation :** Feature premium génératrice de revenus additionnels.

### Market Context & Competitive Landscape

| Segment | Acteurs | Approche | Limitation |
|---------|---------|----------|------------|
| **GRC SaaS** | Vanta, Drata, Secureframe | Agentless (APIs, intégrations) | Pas de vérification endpoint |
| **Endpoint Security** | CrowdStrike, SentinelOne | Agent sécurité | Pas de mapping GRC/réglementaire |
| **Compliance Scanners** | Qualys, Tenable, Rapid7 | Vuln scanning | Focus vulnérabilités, pas conformité |
| **MDM** | Intune, Jamf | Gestion devices | Score basique, pas de preuves audit |

**Position unique de l'Agent GRC Sentinel :** Premier produit à combiner vérification technique endpoint avec mapping GRC/réglementaire complet.

### Validation Approach

| Innovation | Méthode validation | Critère succès | Timeline |
|------------|-------------------|----------------|----------|
| **Pont GRC↔Technique** | Pilote 5 clients beta | Score conformité +30% en 3 mois | MVP+3 mois |
| **Double fonction** | A/B test conseil vs sans conseil | Adoption mesures +50% | MVP+2 mois |
| **Intelligence collective** | Cohorte 10 clients opt-in | Valeur perçue 4+/5 | V1.1+3 mois |
| **Conformité factuelle** | Feedback auditeurs | Temps audit -50% | MVP+1 mois |

**KPIs innovation à tracker :**
- Taux d'adoption agent par clients SaaS existants
- Delta score conformité avant/après agent
- NPS spécifique agent vs SaaS seul
- Revenus additionnels agent/endpoint

### Risk Mitigation

| Risque Innovation | Probabilité | Impact | Mitigation |
|-------------------|-------------|--------|------------|
| **Adoption lente** | Moyenne | Élevé | Pricing agressif early adopters, pilotes gratuits |
| **Concurrents copient** | Moyenne | Moyen | First-mover advantage, intégration SaaS profonde |
| **Intelligence collective rejetée** | Faible | Moyen | Opt-in strict, anonymisation forte, transparence |
| **Complexité double fonction** | Moyenne | Moyen | UX simple, wizard conseil, automation |

**Fallback strategies :**
- Si adoption lente → Focus clients régulés (NIS2/DORA obligatoire)
- Si concurrents copient → Accélérer roadmap, brevets potentiels
- Si intelligence collective rejetée → Feature désactivée, focus single-tenant

## Endpoint Agent Specific Requirements

### Project-Type Overview

L'Agent GRC Sentinel est un **agent endpoint natif** qui s'exécute en tant que service système sur Windows et Linux. Il combine les caractéristiques d'un agent de sécurité (léger, toujours actif, privilégié) avec les capacités d'un outil de conformité (checks, preuves, reporting).

**Caractéristiques clés du type endpoint_agent :**
- Exécution en arrière-plan permanente (daemon/service)
- Privilèges élevés pour accès système
- Communication cloud sécurisée
- Mode offline robuste
- Mise à jour automatique sans intervention utilisateur

### Technical Architecture Considerations

#### Modules Agent

| Module | Responsabilité | Crates Rust |
|--------|---------------|-------------|
| **Core** | Configuration, scheduler, lifecycle | `tokio`, `serde`, `config` |
| **Scanner** | Exécution checks, génération preuves | `windows-rs`, `nix` |
| **Sync** | Communication SaaS, queue, retry | `reqwest`, `tokio` |
| **Storage** | SQLite, cache règles, preuves | `rusqlite`, `serde_json` |
| **Logs** | Tracing structuré, rotation, upload | `tracing`, `tracing-subscriber` |
| **System** | Abstraction OS (Windows/Linux) | `windows-rs`, `nix`, `libc` |

### Platform Support Requirements

#### Windows

| Composant | Exigence | Justification |
|-----------|----------|---------------|
| **Version minimale** | Windows 10 1809+ | API modernes, support actif |
| **Architecture** | x64, ARM64 (V1.1) | Couverture parc standard |
| **Installation** | MSI, MSIX | GPO, SCCM, Intune compatible |
| **Service** | Windows Service | Auto-start, recovery |
| **Privilèges** | SYSTEM | Accès Registry, WMI, services |
| **Intégration** | Event Log, ETW | Diagnostic, SIEM |

**APIs Windows utilisées :**
- `WMI` — Inventaire hardware/software
- `Registry` — Configurations système
- `Windows Security Center` — État antivirus/firewall
- `BitLocker WMI` — État chiffrement
- `Group Policy` — Politiques appliquées
- `Windows Defender API` — Définitions, scans

#### Linux

| Composant | Exigence | Justification |
|-----------|----------|---------------|
| **Distributions** | Ubuntu 20.04+, RHEL 8+, Debian 11+ | 90%+ serveurs enterprise |
| **Architecture** | x64, ARM64 (V1.1) | Cloud + edge |
| **Installation** | DEB, RPM, tarball | Package managers standards |
| **Service** | systemd unit | Auto-start, watchdog |
| **Privilèges** | root | Accès /etc, /proc, /sys |
| **Intégration** | journald, syslog | Diagnostic, SIEM |

**Méthodes Linux utilisées :**
- `/etc/*` — Fichiers configuration
- `/proc/*` — État système runtime
- `PAM` — Politiques authentification
- `systemctl` — État services
- `dpkg/rpm` — Packages installés
- `iptables/nftables` — Règles firewall

### System Integration Requirements

#### Privilèges et Sécurité

| Aspect | Windows | Linux |
|--------|---------|-------|
| **Compte exécution** | NT AUTHORITY\SYSTEM | root |
| **Permissions fichiers** | ACL restrictives | 0600/0700 |
| **Protection binaire** | Authenticode signing | GPG signing |
| **Intégrité runtime** | Self-check hash | Self-check hash |
| **Communication** | mTLS + cert pinning | mTLS + cert pinning |

#### Installation Enterprise

| Méthode | Windows | Linux |
|---------|---------|-------|
| **GPO/SCCM** | MSI + transform | — |
| **Ansible** | win_package | apt/yum module |
| **Intune/MDM** | MSIX | — |
| **Script** | PowerShell | Bash |
| **Image** | WIM/DISM | Cloud-init |

### Update Strategy

#### Staged Rollout

| Phase | % Endpoints | Observation | Critère rollback |
|-------|-------------|-------------|------------------|
| **Canary** | 1% | 24h | Crash rate > 0.1% |
| **Early** | 10% | 48h | Error rate > 1% |
| **General** | 50% | 72h | Performance dégradée |
| **Complete** | 100% | Continu | Monitoring standard |

**Mécanisme rollback :**
- Backup version précédente conservée
- Rollback automatique si critères échec
- Rollback manuel via console admin
- Version minimum garantie (jamais downgrade critique)

### Offline Capabilities

| Capacité | Offline | Justification |
|----------|---------|---------------|
| **Exécution checks** | ✅ Oui | Règles en cache local |
| **Stockage preuves** | ✅ Oui | SQLite local |
| **Score local** | ✅ Oui | Calcul embarqué |
| **Alertes locales** | ✅ Oui | Logs système |
| **Nouvelles règles** | ❌ Non | Nécessite sync |
| **Reporting cloud** | ❌ Non | Nécessite connectivité |

**Durée autonomie :** 7 jours minimum (extensible par configuration)

### Security Model

#### Defence in Depth

| Couche | Protection | Implémentation |
|--------|------------|----------------|
| **Transport** | TLS 1.3 + mTLS | Certificate pinning |
| **Binaire** | Code signing | Authenticode/GPG |
| **Runtime** | Intégrité | Self-check SHA-256 |
| **Données** | Chiffrement | SQLite encryption |
| **Logs** | Signature | HMAC logs |
| **Config** | Protection | ACL/permissions restrictives |

### Connectivity Protocol

#### API Agent ↔ SaaS

| Endpoint | Méthode | Fréquence | Payload |
|----------|---------|-----------|---------|
| `/agent/register` | POST | Une fois | Agent info, token |
| `/agent/heartbeat` | POST | 5 min | Status, metrics |
| `/agent/rules` | GET | 1h | Règles actives |
| `/agent/results` | POST | Sur check | Preuves, scores |
| `/agent/config` | GET | 1h | Configuration |
| `/agent/update` | GET | 4h | Version disponible |

**Caractéristiques réseau :**
- HTTPS only (port 443)
- Proxy support (HTTP/SOCKS5)
- Retry avec backoff exponentiel
- Compression gzip

### Implementation Considerations

#### Build & Release

| Aspect | Choix | Justification |
|--------|-------|---------------|
| **CI/CD** | GitHub Actions | Cross-compile, signing |
| **Cross-compile** | cargo cross | Windows/Linux depuis Linux |
| **Signing Windows** | Azure SignTool | Authenticode EV |
| **Signing Linux** | GPG | Dépôts apt/yum |
| **Artifacts** | MSI, DEB, RPM, tarball | Couverture maximale |
| **Versioning** | SemVer | Compatibilité claire |

#### Testing Strategy

| Type | Couverture | Outils |
|------|------------|--------|
| **Unit tests** | 80%+ | cargo test |
| **Integration** | Checks réels | VMs Windows/Linux |
| **E2E** | Workflow complet | API tests |
| **Performance** | Benchmarks | criterion |
| **Security** | SAST + Pentest | cargo-audit, externe |

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP — Construire la fondation technique pour expansion future

**Rationale :**
- L'agent endpoint est le **cœur technique** de l'innovation
- Sans agent robuste, les features avancées sont impossibles
- Le marché NIS2/DORA crée une **urgence réglementaire**
- Les clients SaaS existants sont un **canal de distribution** immédiat

**Resource Requirements MVP :**

| Rôle | Effectif | Profil |
|------|----------|--------|
| **Tech Lead Rust** | 1 | Senior, expérience systèmes Windows/Linux |
| **Développeur Rust** | 2 | Mid-Senior, cross-platform |
| **Développeur Backend** | 1 | API Sentinel, intégration agent |
| **DevOps/SRE** | 0.5 | CI/CD, signing, déploiement |
| **QA** | 1 | Tests Windows/Linux, automatisation |
| **Product Manager** | 0.5 | Coordination, specs, clients beta |

**Équipe MVP totale :** 6 ETP

### MVP Feature Set (Phase 1)

#### Core User Journeys Supported

| Journey | Supported MVP | Limitations |
|---------|---------------|-------------|
| **Sophie (RSSI)** | ✅ Complet | Dashboard basique |
| **Thomas (Admin IT)** | ✅ Complet | — |
| **Marie (DPO)** | ⚠️ Partiel | RGPD simplifié |
| **Pierre (Auditeur)** | ⚠️ Partiel | Export PDF uniquement |
| **Julien (MSP)** | ❌ Post-MVP | Multi-tenant V1.1 |
| **Sarah (Support)** | ⚠️ Partiel | Logs basiques |
| **Alexandre (SecOps)** | ❌ Post-MVP | API webhook V1.1 |

#### Must-Have Capabilities MVP

| Capability | Priorité | Justification |
|------------|----------|---------------|
| **Agent Windows** | P0 | 70% parc client |
| **Agent Linux** | P0 | 30% parc client (serveurs) |
| **20 checks NIS2/DORA** | P0 | Valeur conformité core |
| **Score temps réel** | P0 | Différenciateur clé |
| **Mode offline 7j** | P0 | Fiabilité requise |
| **Dashboard endpoint** | P0 | Visibilité RSSI |
| **Preuves horodatées** | P0 | Audit trail |
| **Installation silencieuse** | P0 | Adoption enterprise |
| **mTLS + signing** | P0 | Sécurité non-négociable |
| **Staged rollout** | P1 | Risque déploiement |

#### Explicitly Out of MVP Scope

| Feature | Raison exclusion | Phase cible |
|---------|------------------|-------------|
| **macOS** | Complexité + faible demande | V1.1 |
| **Multi-tenant MSP** | Complexité archi | V1.1 |
| **Intelligence collective** | Nécessite volume clients | V1.2 |
| **Checks personnalisés** | UI complexe | V1.2 |
| **API publique webhook** | Intégrations tierces | V1.1 |
| **Remediation assistée** | Risque + complexité | V2.0 |
| **IA prédictive** | R&D | V2.0 |

### Post-MVP Features

#### Phase 2: Growth (V1.1 — MVP + 3 mois)

| Feature | Valeur business | Effort |
|---------|-----------------|--------|
| **macOS Support** | Couverture 95%+ parc | Moyen |
| **Multi-tenant MSP** | Channel MSSP | Élevé |
| **API webhook SIEM** | Intégration SecOps | Moyen |
| **+10 checks RGPD** | Conformité étendue | Faible |
| **Export PDF amélioré** | Auditeurs | Faible |
| **Console support avancée** | Réduction tickets | Moyen |

**Objectif V1.1 :** 25 000 endpoints, 100 clients, €75k MRR

#### Phase 3: Expansion (V1.2 — V1.1 + 3 mois)

| Feature | Valeur business | Effort |
|---------|-----------------|--------|
| **Intelligence collective opt-in** | Premium + effet réseau | Élevé |
| **Checks personnalisés UI** | Flexibilité client | Élevé |
| **+15 checks ISO 27001** | Marché SMSI | Moyen |
| **Benchmarks sectoriels** | Valeur analytique | Moyen |
| **ARM64 (Windows/Linux)** | Edge + IoT | Moyen |

**Objectif V1.2 :** 50 000 endpoints, conversion 40% SaaS→Agent

#### Vision Phase (V2.0 — V1.2 + 6 mois)

| Feature | Innovation | Complexité |
|---------|------------|------------|
| **Remediation assistée** | One-click fix avec validation | Très élevé |
| **IA prédictive** | Anticipation dérives | R&D |
| **Marketplace checks** | Communauté | Élevé |
| **Certification continue** | Attestation temps réel | Moyen |

### Risk Mitigation Strategy

#### Technical Risks

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Cross-compile Rust complexe** | Moyenne | Élevé | PoC early, expertise externe |
| **APIs Windows/Linux divergentes** | Moyenne | Moyen | Abstraction layer dès le départ |
| **Performance agent insuffisante** | Faible | Élevé | Benchmarks continus, profiling |
| **Mode offline bugs sync** | Moyenne | Moyen | Tests E2E, simulation déconnexions |

#### Market Risks

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Adoption lente clients SaaS** | Moyenne | Élevé | Pilotes gratuits, incentives early adopters |
| **Concurrents réagissent** | Moyenne | Moyen | First-mover, intégration profonde |
| **Pricing rejeté** | Faible | Moyen | Tiers flexibles, négociation volume |

#### Resource Risks

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Recrutement Rust difficile** | Élevée | Élevé | Remote OK, formation interne, consultants |
| **Équipe sous-dimensionnée** | Moyenne | Élevé | Scope MVP minimal, priorisation stricte |
| **Turnover clé** | Faible | Critique | Documentation, pair programming |

**Contingency :** MVP réalisable avec 4 ETP si scope réduit (Windows only, 10 checks)

### Scoping Decision Summary

| Dimension | Décision | Rationale |
|-----------|----------|-----------|
| **MVP Scope** | Platform MVP | Fondation technique prioritaire |
| **OS MVP** | Windows + Linux | 100% couverture cible |
| **Checks MVP** | 20 (NIS2/DORA) | Valeur conformité immédiate |
| **Journeys MVP** | 3/7 complets | Core value first |
| **Équipe MVP** | 6 ETP | Balance scope/vélocité |
| **Timeline MVP** | 4-5 mois | Marché NIS2 urgent |

## Functional Requirements

### Agent Core

- **FR1:** L'agent peut s'installer silencieusement sur Windows 10+ sans redémarrage
- **FR2:** L'agent peut s'installer silencieusement sur Linux (Ubuntu 20.04+, RHEL 8+) via package manager
- **FR3:** L'agent peut s'exécuter en tant que service système avec démarrage automatique
- **FR4:** L'agent peut se configurer via fichier JSON ou variables d'environnement
- **FR5:** L'agent peut s'enregistrer auprès du SaaS Sentinel avec token d'authentification
- **FR6:** L'agent peut envoyer un heartbeat périodique (état, métriques) au SaaS
- **FR7:** L'agent peut se désinstaller proprement sans laisser de résidus
- **FR8:** L'agent peut fonctionner avec une empreinte ressources minimale (< 2% CPU, < 100MB RAM)

### Compliance Checks

- **FR9:** L'agent peut exécuter des checks de conformité selon les règles configurées
- **FR10:** L'agent peut vérifier l'état du chiffrement disque (BitLocker/LUKS)
- **FR11:** L'agent peut vérifier l'état de l'antivirus (actif, définitions à jour)
- **FR12:** L'agent peut vérifier l'état du pare-feu (activé, règles)
- **FR13:** L'agent peut vérifier la politique de mot de passe (complexité, expiration)
- **FR14:** L'agent peut vérifier le verrouillage automatique de session
- **FR15:** L'agent peut vérifier l'état des mises à jour système
- **FR16:** L'agent peut vérifier les protocoles obsolètes désactivés (SMBv1, TLS 1.0/1.1)
- **FR17:** L'agent peut vérifier la configuration sauvegarde (active, date dernière)
- **FR18:** L'agent peut vérifier les comptes administrateurs locaux
- **FR19:** L'agent peut vérifier la configuration MFA si applicable
- **FR20:** L'agent peut vérifier la sécurité du bureau à distance (NLA/SSH hardened)
- **FR21:** L'agent peut générer une preuve horodatée pour chaque check exécuté
- **FR22:** L'agent peut calculer un score de conformité local basé sur les résultats

### Synchronization & Offline

- **FR23:** L'agent peut télécharger les règles de checks depuis le SaaS
- **FR24:** L'agent peut mettre en cache les règles localement pour exécution offline
- **FR25:** L'agent peut stocker les résultats de checks et preuves localement (SQLite)
- **FR26:** L'agent peut fonctionner en mode offline pendant 7 jours minimum
- **FR27:** L'agent peut synchroniser les données en attente lors du retour de connectivité
- **FR28:** L'agent peut gérer les conflits de synchronisation après période offline
- **FR29:** L'agent peut télécharger sa configuration depuis le SaaS
- **FR30:** L'agent peut uploader les résultats de checks vers le SaaS

### Dashboard & Visualization (SaaS)

- **FR31:** Le RSSI peut visualiser le score de conformité global de son parc
- **FR32:** Le RSSI peut visualiser le score de conformité par endpoint
- **FR33:** Le RSSI peut visualiser les écarts de conformité détaillés par check
- **FR34:** Le RSSI peut visualiser la tendance historique du score (30 jours minimum)
- **FR35:** Le RSSI peut filtrer la vue par référentiel (NIS2, DORA, RGPD)
- **FR36:** Le RSSI peut filtrer la vue par statut de conformité (conforme, non-conforme)
- **FR37:** Le RSSI peut recevoir une alerte lors de dégradation du score
- **FR38:** Le DPO peut visualiser une vue filtrée RGPD des endpoints

### Administration

- **FR39:** L'administrateur IT peut visualiser la liste des agents déployés
- **FR40:** L'administrateur IT peut visualiser l'état de connexion de chaque agent
- **FR41:** L'administrateur IT peut visualiser la version de chaque agent
- **FR42:** L'administrateur IT peut télécharger les packages d'installation (MSI, DEB, RPM)
- **FR43:** L'administrateur IT peut générer un token d'enregistrement pour nouveaux agents
- **FR44:** L'administrateur IT peut configurer la fréquence des checks
- **FR45:** L'administrateur IT peut activer/désactiver des checks spécifiques
- **FR46:** L'administrateur IT peut forcer une synchronisation d'un agent
- **FR47:** L'administrateur IT peut désinscrire un agent du parc

### Audit & Reporting

- **FR48:** L'auditeur peut accéder en lecture seule aux données de conformité
- **FR49:** L'auditeur peut visualiser les preuves techniques horodatées
- **FR50:** L'auditeur peut exporter un rapport de conformité par référentiel (PDF)
- **FR51:** L'auditeur peut visualiser l'historique de conformité sur 12 mois
- **FR52:** Le système peut conserver les preuves pendant 12 mois minimum
- **FR53:** Le système peut horodater chaque preuve au format ISO 8601 UTC
- **FR54:** Le système peut garantir l'intégrité des preuves (hash SHA-256)

### Security & Authentication

- **FR55:** L'agent peut s'authentifier auprès du SaaS via mTLS
- **FR56:** L'agent peut valider le certificat serveur (certificate pinning)
- **FR57:** L'agent peut vérifier sa propre intégrité au démarrage (self-check)
- **FR58:** L'agent peut chiffrer les données stockées localement
- **FR59:** L'agent peut signer les logs pour garantir leur intégrité
- **FR60:** Le système peut valider la signature du binaire agent avant installation
- **FR61:** Le système peut révoquer un agent compromis à distance

### Updates & Deployment

- **FR62:** L'agent peut vérifier la disponibilité d'une nouvelle version
- **FR63:** L'agent peut télécharger et appliquer une mise à jour automatiquement
- **FR64:** L'agent peut effectuer un rollback vers la version précédente en cas d'échec
- **FR65:** Le système peut déployer les mises à jour par phases (staged rollout)
- **FR66:** L'administrateur peut configurer la politique de mise à jour (automatique, manuel, différé)
- **FR67:** L'administrateur peut déclencher une mise à jour manuelle sur un agent
- **FR68:** L'administrateur peut bloquer une version spécifique

### Support & Diagnostics

- **FR69:** L'équipe support peut visualiser les logs d'un agent spécifique
- **FR70:** L'équipe support peut visualiser l'état de connexion détaillé d'un agent
- **FR71:** L'équipe support peut identifier les erreurs récentes d'un agent
- **FR72:** L'équipe support peut déclencher un diagnostic à distance

## Non-Functional Requirements

### Performance

| ID | Exigence | Métrique | Cible |
|----|----------|----------|-------|
| **NFR-P1** | Impact CPU agent au repos | % CPU moyen | < 0.5% |
| **NFR-P2** | Impact CPU agent pendant check | % CPU pic | < 5% |
| **NFR-P3** | Consommation mémoire agent | RAM | < 100 MB |
| **NFR-P4** | Taille binaire agent | MB | < 20 MB |
| **NFR-P5** | Temps démarrage agent | Secondes | < 5s |
| **NFR-P6** | Temps exécution check unitaire | Secondes | < 2s |
| **NFR-P7** | Temps exécution scan complet (20 checks) | Secondes | < 30s |
| **NFR-P8** | Latence heartbeat | Secondes | < 1s (p95) |
| **NFR-P9** | Temps synchronisation post-offline | Minutes | < 5 min |
| **NFR-P10** | Impact I/O disque | IOPS | < 10 IOPS moyen |

### Security

| ID | Exigence | Spécification |
|----|----------|---------------|
| **NFR-S1** | Chiffrement transport | TLS 1.3 minimum, mTLS obligatoire |
| **NFR-S2** | Chiffrement stockage local | SQLite avec SQLCipher (AES-256) |
| **NFR-S3** | Signature binaire Windows | Authenticode avec certificat EV |
| **NFR-S4** | Signature binaire Linux | GPG avec clé dédiée |
| **NFR-S5** | Certificate pinning | Empreinte SHA-256 du certificat serveur |
| **NFR-S6** | Intégrité runtime | Self-check SHA-256 au démarrage |
| **NFR-S7** | Protection credentials | Jamais stockés en clair, token rotatif |
| **NFR-S8** | Logs signés | HMAC-SHA256 pour chaque entrée |
| **NFR-S9** | Permissions fichiers | 0600 (Linux) / ACL restrictives (Windows) |
| **NFR-S10** | Isolation processus | Service dédié, pas de shell externe |
| **NFR-S11** | Audit vulnérabilités | cargo-audit CI, pentest externe avant GA |

### Reliability

| ID | Exigence | Métrique | Cible |
|----|----------|----------|-------|
| **NFR-R1** | Uptime agent | Disponibilité | ≥ 99.5% |
| **NFR-R2** | Mode offline | Durée autonomie | ≥ 7 jours |
| **NFR-R3** | Récupération crash | Redémarrage automatique | < 30s |
| **NFR-R4** | Perte données offline | Données perdues après crash | 0% |
| **NFR-R5** | Rollback update | Temps restauration version | < 2 min |
| **NFR-R6** | Tolérance réseau | Retry avec backoff | Jusqu'à 24h |
| **NFR-R7** | Corruption données | Détection et récupération | Automatique |
| **NFR-R8** | Watchdog service | Détection agent bloqué | < 60s |

### Scalability

| ID | Exigence | Métrique | Cible |
|----|----------|----------|-------|
| **NFR-SC1** | Agents simultanés | Endpoints par tenant | 10 000+ |
| **NFR-SC2** | Agents totaux plateforme | Endpoints totaux | 100 000+ |
| **NFR-SC3** | Heartbeats simultanés | Requêtes/seconde API | 500 req/s |
| **NFR-SC4** | Upload résultats | Requêtes/seconde API | 200 req/s |
| **NFR-SC5** | Stockage preuves | Croissance par endpoint/mois | < 50 MB |
| **NFR-SC6** | Dégradation performance | Impact à 10x charge | < 20% latence |

### Compliance

| ID | Exigence | Spécification |
|----|----------|---------------|
| **NFR-C1** | Localisation données | EU uniquement (pas de transfert hors EEE) |
| **NFR-C2** | Rétention preuves | 12 mois minimum |
| **NFR-C3** | Horodatage preuves | ISO 8601 UTC, source NTP |
| **NFR-C4** | Intégrité preuves | Hash SHA-256 signé |
| **NFR-C5** | Audit trail | Toute modification tracée avec acteur |
| **NFR-C6** | Droit à l'oubli | Suppression données agent possible |
| **NFR-C7** | Export données | Format structuré (JSON) sur demande |
| **NFR-C8** | Sous-traitants | Conformité RGPD avec clauses contractuelles |

### Integration

| ID | Exigence | Spécification |
|----|----------|---------------|
| **NFR-I1** | Protocole API | REST/HTTPS, JSON |
| **NFR-I2** | Authentification API | Bearer token + mTLS |
| **NFR-I3** | Compatibilité proxy | HTTP/SOCKS5 avec authentification |
| **NFR-I4** | Ports réseau | 443 uniquement (firewall-friendly) |
| **NFR-I5** | Déploiement Windows | GPO, SCCM, Intune compatible |
| **NFR-I6** | Déploiement Linux | apt, yum, Ansible compatible |
| **NFR-I7** | Format logs | JSON structuré, compatible SIEM |
| **NFR-I8** | Compression | gzip pour tous les transfers |

### Maintainability

| ID | Exigence | Spécification |
|----|----------|---------------|
| **NFR-M1** | Couverture tests | ≥ 80% code coverage |
| **NFR-M2** | Documentation code | Rustdoc pour modules publics |
| **NFR-M3** | CI/CD | Build + tests automatiques sur PR |
| **NFR-M4** | Versioning | SemVer strict |
| **NFR-M5** | Backward compatibility | API stable sur version majeure |
| **NFR-M6** | Logging structuré | tracing avec niveaux (ERROR, WARN, INFO, DEBUG) |
| **NFR-M7** | Métriques runtime | CPU, RAM, état checks exposés |
| **NFR-M8** | Cross-compile | Build unique pour Windows + Linux |

### Usability (Dashboard SaaS)

| ID | Exigence | Spécification |
|----|----------|---------------|
| **NFR-U1** | Temps chargement dashboard | < 3s initial, < 1s navigation |
| **NFR-U2** | Responsive design | Desktop + tablette |
| **NFR-U3** | Langues supportées | FR, EN, DE |
| **NFR-U4** | Export données | PDF, CSV, JSON |

