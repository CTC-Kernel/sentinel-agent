---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - 'product-brief-sentinel-grc-european-leader-2026-01-22.md'
  - 'research/market-grc-europe-leadership-research-2026-01-22.md'
  - 'analysis/brainstorming-session-2026-01-22.md'
  - 'prd.md'
  - 'project-context.md'
workflowType: 'prd'
lastStep: 11
workflow_completed: true
briefCount: 1
researchCount: 1
brainstormingCount: 1
projectDocsCount: 2
project_type: 'saas_b2b_strategic_pivot'
domain: 'grc_compliance_europe'
complexity: 'high'
last_updated: '2026-01-22'
version: '1.0'
parent_prd: 'prd.md'
---

# Product Requirements Document
## Sentinel GRC - European Leader Strategy

**Author:** Thibaultllopis
**Date:** 22 janvier 2026
**Version:** 1.0
**Parent PRD:** prd.md (v2.0)
**Type:** Strategic Evolution PRD

---

## Executive Summary

> **"Sentinel GRC : La plateforme GRC européenne, AI-native, qui rend la conformité accessible."**

Ce PRD définit la stratégie produit pour positionner Sentinel GRC comme le **premier champion européen du marché GRC**, un marché de **15,86 milliards USD** actuellement dominé exclusivement par des acteurs américains.

### Contexte Stratégique

| Facteur | Données | Implication |
|---------|---------|-------------|
| Marché EU 2025 | 15,86 Mrd USD | Opportunité massive |
| Projection 2033 | 27,08 Mrd USD | Croissance soutenue |
| Champions européens | 0 | Vide concurrentiel |
| CAGR segment PME | 15,3% | Cible prioritaire |
| Orgs sous NIS2 (FR) | 15,000+ | Demande captive |

### Différenciateurs Clés

1. **Souveraineté européenne** — Hébergement EU, conformité RGPD native
2. **Prix PME** — 10x moins cher que ServiceNow/OneTrust
3. **Multi-framework unifié** — NIS2 + DORA + RGPD + AI Act en une interface
4. **AI-native** — Architecture IA fondamentale, pas overlay
5. **Déploiement 24h** — Templates pré-configurés par secteur

---

## 1. Project Discovery

### 1.1 Vision Produit

**Dans 3 ans**, Sentinel GRC sera la référence européenne du GRC pour les PME et ETI, reconnu pour :
- Sa compréhension native des réglementations européennes
- Son accessibilité tarifaire
- Sa simplicité d'utilisation Apple-like
- Son IA qui "parle" la langue réglementaire européenne

### 1.2 Problème à Résoudre

**Les PME/ETI européennes font face à une crise de conformité :**

```
┌─────────────────────────────────────────────────────────────────┐
│                    TSUNAMI RÉGLEMENTAIRE                        │
├─────────────────────────────────────────────────────────────────┤
│  NIS2 (Oct 2024)  →  DORA (Jan 2025)  →  AI Act (Août 2026)    │
│       ↓                    ↓                    ↓               │
│  15,000+ orgs FR      Finance EU          High-risk AI         │
│  Amendes: 10M€        Amendes: 5% CA      Amendes: 7% CA       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
              Solutions actuelles INADAPTÉES
              • OneTrust/ServiceNow: 50-100K€/an
              • Implémentation: 3-6 mois
              • Interfaces complexes
              • Support anglophone uniquement
              • Hébergement US (Cloud Act)
```

### 1.3 Opportunité de Marché

| Segment | Taille | CAGR | Opportunité |
|---------|--------|------|-------------|
| Grandes entreprises | ~60% marché | 8% | Saturé, dominé par US |
| **PME/ETI** | ~30% marché | **15,3%** | **Sous-servi, haute croissance** |
| TPE/Startups | ~10% marché | 12% | Émergent |

**Fenêtre d'opportunité : 24-36 mois** avant consolidation du marché.

---

## 2. Success Metrics

### 2.1 North Star Metric

