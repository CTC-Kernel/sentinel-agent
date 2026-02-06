# PRD : Module CMDB - Sentinel GRC v2

---

**Document ID:** PRD-CMDB-001
**Version:** 1.0
**Date:** 2026-02-06
**Auteur:** Mary (Business Analyst) & Thibaultllopis
**Statut:** DRAFT

---

## Table des Matières

1. [Introduction](#1-introduction)
2. [Contexte et Problème](#2-contexte-et-problème)
3. [Objectifs et Métriques](#3-objectifs-et-métriques)
4. [Périmètre](#4-périmètre)
5. [Exigences Fonctionnelles](#5-exigences-fonctionnelles)
6. [Exigences Non-Fonctionnelles](#6-exigences-non-fonctionnelles)
7. [User Experience](#7-user-experience)
8. [Intégrations](#8-intégrations)
9. [Sécurité et Conformité](#9-sécurité-et-conformité)
10. [Dépendances et Contraintes](#10-dépendances-et-contraintes)
11. [Plan de Release](#11-plan-de-release)
12. [Critères de Succès](#12-critères-de-succès)
13. [Annexes](#13-annexes)

---

## 1. Introduction

### 1.1 Purpose

Ce PRD définit les exigences pour l'implémentation d'un module CMDB (Configuration Management Database) complet au sein de Sentinel GRC v2. Le module transformera l'inventaire d'actifs existant en une CMDB conforme ITIL 4, exploitant l'infrastructure agent Rust déjà déployée.

### 1.2 Audience

- Équipe de développement (Frontend React, Backend Firebase, Agent Rust)
- Product Owner
- Architecte technique
- QA Engineers
- Security Officer

### 1.3 Références

| Document | Localisation |
|----------|--------------|
| Product Brief CMDB | `_bmad-output/planning-artifacts/product-brief-cmdb.md` |
| Project Context | `_bmad-output/project-context.md` |
| Architecture existante | `_bmad-output/planning-artifacts/architecture.md` |

---

## 2. Contexte et Problème

### 2.1 Situation Actuelle

Sentinel GRC v2 dispose actuellement de :

| Composant | Capacité | Limitation |
|-----------|----------|------------|
| **Agent Rust** | Collecte software, réseau, métriques | Pas de hardware détaillé, pas de lien CMDB |
| **Module Assets** | Inventaire multi-types avec CIA | Saisie manuelle, pas de découverte auto |
| **Relations** | Arrays dénormalisés dans Firestore | Pas de modèle relationnel, pas d'impact |

### 2.2 Problèmes Identifiés

1. **Découverte Manuelle** : Les administrateurs doivent créer manuellement chaque actif alors que l'agent collecte déjà ces informations
2. **Pas de Réconciliation** : Aucun lien automatique entre les données découvertes et l'inventaire
3. **Relations Primitives** : Impossible de modéliser "Application X dépend de Database Y sur Server Z"
4. **Pas d'Analyse d'Impact** : Impossible de répondre à "Que se passe-t-il si ce serveur tombe ?"
5. **Non-conformité ITIL** : L'inventaire actuel ne répond pas aux exigences ITIL 4 SCM

### 2.3 Opportunité

L'infrastructure existante (Agent Rust + Plateforme SaaS) fournit 75% des fondations nécessaires. L'ajout d'un moteur de réconciliation et d'un modèle relationnel transformerait Sentinel GRC en solution CMDB complète, différenciateur majeur sur le marché GRC.

---

## 3. Objectifs et Métriques

### 3.1 Objectifs Business

| ID | Objectif | Horizon |
|----|----------|---------|
| OBJ-1 | Réduire le temps de création d'inventaire de 80% | 6 mois |
| OBJ-2 | Atteindre la conformité ITIL 4 SCM | 12 mois |
| OBJ-3 | Réduire le MTTR incidents de 30% | 9 mois |
| OBJ-4 | Couvrir 100% des exigences DORA Art.9 (registre ICT) | 6 mois |

### 3.2 Métriques de Succès (KPIs)

| KPI | Baseline | Cible Phase 1 | Cible Phase 3 |
|-----|----------|---------------|---------------|
| Taux de découverte automatique | 0% | 85% | 95% |
| Taux de réconciliation auto | 0% | 70% | 90% |
| CIs avec relations mappées | 0% | 50% | 80% |
| Data Quality Score moyen | N/A | 75/100 | 90/100 |
| Requêtes d'impact / semaine | 0 | 20 | 100+ |
| MTTR (incidents liés assets) | Baseline | -15% | -30% |

### 3.3 Métriques Qualité CMDB

| Métrique | Formule | Cible |
|----------|---------|-------|
| **Freshness** | CIs mis à jour < 7 jours / Total CIs | > 95% |
| **Completeness** | Champs requis remplis / Total champs requis | > 90% |
| **Accuracy** | CIs validés / Total CIs | > 80% |
| **Orphan Rate** | CIs sans relations / Total CIs | < 10% |
| **Duplicate Rate** | CIs dupliqués / Total CIs | < 2% |

---

## 4. Périmètre

### 4.1 In Scope (Phase 1-3)

| Fonctionnalité | Phase | Priorité |
|----------------|-------|----------|
| Modèle de données CI (Configuration Item) | 1 | P0 |
| Migration Asset → CI | 1 | P0 |
| Moteur de réconciliation (IRE) | 1 | P0 |
| Dashboard Discovery | 1 | P0 |
| Workflow de validation CI | 1 | P1 |
| Entité Relationship CMDB | 2 | P0 |
| Graphe de dépendances (UI) | 2 | P1 |
| Analyse d'impact | 2 | P0 |
| Enrichissement hardware agent | 3 | P1 |
| Gestion des licences | 3 | P2 |
| API CMDB RESTful | 3 | P1 |
| Intégration cloud (AWS/Azure) | 3 | P2 |

### 4.2 Out of Scope

| Fonctionnalité | Raison | Alternative |
|----------------|--------|-------------|
| Fédération CMDB multi-instances | Complexité, ROI faible | Import/Export CSV |
| Intégration ServiceNow/BMC | Coût licensing | API générique |
| SNMP Discovery | Agent couvre le besoin | Agent Rust existant |
| Container/K8s discovery | Hors périmètre initial | Phase future |

### 4.3 Hypothèses

1. L'agent Rust est déployé sur > 80% des endpoints à gérer
2. Les utilisateurs ont des droits suffisants pour valider les CIs
3. La structure organisationnelle (teams, ownership) existe dans le système
4. Les assets existants peuvent être migrés vers le nouveau modèle CI

### 4.4 Dépendances

| Dépendance | Type | Impact |
|------------|------|--------|
| Agent Rust v2.x déployé | Technique | Bloquant pour discovery |
| Module Assets existant | Technique | Migration requise |
| VoxelEngine (graphe 3D) | Technique | Réutilisation pour visualisation |
| Firebase Cloud Functions | Infra | Réconciliation batch |

---

## 5. Exigences Fonctionnelles

### 5.1 FR-100: Gestion des Configuration Items (CIs)

#### FR-101: Création de CI

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-101.1 | Le système DOIT permettre la création manuelle de CI avec les attributs obligatoires (nom, classe, type, owner) | P0 |
| FR-101.2 | Le système DOIT créer automatiquement des CIs à partir des données de découverte agent | P0 |
| FR-101.3 | Le système DOIT générer un fingerprint unique pour chaque CI hardware | P0 |
| FR-101.4 | Le système DOIT supporter les classes de CI : Hardware, Software, Service, Document, Network, Cloud | P0 |
| FR-101.5 | Le système DOIT associer un Data Quality Score à chaque CI | P1 |

#### FR-102: Modification de CI

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-102.1 | Le système DOIT permettre la modification des attributs CI avec audit trail | P0 |
| FR-102.2 | Le système DOIT mettre à jour automatiquement les CIs lors de nouvelles découvertes | P0 |
| FR-102.3 | Le système DOIT détecter et signaler les conflits de mise à jour (agent vs manuel) | P1 |
| FR-102.4 | Le système DOIT supporter le merge de CIs dupliqués | P1 |

#### FR-103: Lifecycle CI

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-103.1 | Le système DOIT supporter les statuts : In_Stock, In_Use, In_Maintenance, Retired, Missing | P0 |
| FR-103.2 | Le système DOIT marquer "Missing" les CIs non découverts depuis > 30 jours | P1 |
| FR-103.3 | Le système DOIT archiver (soft delete) les CIs Retired après 90 jours | P2 |

### 5.2 FR-200: Moteur de Réconciliation (IRE)

#### FR-201: Identification

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-201.1 | Le système DOIT matcher les CIs par fingerprint selon les règles de priorité configurées | P0 |
| FR-201.2 | Le système DOIT supporter les critères de matching : Serial Number, MAC Address, Hostname+OS, IP Address | P0 |
| FR-201.3 | Le système DOIT calculer un score de confiance (0-100) pour chaque match | P0 |
| FR-201.4 | Le système DOIT permettre la configuration des seuils de confiance (auto-match, validation requise, rejet) | P0 |

**Règles de matching par défaut :**

```
Priority 1: Serial Number (exact match) → Confidence 100
Priority 2: MAC Address primary NIC (exact match) → Confidence 90
Priority 3: Hostname + OS Fingerprint (normalized) → Confidence 70
Priority 4: IP Address (exact match, fallback) → Confidence 40
```

#### FR-202: Réconciliation

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-202.1 | Le système DOIT exécuter la réconciliation automatiquement à chaque sync agent | P0 |
| FR-202.2 | Le système DOIT placer en queue de validation les CIs avec confiance < seuil configurable | P0 |
| FR-202.3 | Le système DOIT créer automatiquement un CI si aucun match et auto-create activé | P0 |
| FR-202.4 | Le système DOIT notifier les owners des CIs nécessitant validation | P1 |
| FR-202.5 | Le système DOIT supporter la réconciliation batch (import CSV, cloud sync) | P2 |

#### FR-203: Déduplication

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-203.1 | Le système DOIT détecter les CIs potentiellement dupliqués | P1 |
| FR-203.2 | Le système DOIT proposer le merge avec prévisualisation des attributs | P1 |
| FR-203.3 | Le système DOIT conserver l'historique des CIs mergés | P1 |

### 5.3 FR-300: Relations CMDB

#### FR-301: Création de Relations

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-301.1 | Le système DOIT permettre la création de relations typées entre CIs | P0 |
| FR-301.2 | Le système DOIT supporter les types de relations : depends_on, uses, runs_on, hosted_on, installed_on, connects_to, interfaces_with, contains, member_of, provides, consumes, owned_by, supported_by | P0 |
| FR-301.3 | Le système DOIT valider la cohérence des relations (ex: Software ne peut pas "contains" Hardware) | P1 |
| FR-301.4 | Le système DOIT supporter les relations bidirectionnelles avec inverse automatique | P1 |

**Matrice de Relations Valides :**

| Source → Target | Hardware | Software | Service | Network |
|-----------------|----------|----------|---------|---------|
| Hardware | contains, connects_to | installed_on (inv) | hosts (inv) | member_of |
| Software | runs_on, installed_on | depends_on, uses | provides | - |
| Service | hosted_on | depends_on | depends_on, uses | uses |
| Network | contains | - | - | connects_to |

#### FR-302: Découverte Automatique de Relations

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-302.1 | Le système DOIT inférer les relations "runs_on" à partir des process/host de l'agent | P1 |
| FR-302.2 | Le système DOIT inférer les relations "connects_to" à partir des connexions réseau actives | P1 |
| FR-302.3 | Le système DOIT marquer les relations inférées avec un score de confiance | P1 |
| FR-302.4 | Le système DOIT permettre la validation/rejet des relations inférées | P1 |

#### FR-303: Gestion des Relations

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-303.1 | Le système DOIT mettre à jour les relations lors de la modification/suppression de CIs | P0 |
| FR-303.2 | Le système DOIT notifier lors de la rupture de relations critiques | P1 |
| FR-303.3 | Le système DOIT supporter le versioning des relations | P2 |

### 5.4 FR-400: Analyse d'Impact

#### FR-401: Calcul d'Impact

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-401.1 | Le système DOIT calculer l'impact d'un CI down en parcourant le graphe de dépendances | P0 |
| FR-401.2 | Le système DOIT identifier les dépendances directes (1 hop) et indirectes (N hops, configurable max 5) | P0 |
| FR-401.3 | Le système DOIT classer l'impact par niveau : Critical, High, Medium, Low | P0 |
| FR-401.4 | Le système DOIT identifier les services métier impactés | P0 |

#### FR-402: Visualisation Impact

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-402.1 | Le système DOIT afficher le "blast radius" visuellement (graphe) | P0 |
| FR-402.2 | Le système DOIT lister les CIs impactés avec leur niveau d'impact | P0 |
| FR-402.3 | Le système DOIT estimer le nombre d'utilisateurs potentiellement impactés | P1 |
| FR-402.4 | Le système DOIT permettre l'export du rapport d'impact (PDF, CSV) | P1 |

#### FR-403: Simulation de Changement

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-403.1 | Le système DOIT permettre de simuler un changement (maintenance, update, decommission) | P1 |
| FR-403.2 | Le système DOIT générer un rapport d'impact préventif | P1 |
| FR-403.3 | Le système DOIT recommander une fenêtre de maintenance basée sur l'impact | P2 |

### 5.5 FR-500: Discovery Dashboard

#### FR-501: Vue Découverte

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-501.1 | Le système DOIT afficher les CIs découverts en temps quasi-réel | P0 |
| FR-501.2 | Le système DOIT filtrer par : source (agent, manual, import), statut, classe, confiance | P0 |
| FR-501.3 | Le système DOIT afficher les statistiques de découverte (nouveaux, mis à jour, manquants) | P0 |

#### FR-502: Queue de Validation

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-502.1 | Le système DOIT présenter les CIs en attente de validation avec le match proposé | P0 |
| FR-502.2 | Le système DOIT permettre d'approuver, rejeter, ou merger en un clic | P0 |
| FR-502.3 | Le système DOIT supporter la validation en masse | P1 |
| FR-502.4 | Le système DOIT assigner automatiquement les validations aux owners appropriés | P1 |

### 5.6 FR-600: Enrichissement Agent

#### FR-601: Hardware Discovery

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-601.1 | L'agent DOIT collecter les informations CPU (model, cores, frequency) | P1 |
| FR-601.2 | L'agent DOIT collecter les informations RAM (type, size, slots) | P1 |
| FR-601.3 | L'agent DOIT collecter les informations Storage (type, size, serial, health) | P1 |
| FR-601.4 | L'agent DOIT collecter les informations BIOS/Firmware (vendor, version, serial) | P1 |
| FR-601.5 | L'agent DOIT collecter la liste des certificats installés | P2 |

#### FR-602: Software Enrichment

| ID | Exigence | Priorité |
|----|----------|----------|
| FR-602.1 | Le système DOIT mapper les logiciels découverts vers leur CPE | P1 |
| FR-602.2 | Le système DOIT corréler les CPE avec les CVE connus | P1 |
| FR-602.3 | Le système DOIT calculer un score de vulnérabilité par software CI | P1 |

---

## 6. Exigences Non-Fonctionnelles

### 6.1 NFR-100: Performance

| ID | Exigence | Cible |
|----|----------|-------|
| NFR-101 | Temps de réconciliation par CI | < 500ms |
| NFR-102 | Temps de calcul d'impact (5 hops max) | < 2s |
| NFR-103 | Temps de chargement Discovery Dashboard | < 1s |
| NFR-104 | Nombre de CIs supportés par organisation | > 100,000 |
| NFR-105 | Throughput réconciliation batch | > 1000 CIs/minute |

### 6.2 NFR-200: Scalabilité

| ID | Exigence | Cible |
|----|----------|-------|
| NFR-201 | Scale horizontal Cloud Functions réconciliation | Auto-scale 1-100 instances |
| NFR-202 | Partitionnement Firestore par organization | Sharding automatique |
| NFR-203 | Indexation graphe relations | O(log n) pour traversal |

### 6.3 NFR-300: Disponibilité

| ID | Exigence | Cible |
|----|----------|-------|
| NFR-301 | Disponibilité service CMDB | 99.9% |
| NFR-302 | RPO (Recovery Point Objective) | 1 heure |
| NFR-303 | RTO (Recovery Time Objective) | 4 heures |
| NFR-304 | Mode dégradé si agent offline | Données cached valides 7 jours |

### 6.4 NFR-400: Sécurité

| ID | Exigence | Cible |
|----|----------|-------|
| NFR-401 | Isolation multi-tenant | 100% - organizationId sur toutes les queries |
| NFR-402 | Chiffrement données au repos | AES-256 (Firestore default) |
| NFR-403 | Chiffrement données en transit | TLS 1.3 |
| NFR-404 | Audit log toutes opérations CMDB | Rétention 2 ans |
| NFR-405 | RBAC sur opérations CMDB | Granularité CI class |

### 6.5 NFR-500: Maintenabilité

| ID | Exigence | Cible |
|----|----------|-------|
| NFR-501 | Couverture tests unitaires | > 80% |
| NFR-502 | Couverture tests intégration | > 60% |
| NFR-503 | Documentation API | 100% endpoints documentés |
| NFR-504 | Logs structurés | Format JSON, correlation ID |

### 6.6 NFR-600: Compatibilité

| ID | Exigence | Cible |
|----|----------|-------|
| NFR-601 | Browsers supportés | Chrome, Firefox, Safari, Edge (2 dernières versions) |
| NFR-602 | Mobile responsive | Tablet et Desktop |
| NFR-603 | Backward compatibility Asset → CI | Migration sans perte de données |

---

## 7. User Experience

### 7.1 Personas

#### Persona 1: Admin IT (Primary)

| Attribut | Valeur |
|----------|--------|
| Nom | Sophie Martin |
| Rôle | Administratrice Infrastructure IT |
| Objectif | Maintenir un inventaire précis et à jour |
| Pain Point | Passe 10h/semaine à mettre à jour manuellement l'inventaire |
| Besoin | Découverte automatique avec validation simplifiée |

#### Persona 2: RSSI (Secondary)

| Attribut | Valeur |
|----------|--------|
| Nom | Marc Dubois |
| Rôle | Responsable Sécurité SI |
| Objectif | Comprendre l'exposition aux risques par asset |
| Pain Point | Impossible de savoir l'impact d'une vulnérabilité |
| Besoin | Vue impact + corrélation CVE par CI |

#### Persona 3: IT Manager (Tertiary)

| Attribut | Valeur |
|----------|--------|
| Nom | Julie Lefebvre |
| Rôle | Responsable IT |
| Objectif | Planifier les maintenances sans impact business |
| Pain Point | Découvre les dépendances pendant les incidents |
| Besoin | Simulation d'impact avant changement |

### 7.2 User Flows Principaux

#### Flow 1: Validation CI Découvert

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Notification│────▶│ Review CI   │────▶│ Approve/    │────▶│ CI Actif    │
│ Nouveau CI  │     │ + Match     │     │ Reject/Merge│     │ dans CMDB   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

#### Flow 2: Analyse d'Impact

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Sélection   │────▶│ Choix type  │────▶│ Visualiser  │────▶│ Export      │
│ CI cible    │     │ (down/maint)│     │ Blast Radius│     │ Rapport     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

#### Flow 3: Création Relation

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Ouvrir CI   │────▶│ Tab         │────▶│ Sélect CI   │────▶│ Relation    │
│ source      │     │ Relations   │     │ + Type rel. │     │ créée       │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 7.3 Wireframes Clés

#### 7.3.1 Discovery Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CMDB Discovery                                            [Refresh] [⚙]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ Discovered │  │ Pending    │  │ Matched    │  │ Missing    │         │
│  │    247     │  │    23      │  │   1,842    │  │    12      │         │
│  │  +15 today │  │  ⚠ Review  │  │  ✓ Auto    │  │  ⚠ Check   │         │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Pending Validation Queue                               [Bulk Approve]│ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ ☐ │ WORKSTATION-PC42  │ Match: Asset-1234 │ Conf: 87% │ [✓][✗][⇄]  │ │
│  │ ☐ │ SRV-DB-PROD-01    │ No match found    │ Conf: --  │ [+][✗]     │ │
│  │ ☐ │ SW-Office365      │ Match: Asset-5678 │ Conf: 92% │ [✓][✗][⇄]  │ │
│  │ ☐ │ NET-SWITCH-FL2    │ Duplicate of CI-9 │ Conf: 95% │ [Merge][✗] │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Recent Activity                                                     │ │
│  │ • 14:32 - Agent sync: 15 CIs updated (srv-web-01, srv-web-02, ...)  │ │
│  │ • 14:28 - Sophie approved 3 CIs                                     │ │
│  │ • 14:15 - New device discovered: PRINTER-FL3-HP                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 7.3.2 Impact Analysis View

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Impact Analysis: SRV-DB-PROD-01                          [Export PDF]    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Simulation: [Server Down ▼]    Depth: [3 hops ▼]    [Calculate]        │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      BLAST RADIUS GRAPH                             │ │
│  │                                                                     │ │
│  │                         ┌──────────┐                                │ │
│  │                         │ DB-PROD  │ ← Source                       │ │
│  │                         │ ███████  │                                │ │
│  │                         └────┬─────┘                                │ │
│  │               ┌──────────────┼──────────────┐                       │ │
│  │               ▼              ▼              ▼                       │ │
│  │         ┌─────────┐    ┌─────────┐    ┌─────────┐                   │ │
│  │         │ APP-CRM │    │ APP-ERP │    │ APP-BI  │  Hop 1 (Critical) │ │
│  │         └────┬────┘    └────┬────┘    └────┬────┘                   │ │
│  │              ▼              ▼              ▼                        │ │
│  │         ┌─────────┐    ┌─────────┐    ┌─────────┐                   │ │
│  │         │ SVC-Web │    │ SVC-API │    │ Reports │  Hop 2 (High)     │ │
│  │         └─────────┘    └─────────┘    └─────────┘                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │ Impact Summary              │  │ Affected Services               │   │
│  │ • Critical: 3 CIs           │  │ • CRM (Business Critical)       │   │
│  │ • High: 5 CIs               │  │ • ERP (Business Critical)       │   │
│  │ • Medium: 12 CIs            │  │ • Reporting (Important)         │   │
│  │ • Users affected: ~450      │  │ • Customer Portal (Critical)    │   │
│  └─────────────────────────────┘  └─────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Intégrations

### 8.1 Intégrations Internes

| Module | Type | Description |
|--------|------|-------------|
| **Agent Rust** | Bidirectionnel | Discovery data in, policies out |
| **Module Assets** | Migration | Assets → CIs avec legacyAssetId |
| **Module Risks** | Lecture | CI linked to risks |
| **Module Incidents** | Lecture/Écriture | CI lié aux incidents, impact auto |
| **Module Audits** | Lecture | CI dans scope audit |
| **VoxelEngine** | UI | Graphe de dépendances 3D |

### 8.2 Intégrations Externes (Phase 3)

| Système | Type | Description |
|---------|------|-------------|
| **AWS** | API | EC2, RDS, S3 discovery |
| **Azure** | API | VMs, SQL, Storage discovery |
| **GCP** | API | Compute, Cloud SQL discovery |
| **NVD** | API | CVE correlation |

### 8.3 API CMDB (Phase 3)

```yaml
openapi: 3.0.0
info:
  title: Sentinel CMDB API
  version: 1.0.0

paths:
  /api/v1/cmdb/cis:
    get:
      summary: List Configuration Items
      parameters:
        - name: class
          in: query
          schema:
            type: string
            enum: [Hardware, Software, Service, Network, Cloud]
        - name: status
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
    post:
      summary: Create Configuration Item

  /api/v1/cmdb/cis/{id}:
    get:
      summary: Get CI by ID
    put:
      summary: Update CI
    delete:
      summary: Delete CI

  /api/v1/cmdb/cis/{id}/relationships:
    get:
      summary: Get CI relationships
    post:
      summary: Create relationship

  /api/v1/cmdb/cis/{id}/impact:
    get:
      summary: Calculate impact analysis
      parameters:
        - name: scenario
          in: query
          schema:
            type: string
            enum: [down, maintenance, decommission]
        - name: depth
          in: query
          schema:
            type: integer
            default: 3

  /api/v1/cmdb/reconciliation/queue:
    get:
      summary: Get pending validations
    post:
      summary: Bulk approve/reject
```

---

## 9. Sécurité et Conformité

### 9.1 Contrôles de Sécurité

| Contrôle | Implementation |
|----------|----------------|
| **Authentication** | Firebase Auth (existant) |
| **Authorization** | RBAC avec permissions granulaires par CI class |
| **Multi-tenancy** | organizationId obligatoire sur toutes les queries |
| **Audit Logging** | Toutes les opérations CRUD loggées |
| **Data Encryption** | Firestore encryption at rest, TLS in transit |
| **API Security** | Rate limiting, API keys pour intégrations externes |

### 9.2 Permissions RBAC

| Rôle | CI Read | CI Write | Relations | Impact | Admin |
|------|---------|----------|-----------|--------|-------|
| Viewer | ✓ | - | ✓ (read) | ✓ | - |
| Editor | ✓ | ✓ (own) | ✓ | ✓ | - |
| Manager | ✓ | ✓ (all) | ✓ | ✓ | - |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |

### 9.3 Conformité Réglementaire

| Réglementation | Article | Couverture CMDB |
|----------------|---------|-----------------|
| **NIS2** | Art. 21 | Inventaire actifs, gestion vulnérabilités |
| **DORA** | Art. 9 | Registre actifs ICT complet |
| **ISO 27001** | A.5.9 | Inventaire des actifs informationnels |
| **ITIL 4** | SCM Practice | Configuration Management Database |

---

## 10. Dépendances et Contraintes

### 10.1 Dépendances Techniques

| Dépendance | Version | Criticité |
|------------|---------|-----------|
| React | ^19.2.1 | Obligatoire |
| TypeScript | ^5.7.2 | Obligatoire (strict mode) |
| Firebase/Firestore | ^12.8.0 | Obligatoire |
| Zustand | ^5.0.1 | Obligatoire (state) |
| Agent Rust | v2.0.0+ | Obligatoire (discovery) |
| @react-three/fiber | ^9.0.0 | Optionnel (graphe 3D) |

### 10.2 Contraintes

| Contrainte | Impact | Mitigation |
|------------|--------|------------|
| Firestore 1MB document limit | Limite attributs par CI | Sous-collections pour historique |
| Firestore 500 writes/transaction | Limite réconciliation batch | Chunking par 400 |
| Agent déploiement progressif | Discovery partiel initial | Support saisie manuelle |
| Pas de graph database | Performance traversal | Indexation + caching |

---

## 11. Plan de Release

### Phase 1: Fondations (8 semaines)

| Sprint | Livrables |
|--------|-----------|
| **Sprint 1-2** | Modèle de données CI, Collection Firestore, Migration Assets |
| **Sprint 3-4** | IRE (Identification & Reconciliation Engine), Rules config |
| **Sprint 5-6** | Discovery Dashboard, Validation Queue, Notifications |
| **Sprint 7-8** | Tests, Bug fixes, Documentation, Release Phase 1 |

**Critères de sortie Phase 1:**
- [ ] 100% Assets existants migrés vers CIs
- [ ] Réconciliation auto fonctionnelle (>70% match rate)
- [ ] Dashboard Discovery opérationnel
- [ ] Tests unitaires >80% coverage

### Phase 2: Relations & Impact (6 semaines)

| Sprint | Livrables |
|--------|-----------|
| **Sprint 9-10** | Entité Relationship, CRUD API, Validation cohérence |
| **Sprint 11** | Graphe dépendances UI (VoxelEngine integration) |
| **Sprint 12** | Impact Analysis Engine, Blast Radius visualization |
| **Sprint 13-14** | Tests, Stabilisation, Release Phase 2 |

**Critères de sortie Phase 2:**
- [ ] Relations typées fonctionnelles
- [ ] Graphe de dépendances interactif
- [ ] Analyse d'impact opérationnelle
- [ ] 50% CIs avec relations mappées

### Phase 3: Enrichissement (6 semaines)

| Sprint | Livrables |
|--------|-----------|
| **Sprint 15-16** | Hardware discovery (Agent Rust enhancement) |
| **Sprint 17** | CPE mapping + CVE correlation |
| **Sprint 18** | License Management basics |
| **Sprint 19-20** | API CMDB RESTful, Cloud integrations, Release Phase 3 |

**Critères de sortie Phase 3:**
- [ ] Hardware specs collectées par agent
- [ ] API CMDB documentée et fonctionnelle
- [ ] Corrélation CVE opérationnelle

---

## 12. Critères de Succès

### 12.1 Success Metrics à 3 mois (Post-Phase 1)

| Métrique | Cible |
|----------|-------|
| Taux de découverte automatique | > 80% |
| Taux de réconciliation auto | > 70% |
| Temps moyen création CI | < 5 min (vs 30 min avant) |
| Data Quality Score moyen | > 70/100 |
| Adoption utilisateurs | > 80% admins actifs |

### 12.2 Success Metrics à 6 mois (Post-Phase 2)

| Métrique | Cible |
|----------|-------|
| CIs avec relations | > 60% |
| Requêtes d'impact / semaine | > 50 |
| MTTR incidents liés assets | -20% |
| Satisfaction utilisateurs (NPS) | > 40 |

### 12.3 Success Metrics à 12 mois (Post-Phase 3)

| Métrique | Cible |
|----------|-------|
| Conformité ITIL 4 SCM | Certifiable |
| Couverture DORA Art.9 | 100% |
| Taux de réconciliation auto | > 90% |
| MTTR incidents liés assets | -30% |

---

## 13. Annexes

### Annexe A: Glossaire

| Terme | Définition |
|-------|------------|
| **CI** | Configuration Item - Composant géré dans la CMDB |
| **IRE** | Identification & Reconciliation Engine |
| **Fingerprint** | Ensemble d'attributs uniques identifiant un CI |
| **Blast Radius** | Ensemble des CIs impactés par un incident |
| **CPE** | Common Platform Enumeration - Standard de nommage logiciel |
| **CVE** | Common Vulnerabilities and Exposures |

### Annexe B: Références Standards

- ITIL 4 Foundation (AXELOS)
- ISO/IEC 20000-1:2018
- NIST SP 800-53 Rev. 5
- CIS Controls v8

### Annexe C: Changelog

| Version | Date | Auteur | Changements |
|---------|------|--------|-------------|
| 1.0 | 2026-02-06 | Mary (BA) | Version initiale |

---

**Statut:** PRÊT POUR VALIDATION TECHNIQUE
**Prochaine étape:** Review Architecture + Création ADR
