---
stepsCompleted: [1, 2, 3, 4, 5, 6]
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