> **"Nombre d'entreprises européennes conformes grâce à Sentinel GRC"**

### 2.2 KPIs Primaires

| KPI | Baseline | Target Y1 | Target Y3 |
|-----|----------|-----------|-----------|
| **ARR** | 0€ | 500K€ | 8M€ |
| **Clients actifs** | 0 | 100 | 1,500 |
| **NPS** | N/A | >40 | >60 |
| **Time to Value** | N/A | <1 semaine | <24h |
| **Frameworks supportés** | 3* | 5 | 15 |

*Existants : ISO 27001, EBIOS-RM partiel

### 2.3 KPIs Secondaires

| KPI | Target Y1 |
|-----|-----------|
| Taux de conversion freemium | >5% |
| Churn rate | <5% annuel |
| CAC | <2000€ |
| LTV/CAC ratio | >7.5x |
| Net Revenue Retention | >120% |

### 2.4 Success Criteria par Phase

**Phase 1 - France (Q1-Q3 2026)**
- [ ] 10 clients pilotes satisfaits (NPS >50)
- [ ] Certification SecNumCloud initiée
- [ ] Templates NIS2 validés par 3 auditeurs
- [ ] 50 clients payants

**Phase 2 - DACH (Q4 2026 - Q2 2027)**
- [ ] Localisation allemande complète
- [ ] 100 clients DACH
- [ ] Partenariat avec 2 ESN locales

**Phase 3 - Europe (2027-2028)**
- [ ] Présence dans 10+ pays EU
- [ ] 1,500 clients actifs
- [ ] Position #1 ou #2 dans segment PME EU

---

## 3. User Journeys

### 3.1 Persona Principal : Marie, RSSI PME

**Profil :**
- RSSI d'une ETI industrielle (500 employés)
- Équipe : 2-3 personnes
- Budget GRC : 15-30K€/an
- Urgence : NIS2 compliance avant juin 2026

**Journey : "De la panique à la sérénité NIS2"**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 1: DÉCOUVERTE                                                      │
│  ─────────────────────                                                    │
│  Marie cherche "conformité NIS2 PME" sur Google                          │
│  → Landing page "NIS2 Ready in 24h" de Sentinel                          │
│  → Calculateur gratuit de maturité NIS2                                  │
│                                                                          │
│  Émotion: Curiosité → Espoir                                             │
│  Friction: Scepticisme ("trop beau pour être vrai")                      │
│  Solution: Témoignages clients, garantie satisfait ou remboursé          │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 2: ÉVALUATION                                                      │
│  ──────────────────────                                                   │
│  Marie s'inscrit à l'essai gratuit (14 jours)                            │
│  → Onboarding guidé en 15 minutes                                        │
│  → Sélection secteur "Industrie" → Templates pré-configurés              │
│  → Scan automatique : "Vous êtes à 34% de conformité NIS2"               │
│                                                                          │
│  Émotion: Surprise → Compréhension                                       │
│  Friction: Peur de la complexité                                         │
│  Solution: Interface simple, assistant IA, support chat FR               │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 3: ADOPTION                                                        │
│  ─────────────────────                                                    │
│  Marie souscrit au plan Business (499€/mois)                             │
│  → Import des actifs existants (Excel, CMDB)                             │
│  → Mapping automatique contrôles ↔ exigences NIS2                        │
│  → Plan d'action priorisé par risque                                     │
│                                                                          │
│  Émotion: Soulagement → Confiance                                        │
│  Friction: Migration des données existantes                              │
│  Solution: Import intelligent, support migration inclus                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 4: VALEUR                                                          │
│  ────────────────────                                                     │
│  Après 3 mois, Marie présente au COMEX                                   │
│  → Dashboard : "78% conformité NIS2" (vs 34% initial)                    │
│  → Rapport PDF automatique pour les auditeurs                            │
│  → Veille réglementaire : alertes AI Act                                 │
│                                                                          │
│  Émotion: Fierté → Recommandation                                        │
│  Outcome: NPS promoteur, référence client                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Persona Secondaire : Thomas, DPO Scale-up

**Profil :**
- DPO d'une fintech (200 employés)
- Multi-framework : RGPD + DORA + AI Act
- Tech-savvy, veut des intégrations API

**Journey Key Moments :**

1. **Découverte** : Recherche "GRC multi-framework DORA RGPD"
2. **Évaluation** : Test API, intégration Slack/Jira
3. **Adoption** : Plan Enterprise avec API access
4. **Valeur** : Compliance-as-Code dans CI/CD

### 3.3 Persona Tertiaire : Françoise, DGS Collectivité

**Profil :**
- DGS d'une métropole
- Contrainte marché public
- Exigence souveraineté (SecNumCloud)

**Journey Key Moments :**

1. **Découverte** : Référencement UGAP / marché public
2. **Évaluation** : Preuve hébergement souverain
3. **Adoption** : Contrat cadre pluriannuel
4. **Valeur** : Rapports pour élus, conformité ANSSI

---

## 4. Domain Model

### 4.1 Entités Principales (Extension)

Le domain model existant (cf. prd.md v2.0) est étendu avec :

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOMAIN MODEL EXTENSION                          │
│                     (European Leader Strategy)                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Framework     │────→│   Requirement   │────→│    Control      │
│   (NIS2, DORA)  │ 1:N │   (Article)     │ 1:N │   (Mesure)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ FrameworkMapping│     │   Evidence      │     │   Assessment    │
│ (Cross-ref)     │     │   (Preuve)      │     │   (Évaluation)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ↓
                        ┌─────────────────┐
                        │ ComplianceScore │
                        │ (Par framework) │
                        └─────────────────┘
```

### 4.2 Nouvelles Entités

#### Framework

```typescript
interface Framework {
  id: string;
  code: 'NIS2' | 'DORA' | 'GDPR' | 'AI_ACT' | 'ISO27001' | 'SOC2';
  name: string;
  version: string;
  jurisdiction: 'EU' | 'FR' | 'DE' | 'INTL';
  effectiveDate: Date;
  requirements: Requirement[];
  controlMappings: ControlMapping[];
}
```

#### Requirement (Exigence Réglementaire)

```typescript
interface Requirement {
  id: string;
  frameworkId: string;
  articleRef: string; // "Art. 21.2.a"
  title: string;
  description: string;
  category: RequirementCategory;
  applicability: ApplicabilityRule[];
  controls: Control[];
}

type RequirementCategory =
  | 'governance'
  | 'risk_management'
  | 'incident_response'
  | 'supply_chain'
  | 'technical_measures'
  | 'awareness_training';
```

#### ControlMapping (Cross-Framework)

```typescript
interface ControlMapping {
  id: string;
  controlId: string;
  frameworkMappings: {
    frameworkId: string;
    requirementIds: string[];
    coveragePercentage: number;
  }[];
}
```

#### ComplianceScore

```typescript
interface ComplianceScore {
  id: string;
  organizationId: string;
  frameworkId: string;
  overallScore: number; // 0-100
  categoryScores: {
    category: RequirementCategory;
    score: number;
    gaps: string[];
  }[];
  lastAssessedAt: Date;
  trend: 'improving' | 'stable' | 'declining';
}
```

### 4.3 Invariants Métier

| Invariant | Règle |
|-----------|-------|
| Score Calculation | Score = (ControlsMet / TotalControls) × 100, pondéré par criticité |
| Evidence Validity | Une preuve expire après sa validityPeriod |
| Framework Applicability | Seuls les frameworks applicables au secteur sont affichés |
| Multi-mapping | Un contrôle peut satisfaire plusieurs frameworks |
| Audit Trail | Toute modification de score est historisée |

---

## 5. Innovation & Différenciation

### 5.1 AI Compliance Copilot

**Fonctionnalité phare différenciante**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI COMPLIANCE COPILOT                            │
└─────────────────────────────────────────────────────────────────────────┘

User: "Quelles mesures dois-je mettre en place pour l'article 21 NIS2 ?"

Copilot: "L'article 21 NIS2 exige des mesures de gestion des risques cyber.
         Pour votre secteur (Industrie), je recommande :

         1. ✅ Politique de sécurité SI (vous l'avez déjà)
         2. ⚠️ Plan de continuité (partiellement conforme - 60%)
         3. ❌ Gestion des incidents (non implémenté)

         Voulez-vous que je génère un plan d'action priorisé ?"

[Générer le plan] [Voir les détails] [Poser une autre question]
```

**Capabilities :**
- Réponses contextualisées au secteur et à la taille
- Génération de documentation (politiques, procédures)
- Explication des exigences en langage simple
- Suggestions de preuves à collecter
- Veille réglementaire proactive

### 5.2 Multi-Framework Unified View

**Innovation UX : Vue unifiée cross-framework**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  UNIFIED COMPLIANCE DASHBOARD                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│  │  NIS2   │  │  DORA   │  │  RGPD   │  │ AI Act  │                    │
│  │   78%   │  │   65%   │  │   92%   │  │   12%   │                    │
│  │ ████░░░ │  │ ██████░ │  │ ██████░ │  │ █░░░░░░ │                    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                    │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  CONTRÔLE: "Gestion des accès"                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Satisfait:  NIS2 Art.21.2.i ✓  │  DORA Art.9.4 ✓  │  RGPD 32 ✓ │   │
│  │ 1 contrôle = 3 frameworks couverts                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Valeur :** Réduction de 60% des efforts de conformité grâce au cross-mapping.

### 5.3 Templates Sectoriels Pré-configurés

**"GRC-in-a-Box" par secteur**

| Secteur | Frameworks inclus | Contrôles pré-mappés |
|---------|-------------------|----------------------|
| **Industrie** | NIS2, ISO 27001 | 156 |
| **Finance** | DORA, NIS2, RGPD | 234 |
| **Santé** | NIS2, HDS, RGPD | 189 |
| **Tech/SaaS** | SOC 2, RGPD, AI Act | 145 |
| **Collectivités** | NIS2, RGS, RGPD | 167 |

### 5.4 Compliance Score Gamifié

**Inspiration : Apple Health pour la conformité**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COMPLIANCE HEALTH                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         ┌───────────┐                                   │
│                        ╱             ╲                                  │
│                       │      78       │                                  │
│                       │    ████████   │                                  │
│                        ╲   /100     ╱                                   │
│                         └───────────┘                                   │
│                                                                         │
│                    "Bon niveau de conformité"                           │
│                    +12 pts ce mois-ci 📈                                │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  🎯 PROCHAIN OBJECTIF: Atteindre 85%                                   │
│     Actions suggérées:                                                  │
│     □ Finaliser le plan de continuité (+4 pts)                         │
│     □ Former l'équipe aux incidents (+3 pts)                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Project Type & Scope

### 6.1 Type de Projet

**Strategic Evolution** — Extension d'un produit existant avec pivot stratégique.

- **Base existante :** Sentinel GRC v2 (modules Risk, Compliance, Voxel 3D)
- **Évolution :** Positionnement European Leader, nouveaux modules réglementaires

### 6.2 Scope Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SCOPE OVERVIEW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    EXISTANT (Réutilisé)                         │   │
│  │  • Architecture React/Firebase                                   │   │
│  │  • Design System Apple-like                                      │   │
│  │  • Module Voxel 3D                                               │   │
│  │  • Auth/RBAC/Multi-tenant                                        │   │
│  │  • Module Risk (EBIOS-RM)                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    NOUVEAU (Ce PRD)                              │   │
│  │  • Multi-Framework Engine (NIS2, DORA, AI Act)                  │   │
│  │  • AI Compliance Copilot                                         │   │
│  │  • Templates Sectoriels                                          │   │
│  │  • Compliance Score Gamifié                                      │   │
│  │  • Cross-Framework Mapping                                       │   │
│  │  • Localisation multi-langue (DE, ES, IT...)                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 In Scope vs Out of Scope

| In Scope | Out of Scope |
|----------|--------------|
| Frameworks EU (NIS2, DORA, RGPD, AI Act) | Frameworks US (HIPAA, SOX) |
| Langues : FR, EN, DE | Autres langues EU (phase ultérieure) |
| PME/ETI (50-5000 employés) | Grandes entreprises (>5000) |
| SaaS cloud (SecNumCloud) | On-premise deployment |
| AI Copilot (texte) | AI voice interface |
| Web application | Mobile native apps |

---

## 7. Functional Requirements

### 7.1 Epic 1 : Multi-Framework Engine

**Goal :** Permettre la gestion de conformité multi-framework avec cross-mapping.

#### User Stories

**US-1.1 : Activer un framework**
```
En tant que RSSI,
Je veux activer le framework NIS2 pour mon organisation,
Afin de voir les exigences applicables à mon secteur.

Critères d'acceptation :
- [ ] Liste des frameworks disponibles affichée
- [ ] Sélection du secteur d'activité
- [ ] Filtrage automatique des exigences applicables
- [ ] Affichage du nombre de contrôles requis
- [ ] Estimation du temps de mise en conformité
```

**US-1.2 : Voir le mapping cross-framework**
```
En tant que DPO,
Je veux voir quels contrôles satisfont plusieurs frameworks,
Afin d'optimiser mes efforts de conformité.

Critères d'acceptation :
- [ ] Vue matricielle contrôles × frameworks
- [ ] Indicateur de couverture par contrôle
- [ ] Filtre par framework
- [ ] Export du mapping en PDF/Excel
```

**US-1.3 : Calculer le score de conformité**
```
En tant que RSSI,
Je veux voir mon score de conformité par framework,
Afin de prioriser mes actions.

Critères d'acceptation :
- [ ] Score global 0-100 par framework
- [ ] Breakdown par catégorie
- [ ] Trend (amélioration/déclin)
- [ ] Comparaison avec benchmark sectoriel
```

#### Technical Requirements

| Requirement | Specification |
|-------------|---------------|
| Framework data model | Extensible JSON schema pour nouveaux frameworks |
| Scoring algorithm | Pondération par criticité, configurable |
| Real-time calculation | Score recalculé à chaque modification |
| Audit trail | Historique complet des changements de score |

### 7.2 Epic 2 : AI Compliance Copilot

**Goal :** Assistant IA conversationnel pour guider la conformité.

#### User Stories

**US-2.1 : Poser une question réglementaire**
```
En tant que RSSI,
Je veux poser des questions sur NIS2 en langage naturel,
Afin d'obtenir des réponses contextualisées à ma situation.

Critères d'acceptation :
- [ ] Interface chat intégrée
- [ ] Réponses en <5 secondes
- [ ] Citations des articles de loi
- [ ] Suggestions d'actions concrètes
- [ ] Historique des conversations
```

**US-2.2 : Générer une politique de sécurité**
```
En tant que RSSI,
Je veux générer un template de politique de sécurité,
Afin de gagner du temps sur la documentation.

Critères d'acceptation :
- [ ] Sélection du type de document
- [ ] Personnalisation avec infos organisation
- [ ] Génération en <30 secondes
- [ ] Export Word/PDF
- [ ] Possibilité d'édition post-génération
```

**US-2.3 : Recevoir des alertes réglementaires**
```
En tant que DPO,
Je veux être alerté des évolutions réglementaires,
Afin d'anticiper les changements.

Critères d'acceptation :
- [ ] Veille automatique sur frameworks activés
- [ ] Notification in-app et email
- [ ] Résumé de l'impact en langage simple
- [ ] Actions suggérées
```

#### Technical Requirements

| Requirement | Specification |
|-------------|---------------|
| LLM Provider | Claude API (Anthropic) |
| Context window | RAG avec base documentaire réglementaire |
| Latency | P95 < 5 seconds |
| Languages | FR, EN, DE |
| Guardrails | Pas de conseils juridiques, disclaimer |

### 7.3 Epic 3 : Templates Sectoriels

**Goal :** Accélérer le déploiement avec des templates pré-configurés.

#### User Stories

**US-3.1 : Sélectionner un template sectoriel**
```
En tant que nouveau client,
Je veux choisir un template adapté à mon secteur,
Afin de démarrer avec des contrôles pertinents.

Critères d'acceptation :
- [ ] Catalogue de 5+ secteurs
- [ ] Preview du contenu avant activation
- [ ] Activation en 1 clic
- [ ] Personnalisation post-activation possible
```

**US-3.2 : Importer mes données existantes**
```
En tant que RSSI,
Je veux importer mon inventaire d'actifs depuis Excel,
Afin de ne pas ressaisir mes données.

Critères d'acceptation :
- [ ] Import Excel/CSV
- [ ] Mapping intelligent des colonnes
- [ ] Validation et rapport d'erreurs
- [ ] Preview avant import final
- [ ] Rollback possible
```

### 7.4 Epic 4 : Compliance Score Gamifié

**Goal :** Motiver l'amélioration continue avec une UX engageante.

#### User Stories

**US-4.1 : Voir mon score de santé conformité**
```
En tant que RSSI,
Je veux voir un score visuel type "Apple Health",
Afin de comprendre ma posture de conformité d'un coup d'œil.

Critères d'acceptation :
- [ ] Jauge circulaire animée
- [ ] Code couleur (vert/orange/rouge)
- [ ] Trend sur 30 jours
- [ ] Message motivationnel contextuel
```

**US-4.2 : Recevoir des objectifs suggérés**
```
En tant que RSSI,
Je veux des suggestions d'actions priorisées,
Afin de savoir par où commencer.

Critères d'acceptation :
- [ ] 3-5 actions prioritaires affichées
- [ ] Points de score associés à chaque action
- [ ] Estimation de temps/effort
- [ ] Possibilité de marquer "fait"
```

### 7.5 Epic 5 : Localisation & Souveraineté

**Goal :** Support multi-langue et hébergement souverain.

#### User Stories

**US-5.1 : Utiliser l'app dans ma langue**
```
En tant qu'utilisateur allemand,
Je veux utiliser Sentinel en allemand,
Afin de comprendre toutes les fonctionnalités.

Critères d'acceptation :
- [ ] Switch de langue dans les settings
- [ ] 100% de l'UI traduite
- [ ] Contenu réglementaire localisé
- [ ] AI Copilot répond dans la langue choisie
```

**US-5.2 : Vérifier l'hébergement des données**
```
En tant que DPO,
Je veux voir où sont hébergées mes données,
Afin de garantir la conformité RGPD.

Critères d'acceptation :
- [ ] Page "Data Residency" dans settings
- [ ] Indication du datacenter (pays, ville)
- [ ] Certificat hébergeur téléchargeable
- [ ] Option SecNumCloud visible
```

---

## 8. Non-Functional Requirements

### 8.1 Performance (NFR-P)

| ID | Requirement | Target | Mesure |
|----|-------------|--------|--------|
| NFR-P1 | Page load time | <2s | Lighthouse |
| NFR-P2 | API response time | P95 <500ms | Datadog |
| NFR-P3 | AI Copilot response | P95 <5s | Logs |
| NFR-P4 | Dashboard refresh | <1s | Browser timing |
| NFR-P5 | Concurrent users | 1000+ | Load test |

### 8.2 Security (NFR-S)

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-S1 | Authentication | Firebase Auth + MFA option |
| NFR-S2 | Authorization | RBAC avec 4 rôles |
| NFR-S3 | Data encryption | AES-256 at rest, TLS 1.3 in transit |
| NFR-S4 | Audit logging | Toutes actions utilisateur loggées |
| NFR-S5 | Pen testing | Annuel par tiers |
| NFR-S6 | SOC 2 Type II | Certification cible Y2 |

### 8.3 Compliance (NFR-C)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-C1 | RGPD compliance | 100% |
| NFR-C2 | SecNumCloud | Certification Q3 2026 |
| NFR-C3 | Data residency | EU-only option |
| NFR-C4 | Right to erasure | <72h implementation |
| NFR-C5 | Data portability | Export JSON/CSV |

### 8.4 Availability (NFR-A)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-A1 | Uptime SLA | 99.9% |
| NFR-A2 | RTO | <4h |
| NFR-A3 | RPO | <1h |
| NFR-A4 | Backup frequency | Daily + WAL |
| NFR-A5 | Disaster recovery | Multi-region EU |

### 8.5 Scalability (NFR-SC)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SC1 | Organizations | 10,000+ |
| NFR-SC2 | Users per org | 500+ |
| NFR-SC3 | Controls per org | 10,000+ |
| NFR-SC4 | Documents storage | 100GB per org |

### 8.6 Usability (NFR-U)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-U1 | Time to first value | <1 hour |
| NFR-U2 | Task completion rate | >90% |
| NFR-U3 | Accessibility | WCAG 2.1 AA |
| NFR-U4 | Mobile responsive | Yes |
| NFR-U5 | Supported browsers | Chrome, Firefox, Safari, Edge (latest 2) |

### 8.7 Maintainability (NFR-M)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-M1 | Test coverage | >70% |
| NFR-M2 | Documentation | 100% public API |
| NFR-M3 | Deployment frequency | Daily capable |
| NFR-M4 | MTTR | <2h for P1 |

---

## 9. Technical Architecture

### 9.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SENTINEL GRC ARCHITECTURE                       │
│                        (European Leader Extension)                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   React 19  │  │  Zustand    │  │   R3F       │  │  Tailwind   │   │
│  │   + Vite    │  │   Store     │  │   (Voxel)   │  │   CSS       │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Firebase Services                             │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │   │
│  │  │   Auth    │  │ Firestore │  │  Storage  │  │ Functions │    │   │
│  │  │  (MFA)    │  │  (EU)     │  │   (EU)    │  │   (v2)    │    │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    AI Services (NEW)                             │   │
│  │  ┌───────────────────┐  ┌───────────────────┐                   │   │
│  │  │   Claude API      │  │   RAG Pipeline    │                   │   │
│  │  │   (Compliance)    │  │   (Regulations)   │                   │   │
│  │  └───────────────────┘  └───────────────────┘                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER (EU)                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │   Firestore (eur3)    │   Cloud Storage (EU)   │   Backups     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 New Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **FrameworkEngine** | TypeScript | Multi-framework logic, scoring |
| **CrossMapper** | TypeScript | Control-to-framework mapping |
| **ComplianceCopilot** | Claude API + RAG | AI assistant |
| **TemplateManager** | Firestore | Sectoral templates CRUD |
| **LocalizationService** | i18next | Multi-language support |
| **SovereigntyChecker** | Cloud Functions | Data residency verification |

### 9.3 Data Flow

```
User Query → AI Copilot
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Query Analysis                                                      │
│     - Intent detection (question, generation, alert)                   │
│     - Entity extraction (framework, article, control)                  │
└─────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. Context Retrieval (RAG)                                            │
│     - Search regulatory database                                       │
│     - Fetch organization context                                       │
│     - Load relevant controls/evidence                                  │
└─────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. LLM Processing                                                      │
│     - Claude API call with context                                     │
│     - Response generation in user's language                           │
│     - Citation extraction                                              │
└─────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. Response Delivery                                                   │
│     - Format for UI                                                    │
│     - Add action buttons                                               │
│     - Log interaction                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Roadmap

### 10.1 Release Plan

```
2026
═════════════════════════════════════════════════════════════════════════

Q1 2026 - FOUNDATION
├── Sprint 1-2: Multi-Framework Engine MVP
│   • Framework data model
│   • NIS2 requirements database
│   • Basic scoring algorithm
│
├── Sprint 3-4: AI Copilot v1
│   • Chat interface
│   • Basic Q&A functionality
│   • FR/EN support
│
└── Sprint 5-6: Templates v1
    • 3 sectoral templates (Industrie, Finance, Santé)
    • Import/export functionality

─────────────────────────────────────────────────────────────────────────

Q2 2026 - COMPLIANCE
├── Sprint 7-8: Cross-Framework Mapping
│   • NIS2 ↔ DORA ↔ RGPD mapping
│   • Unified dashboard
│
├── Sprint 9-10: Compliance Score Gamification
│   • Apple Health-style gauge
│   • Recommendations engine
│
└── Sprint 11-12: SecNumCloud Preparation
    • Security hardening
    • Documentation
    • Audit preparation

─────────────────────────────────────────────────────────────────────────

Q3 2026 - SCALE
├── Sprint 13-14: AI Copilot v2
│   • Document generation
│   • Regulatory alerts
│   • German support
│
├── Sprint 15-16: German Localization
│   • Full UI translation
│   • DE regulatory content
│
└── Sprint 17-18: API v1
    • Public REST API
    • Webhooks
    • Developer documentation

─────────────────────────────────────────────────────────────────────────

Q4 2026 - EXPANSION
├── Sprint 19-20: AI Act Module
│   • AI Act requirements
│   • Risk assessment for AI systems
│
├── Sprint 21-22: Supply Chain Risk
│   • Vendor compliance tracking
│   • Questionnaire automation
│
└── Sprint 23-24: Partner Integrations
    • Auditor network
    • ESN partnerships

═════════════════════════════════════════════════════════════════════════
```

### 10.2 MVP Definition (Q1 2026)

**Minimum Viable Product for Beta Launch:**

| Feature | Included | Notes |
|---------|----------|-------|
| NIS2 Framework | ✅ | Full requirements database |
| Compliance Dashboard | ✅ | Score + breakdown |
| Control Management | ✅ | CRUD + evidence linking |
| AI Copilot (basic) | ✅ | Q&A only |
| Template Industrie | ✅ | 1 sector |
| FR + EN languages | ✅ | |
| DORA Framework | ❌ | Q2 |
| Document Generation | ❌ | Q3 |
| German language | ❌ | Q3 |

---

## 11. Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| **NIS2** | Network and Information Security Directive 2 (EU) |
| **DORA** | Digital Operational Resilience Act (EU, Finance) |
| **RGPD/GDPR** | Règlement Général sur la Protection des Données |
| **AI Act** | EU Artificial Intelligence Act |
| **SecNumCloud** | French cloud security certification (ANSSI) |
| **GRC** | Governance, Risk & Compliance |
| **RAG** | Retrieval-Augmented Generation (AI technique) |
| **Cross-mapping** | Linking one control to multiple frameworks |

### B. Competitive Analysis Summary

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
| **OneTrust** | Market leader, complete | Expensive, complex | Price, simplicity |
| **ServiceNow** | Enterprise integration | Cost, US-centric | EU sovereignty |
| **Archer** | Robust, configurable | Legacy UX | Modern UX |
| **Eramba** | Free, open source | Limited features | AI, support |

### C. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI hallucinations | Medium | High | RAG grounding, disclaimers |
| SecNumCloud delay | Medium | High | Early engagement, backup plan |
| Competitor response | High | Medium | Speed to market, differentiation |
| Regulation changes | Medium | Medium | Agile content updates |
| Talent acquisition | Medium | Medium | Remote-first, competitive comp |

### D. Dependencies

| Dependency | Owner | Status | Risk |
|------------|-------|--------|------|
| Claude API access | Anthropic | ✅ Active | Low |
| Firebase EU region | Google | ✅ Active | Low |
| SecNumCloud audit | ANSSI | 🟡 Planned Q2 | Medium |
| Regulatory content | Legal team | 🟡 In progress | Medium |
| German translations | Localization | 🔴 Not started | Medium |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-22 | Thibaultllopis | Initial version |

---

*PRD European Leader Strategy v1.0*
*Sentinel GRC - Confidential*
