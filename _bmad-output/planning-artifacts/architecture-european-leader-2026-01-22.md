---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - 'prd-european-leader-strategy-2026-01-22.md'
  - 'project-context.md'
  - 'prd.md'
workflowType: 'architecture'
project_name: 'sentinel-grc-v2-prod'
user_name: 'Thibaultllopis'
date: '2026-01-22'
status: 'completed'
version: '1.0'
---

# Architecture Decision Document
## Sentinel GRC - European Leader Strategy

**Author:** Thibaultllopis
**Date:** 22 janvier 2026
**Version:** 1.0
**PRD Reference:** prd-european-leader-strategy-2026-01-22.md

---

## Executive Summary

Ce document définit les décisions architecturales pour transformer Sentinel GRC en leader européen du marché GRC. L'architecture s'appuie sur le stack technique existant (React 19, Firebase, TypeScript) tout en introduisant de nouveaux composants pour supporter :

1. **Multi-Framework Engine** — Gestion multi-réglementaire (NIS2, DORA, RGPD, AI Act)
2. **AI Compliance Copilot** — Assistant IA conversationnel via Claude API
3. **Cross-Framework Mapping** — Liens entre contrôles et frameworks multiples
4. **Sovereignty & Localization** — Hébergement EU et support multi-langue

---

## 1. Contexte Architectural

### 1.1 Stack Existant (Hérité)

| Layer | Technology | Version | Status |
|-------|------------|---------|--------|
| **Frontend** | React | 19.2.1 | ✅ Production |
| **Build** | Vite | 6.0.3 | ✅ Production |
| **Language** | TypeScript | 5.7.2 | ✅ Strict mode |
| **State** | Zustand | 5.0.1 | ✅ Production |
| **Data Fetching** | TanStack Query | 5.90.12 | ✅ Production |
| **Backend** | Firebase | 12.8.0 | ✅ Production |
| **3D** | React Three Fiber | 9.0.0-rc.3 | ✅ Production |
| **Styling** | Tailwind CSS | 3.4.1 | ✅ Production |
| **Testing** | Vitest + Playwright | Latest | ✅ Production |

### 1.2 Constraints

| Constraint | Description | Impact |
|------------|-------------|--------|
| **C-01** | Firebase comme backend principal | Pas de migration vers autre BaaS |
| **C-02** | Hébergement EU obligatoire | Firestore region `eur3` |
| **C-03** | SecNumCloud cible Q3 2026 | Choix infra compatibles |
| **C-04** | Budget limité | Pas de services coûteux |
| **C-05** | Équipe réduite | Architecture simple à maintenir |

### 1.3 Quality Attributes Priority

```
1. Security       ████████████████████ (CRITICAL - GRC domain)
2. Maintainability ███████████████████ (HIGH - small team)
3. Performance    ████████████████    (HIGH - UX quality)
4. Scalability    ███████████████     (MEDIUM - growth path)
5. Availability   ███████████████     (MEDIUM - 99.9% SLA)
```

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SENTINEL GRC ARCHITECTURE                         │
│                          European Leader Extension                          │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │    CDN (EU)     │
                              │   Cloudflare    │
                              └────────┬────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                                      │            FRONTEND                  │
│  ┌───────────────────────────────────┴───────────────────────────────────┐ │
│  │                        React 19 + Vite SPA                            │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │ │
│  │  │   Zustand   │ │  TanStack   │ │    i18n     │ │   Router    │     │ │
│  │  │   Stores    │ │   Query     │ │  (FR/EN/DE) │ │  (React)    │     │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    Feature Modules                              │ │ │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │ │ │
│  │  │  │Dashboard│ │Framework│ │Controls │ │ Copilot │ │ Voxel3D │  │ │ │
│  │  │  │Module   │ │ Module  │ │ Module  │ │ Module  │ │ Module  │  │ │ │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       │ HTTPS
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                                      │            BACKEND                   │
│  ┌───────────────────────────────────┴───────────────────────────────────┐ │
│  │                      Firebase Services (EU)                           │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │ │
│  │  │    Auth     │ │  Firestore  │ │   Storage   │ │  Functions  │     │ │
│  │  │   (MFA)     │ │   (eur3)    │ │    (EU)     │ │    (v2)     │     │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      AI Services (NEW)                                │ │
│  │  ┌─────────────────────────┐ ┌─────────────────────────────────────┐ │ │
│  │  │    Claude API           │ │         Vector Store (Pinecone)     │ │ │
│  │  │    (via Functions)      │ │         (Regulatory RAG)            │ │ │
│  │  └─────────────────────────┘ └─────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND COMPONENTS                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    App Shell    │     │   Auth Module   │     │  Layout Module  │
│  ─────────────  │     │  ─────────────  │     │  ─────────────  │
│  • Router       │────▶│  • Login        │     │  • Sidebar      │
│  • ErrorBoundary│     │  • MFA          │     │  • Header       │
│  • Providers    │     │  • Session      │     │  • Navigation   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FEATURE MODULES                                   │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│                 │                 │                 │                       │
│  ┌───────────┐  │  ┌───────────┐  │  ┌───────────┐  │  ┌───────────┐       │
│  │ Dashboard │  │  │ Framework │  │  │ Controls  │  │  │  Copilot  │       │
│  │  Module   │  │  │  Module   │  │  │  Module   │  │  │  Module   │       │
│  ├───────────┤  │  ├───────────┤  │  ├───────────┤  │  ├───────────┤       │
│  │• Score    │  │  │• Framework│  │  │• Control  │  │  │• Chat UI  │       │
│  │  Gauge    │  │  │  List     │  │  │  List     │  │  │• Message  │       │
│  │• Trend    │  │  │• Require- │  │  │• Evidence │  │  │  Stream   │       │
│  │  Chart    │  │  │  ments    │  │  │  Upload   │  │  │• Actions  │       │
│  │• Actions  │  │  │• Mapping  │  │  │• Assess-  │  │  │• History  │       │
│  │  List     │  │  │  Matrix   │  │  │  ment     │  │  │           │       │
│  └───────────┘  │  └───────────┘  │  └───────────┘  │  └───────────┘       │
│                 │                 │                 │                       │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
         │                 │                 │                 │
         ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STORES (Zustand)                               │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  complianceStore│  frameworkStore │  controlStore   │  copilotStore         │
│  • scores       │  • frameworks   │  • controls     │  • messages           │
│  • trends       │  • requirements │  • evidence     │  • isLoading          │
│  • actions      │  • mappings     │  • assessments  │  • context            │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
         │                 │                 │                 │
         ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICES (Static Class Pattern)                   │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│ ComplianceService│ FrameworkService│ ControlService  │ CopilotService        │
│ • getScore()    │ • getFrameworks │ • getControls() │ • sendMessage()       │
│ • recalculate() │ • getMappings() │ • addEvidence() │ • getHistory()        │
│ • getActions()  │ • getRequire-   │ • assess()      │ • generateDoc()       │
│                 │   ments()       │                 │                       │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
```

---

## 3. Architecture Decisions (ADRs)

### ADR-001: Multi-Framework Data Model

**Status:** Accepted
**Date:** 2026-01-22

#### Context

Nous devons supporter plusieurs frameworks réglementaires (NIS2, DORA, RGPD, AI Act) avec des relations complexes entre contrôles et exigences.

#### Decision

Adopter un **modèle de données normalisé** avec tables de mapping séparées :

```typescript
// Framework entity
interface Framework {
  id: string;
  code: FrameworkCode;
  name: string;
  version: string;
  jurisdiction: Jurisdiction;
  effectiveDate: Timestamp;
  isActive: boolean;
}

// Requirement entity (exigence réglementaire)
interface Requirement {
  id: string;
  frameworkId: string;
  articleRef: string;
  title: string;
  description: string;
  category: RequirementCategory;
  criticality: 'high' | 'medium' | 'low';
}

// ControlMapping (n:n relationship)
interface ControlMapping {
  id: string;
  controlId: string;
  requirementId: string;
  frameworkId: string;
  coveragePercentage: number; // 0-100
  notes: string;
}
```

#### Consequences

**Positive:**
- Flexibilité pour ajouter de nouveaux frameworks
- Requêtes optimisées via indexes Firestore
- Support du cross-mapping natif

**Negative:**
- Plus de joins côté client (Firestore limitation)
- Complexité accrue du data fetching

**Mitigations:**
- Utiliser TanStack Query pour caching intelligent
- Dénormaliser les données fréquemment accédées

---

### ADR-002: AI Copilot Architecture

**Status:** Accepted
**Date:** 2026-01-22

#### Context

L'AI Compliance Copilot doit répondre à des questions réglementaires en contexte, générer des documents, et alerter sur les évolutions.

#### Decision

Adopter une architecture **RAG (Retrieval-Augmented Generation)** :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI COPILOT ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

User Query
    │
    ▼
┌─────────────────┐
│  Query Router   │ ─────────────────────────────────────┐
│  (Intent Det.)  │                                       │
└────────┬────────┘                                       │
         │                                                 │
    ┌────┴────┬───────────────┐                           │
    ▼         ▼               ▼                           │
┌────────┐ ┌────────┐ ┌────────────┐                     │
│   QA   │ │ DocGen │ │  Alert     │                     │
│ Intent │ │ Intent │ │  Intent    │                     │
└───┬────┘ └───┬────┘ └─────┬──────┘                     │
    │          │            │                             │
    └────┬─────┴────────────┘                             │
         │                                                 │
         ▼                                                 │
┌─────────────────┐     ┌─────────────────┐              │
│ Context Builder │────▶│  Vector Search  │              │
│                 │     │   (Pinecone)    │              │
└────────┬────────┘     └────────┬────────┘              │
         │                       │                        │
         │    ┌──────────────────┘                        │
         │    │                                           │
         ▼    ▼                                           │
┌─────────────────┐     ┌─────────────────┐              │
│  Prompt Builder │────▶│   Claude API    │◀─────────────┘
│  (with context) │     │  (Anthropic)    │   (streaming)
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Response Parser │
                        │ (citations,     │
                        │  actions)       │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   UI Renderer   │
                        └─────────────────┘
```

#### Technical Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| LLM | Claude API (claude-3-5-sonnet) | Best reasoning, EU-friendly |
| Vector DB | Pinecone (EU region) | Managed, low-latency |
| Embeddings | text-embedding-3-small | Cost-effective |
| Streaming | SSE via Cloud Functions | Real-time UX |

#### Consequences

**Positive:**
- Réponses contextualisées et sourcées
- Latence acceptable (<5s P95)
- Coûts maîtrisés via caching

**Negative:**
- Dépendance à services tiers (Anthropic, Pinecone)
- Coût par requête (~$0.01-0.03)

**Mitigations:**
- Cache des embeddings et réponses fréquentes
- Fallback vers réponses pré-générées si API down
- Rate limiting par utilisateur

---

### ADR-003: Compliance Score Calculation

**Status:** Accepted
**Date:** 2026-01-22

#### Context

Le score de conformité doit être calculé en temps réel, par framework, avec pondération par criticité.

#### Decision

Implémenter un **scoring engine** côté client avec cache invalidation :

```typescript
// Scoring algorithm
interface ScoringEngine {
  calculateFrameworkScore(
    frameworkId: string,
    controls: Control[],
    assessments: Assessment[],
    mappings: ControlMapping[]
  ): ComplianceScore;
}

// Weighted scoring formula
const calculateScore = (assessments: Assessment[]): number => {
  const weights = { high: 3, medium: 2, low: 1 };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const assessment of assessments) {
    const weight = weights[assessment.criticality];
    totalWeight += weight;
    weightedScore += (assessment.score / 100) * weight;
  }

  return Math.round((weightedScore / totalWeight) * 100);
};
```

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SCORING ARCHITECTURE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Assessment Update
       │
       ▼
┌──────────────────┐
│ Firestore Trigger│ (Cloud Function)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ Score Calculator │────▶│ Score Document   │
│ (recalculate)    │     │ (denormalized)   │
└──────────────────┘     └──────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Real-time Update │
                         │ (Firestore sub)  │
                         └──────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   UI Update      │
                         │ (TanStack Query) │
                         └──────────────────┘
```

#### Consequences

**Positive:**
- Score toujours à jour
- UX fluide (optimistic updates)
- Historique automatique

**Negative:**
- Cloud Functions coût si beaucoup d'updates
- Complexité du cache invalidation

---

### ADR-004: Localization Strategy

**Status:** Accepted
**Date:** 2026-01-22

#### Context

Support de FR, EN, DE avec possibilité d'extension à d'autres langues EU.

#### Decision

Utiliser **react-i18next** avec namespaces par module :

```
public/
└── locales/
    ├── en/
    │   ├── common.json
    │   ├── dashboard.json
    │   ├── frameworks.json
    │   ├── copilot.json
    │   └── regulations/
    │       ├── nis2.json
    │       └── dora.json
    ├── fr/
    │   └── ... (same structure)
    └── de/
        └── ... (same structure)
```

#### Key Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Framework | react-i18next | Standard, well-maintained |
| Storage | JSON files in repo | Simple, versionable |
| Lazy loading | By namespace | Performance |
| Fallback | EN → FR → key | Graceful degradation |
| Regulatory content | Separate namespace | Large, domain-specific |

---

### ADR-005: Data Sovereignty & SecNumCloud

**Status:** Accepted
**Date:** 2026-01-22

#### Context

Hébergement EU obligatoire, certification SecNumCloud cible Q3 2026.

#### Decision

**Phase 1 (Now):** Firebase EU configuration optimale
**Phase 2 (Q3 2026):** Migration vers OVHcloud ou option SecNumCloud

#### Current Setup

```yaml
# Firebase configuration
firestore:
  location: eur3  # Belgium/Netherlands

storage:
  location: europe-west1  # Belgium

functions:
  location: europe-west1  # Belgium

hosting:
  headers:
    - source: "**"
      headers:
        - key: "X-Data-Residency"
          value: "EU"
```

#### SecNumCloud Path

```
Q1 2026: Audit préparatoire (gap analysis)
Q2 2026: Remédiation + documentation
Q3 2026: Audit SecNumCloud
Q4 2026: Certification
```

#### Hybrid Option (if needed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HYBRID ARCHITECTURE (SecNumCloud)                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐         ┌─────────────────────┐
│   Firebase (EU)     │         │  OVHcloud (SNC)     │
│   ──────────────    │         │  ──────────────     │
│   • Auth            │◀───────▶│  • Sensitive Data   │
│   • Non-sensitive   │   Sync  │  • Documents        │
│   • Real-time       │         │  • Audit Logs       │
└─────────────────────┘         └─────────────────────┘
```

---

## 4. Data Architecture

### 4.1 Firestore Collections Schema

```
firestore/
├── organizations/
│   └── {orgId}/
│       ├── profile (document)
│       ├── settings (document)
│       └── users/ (subcollection)
│
├── frameworks/                    # NEW
│   └── {frameworkId}/
│       ├── metadata (document)
│       └── requirements/ (subcollection)
│
├── controls/
│   └── {controlId}/
│       ├── metadata (document)
│       └── evidence/ (subcollection)
│
├── controlMappings/               # NEW
│   └── {mappingId}/
│       └── (control ↔ requirement links)
│
├── assessments/
│   └── {assessmentId}/
│       └── (control evaluations)
│
├── complianceScores/              # NEW (denormalized)
│   └── {orgId}_{frameworkId}/
│       └── (score snapshots)
│
├── copilotConversations/          # NEW
│   └── {conversationId}/
│       └── messages/ (subcollection)
│
└── auditLogs/
    └── {logId}/
        └── (all user actions)
```

### 4.2 Key Indexes

```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "controls",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "frameworkIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "controlMappings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "frameworkId", "order": "ASCENDING" },
        { "fieldPath": "controlId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "complianceScores",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "calculatedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 4.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW DIAGRAM                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   User Action   │
                    │ (assess control)│
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  Optimistic UI  │◀─│ControlService    │─▶│   Firestore     │
│  Update         │  │ .assess()        │  │   Write         │
└─────────────────┘  └──────────────────┘  └────────┬────────┘
                                                     │
                                                     ▼
                                           ┌─────────────────┐
                                           │ Cloud Function  │
                                           │ (onAssessment-  │
                                           │  Update)        │
                                           └────────┬────────┘
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                           ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                           │  Recalc     │ │   Write     │ │   Write     │
                           │  Score      │ │   Score     │ │   AuditLog  │
                           └─────────────┘ └─────────────┘ └─────────────┘
                                                    │
                                                    ▼
                                           ┌─────────────────┐
                                           │ Firestore       │
                                           │ Real-time Sub   │
                                           └────────┬────────┘
                                                    │
                                                    ▼
                                           ┌─────────────────┐
                                           │ TanStack Query  │
                                           │ Cache Invalidate│
                                           └────────┬────────┘
                                                    │
                                                    ▼
                                           ┌─────────────────┐
                                           │    UI Update    │
                                           │  (Dashboard)    │
                                           └─────────────────┘
```

---

## 5. API Architecture

### 5.1 Cloud Functions (v2) Structure

```
functions/
├── src/
│   ├── index.ts                 # Exports
│   ├── triggers/
│   │   ├── onAssessmentWrite.ts # Score recalculation
│   │   ├── onControlWrite.ts    # Mapping updates
│   │   └── onUserCreate.ts      # Onboarding
│   ├── callable/
│   │   ├── copilot.ts           # AI Copilot endpoints
│   │   ├── generateDocument.ts  # Doc generation
│   │   └── importData.ts        # Excel import
│   ├── scheduled/
│   │   ├── regulatorySync.ts    # Framework updates
│   │   └── scoreSnapshots.ts    # Daily score history
│   └── lib/
│       ├── scoring.ts           # Score calculation logic
│       ├── claude.ts            # Claude API wrapper
│       └── pinecone.ts          # Vector search
```

### 5.2 API Endpoints

| Endpoint | Type | Purpose |
|----------|------|---------|
| `copilot-chat` | Callable | AI chat streaming |
| `copilot-generate` | Callable | Document generation |
| `import-controls` | Callable | Excel/CSV import |
| `export-report` | Callable | PDF report generation |
| `onAssessmentWrite` | Trigger | Score recalculation |
| `regulatorySync` | Scheduled | Framework updates (daily) |

### 5.3 AI Copilot API

```typescript
// functions/src/callable/copilot.ts

interface CopilotChatRequest {
  conversationId: string;
  message: string;
  context: {
    organizationId: string;
    activeFrameworks: string[];
    currentPage?: string;
  };
}

interface CopilotChatResponse {
  messageId: string;
  content: string;
  citations: Citation[];
  suggestedActions: Action[];
  tokens: { prompt: number; completion: number };
}

export const copilotChat = onCall(
  {
    region: 'europe-west1',
    memory: '1GiB',
    timeoutSeconds: 60,
  },
  async (request): Promise<CopilotChatResponse> => {
    // 1. Build context from RAG
    const relevantDocs = await searchRegulations(request.data.message);

    // 2. Build prompt with context
    const prompt = buildPrompt(request.data, relevantDocs);

    // 3. Call Claude API
    const response = await claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    // 4. Parse and return
    return parseResponse(response);
  }
);
```

---

## 6. Frontend Architecture

### 6.1 Module Structure

```
src/
├── components/
│   ├── ui/                      # Design system (existing)
│   ├── layout/                  # Layout components (existing)
│   └── shared/                  # Shared components
│
├── features/                    # Feature modules
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── ComplianceGauge.tsx
│   │   │   ├── TrendChart.tsx
│   │   │   └── ActionsList.tsx
│   │   ├── hooks/
│   │   │   └── useComplianceScore.ts
│   │   └── index.ts
│   │
│   ├── frameworks/              # NEW
│   │   ├── components/
│   │   │   ├── FrameworkSelector.tsx
│   │   │   ├── RequirementsList.tsx
│   │   │   └── MappingMatrix.tsx
│   │   ├── hooks/
│   │   │   ├── useFrameworks.ts
│   │   │   └── useMappings.ts
│   │   └── index.ts
│   │
│   ├── copilot/                 # NEW
│   │   ├── components/
│   │   │   ├── CopilotPanel.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ActionButton.tsx
│   │   │   └── CitationLink.tsx
│   │   ├── hooks/
│   │   │   ├── useCopilot.ts
│   │   │   └── useConversation.ts
│   │   └── index.ts
│   │
│   └── controls/                # Enhanced
│       ├── components/
│       │   ├── ControlCard.tsx
│       │   ├── EvidenceUpload.tsx
│       │   └── AssessmentForm.tsx
│       └── hooks/
│           └── useControls.ts
│
├── stores/
│   ├── authStore.ts             # Existing
│   ├── complianceStore.ts       # NEW
│   ├── frameworkStore.ts        # NEW
│   ├── copilotStore.ts          # NEW
│   └── voxelStore.ts            # Existing
│
├── services/
│   ├── ComplianceService.ts     # NEW
│   ├── FrameworkService.ts      # NEW
│   ├── CopilotService.ts        # NEW
│   └── ... (existing)
│
└── types/
    ├── framework.ts             # NEW
    ├── compliance.ts            # NEW
    ├── copilot.ts               # NEW
    └── ... (existing)
```

### 6.2 Store Design (Zustand)

```typescript
// stores/complianceStore.ts

interface ComplianceState {
  // State
  scores: Record<string, ComplianceScore>;
  isLoading: boolean;
  error: Error | null;

  // Computed
  getScoreByFramework: (frameworkId: string) => ComplianceScore | null;
  getOverallScore: () => number;

  // Actions
  fetchScores: (orgId: string) => Promise<void>;
  subscribeToScores: (orgId: string) => () => void;
}

export const useComplianceStore = create<ComplianceState>((set, get) => ({
  scores: {},
  isLoading: false,
  error: null,

  getScoreByFramework: (frameworkId) => get().scores[frameworkId] ?? null,

  getOverallScore: () => {
    const scores = Object.values(get().scores);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
  },

  fetchScores: async (orgId) => {
    set({ isLoading: true });
    try {
      const scores = await ComplianceService.getScores(orgId);
      set({ scores, isLoading: false });
    } catch (error) {
      set({ error: error as Error, isLoading: false });
    }
  },

  subscribeToScores: (orgId) => {
    return ComplianceService.subscribeToScores(orgId, (scores) => {
      set({ scores });
    });
  },
}));
```

### 6.3 Component Pattern

```typescript
// features/copilot/components/CopilotPanel.tsx

import { useCopilot } from '../hooks/useCopilot';
import { ChatMessage } from './ChatMessage';
import { useTranslation } from 'react-i18next';

export const CopilotPanel: React.FC = () => {
  const { t } = useTranslation('copilot');
  const {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
  } = useCopilot();

  const [input, setInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    await sendMessage(input);
    setInput('');
  };

  return (
    <div className="glass-panel rounded-3xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-semibold">
          {t('title')}
        </h2>
        <button
          onClick={clearHistory}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {t('clearHistory')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && <LoadingIndicator />}
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder')}
          className="w-full px-4 py-3 rounded-xl border-0 bg-white/50
                     focus:ring-2 focus:ring-blue-500"
        />
      </form>
    </div>
  );
};
```

---

## 7. Security Architecture

### 7.1 Security Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Network                                                            │
│  • HTTPS only (TLS 1.3)                                                    │
│  • Cloudflare WAF                                                          │
│  • DDoS protection                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Authentication                                                     │
│  • Firebase Auth                                                           │
│  • MFA (optional, mandatory for admin)                                     │
│  • Session management (24h expiry)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Authorization (RBAC)                                               │
│  • Roles: admin, manager, analyst, viewer                                  │
│  • Permission-based access                                                 │
│  • Organization isolation                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 4: Data                                                               │
│  • Encryption at rest (AES-256)                                            │
│  • Encryption in transit (TLS 1.3)                                         │
│  • Field-level encryption (sensitive)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 5: Audit                                                              │
│  • All actions logged                                                      │
│  • Immutable audit trail                                                   │
│  • 7-year retention                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Firestore Security Rules

```javascript
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function belongsToOrg(orgId) {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId == orgId;
    }

    function hasRole(orgId, role) {
      let user = get(/databases/$(database)/documents/users/$(request.auth.uid));
      return user.data.organizationId == orgId &&
             user.data.role == role;
    }

    // Organization-scoped data
    match /organizations/{orgId} {
      allow read: if belongsToOrg(orgId);
      allow write: if hasRole(orgId, 'admin');

      match /controls/{controlId} {
        allow read: if belongsToOrg(orgId);
        allow write: if hasRole(orgId, 'admin') || hasRole(orgId, 'manager');
      }

      match /assessments/{assessmentId} {
        allow read: if belongsToOrg(orgId);
        allow create, update: if belongsToOrg(orgId) &&
                                 (hasRole(orgId, 'admin') ||
                                  hasRole(orgId, 'manager') ||
                                  hasRole(orgId, 'analyst'));
        allow delete: if hasRole(orgId, 'admin');
      }
    }

    // Copilot conversations
    match /copilotConversations/{convId} {
      allow read, write: if isAuthenticated() &&
                           resource.data.userId == request.auth.uid;
    }

    // Framework data (read-only for users)
    match /frameworks/{frameworkId} {
      allow read: if isAuthenticated();
      allow write: if false; // Admin only via backend
    }
  }
}
```

### 7.3 API Security

```typescript
// Middleware for Cloud Functions

import { HttpsError } from 'firebase-functions/v2/https';

export const validateRequest = async (
  request: CallableRequest,
  requiredRoles: Role[] = []
) => {
  // 1. Check authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  // 2. Get user data
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(request.auth.uid)
    .get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'User not found');
  }

  const userData = userDoc.data();

  // 3. Check role if required
  if (requiredRoles.length > 0 && !requiredRoles.includes(userData.role)) {
    throw new HttpsError('permission-denied', 'Insufficient permissions');
  }

  // 4. Rate limiting
  await checkRateLimit(request.auth.uid);

  // 5. Log action
  await logAction({
    userId: request.auth.uid,
    action: request.rawRequest.path,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return userData;
};
```

---

## 8. Testing Strategy

### 8.1 Test Pyramid

```
                    ┌─────────┐
                   ╱           ╲
                  │    E2E     │  (Playwright)
                  │   Tests    │  10%
                 ╱             ╲
                ├───────────────┤
               ╱                 ╲
              │   Integration    │  (Vitest + MSW)
              │     Tests        │  30%
             ╱                   ╲
            ├─────────────────────┤
           ╱                       ╲
          │       Unit Tests       │  (Vitest)
          │                        │  60%
         ╱                         ╲
        └───────────────────────────┘
```

### 8.2 Test Organization

```
src/
├── features/
│   └── copilot/
│       ├── components/
│       │   └── __tests__/
│       │       ├── CopilotPanel.test.tsx
│       │       └── ChatMessage.test.tsx
│       ├── hooks/
│       │   └── __tests__/
│       │       └── useCopilot.test.ts
│       └── services/
│           └── __tests__/
│               └── CopilotService.test.ts
│
tests/
├── e2e/
│   ├── compliance-flow.spec.ts
│   ├── copilot-chat.spec.ts
│   └── framework-setup.spec.ts
└── integration/
    ├── scoring.test.ts
    └── framework-mapping.test.ts
```

### 8.3 Coverage Targets

| Module | Target | Critical Paths |
|--------|--------|----------------|
| **Scoring Engine** | 95% | Score calculation, weighting |
| **Copilot Service** | 85% | Message handling, error states |
| **Framework Service** | 80% | CRUD, mapping logic |
| **UI Components** | 70% | User interactions |
| **Overall** | 70% | NFR-M1 requirement |

---

## 9. Deployment Architecture

### 9.1 Environments

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT PIPELINE                                │
└─────────────────────────────────────────────────────────────────────────────┘

   Development          Staging              Production
   ───────────          ───────              ──────────

   ┌─────────┐         ┌─────────┐          ┌─────────┐
   │   Dev   │────────▶│ Staging │─────────▶│  Prod   │
   │ Branch  │         │  Auto   │          │ Manual  │
   └─────────┘         └─────────┘          └─────────┘
        │                   │                    │
        ▼                   ▼                    ▼
   ┌─────────┐         ┌─────────┐          ┌─────────┐
   │Firebase │         │Firebase │          │Firebase │
   │  Dev    │         │ Staging │          │  Prod   │
   │ Project │         │ Project │          │ Project │
   └─────────┘         └─────────┘          └─────────┘
```

### 9.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          firebaseServiceAccount: ${{ secrets.FIREBASE_SA_STAGING }}
          projectId: sentinel-grc-staging
          channelId: live

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v4
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          firebaseServiceAccount: ${{ secrets.FIREBASE_SA_PROD }}
          projectId: sentinel-grc-prod
          channelId: live
```

---

## 10. Monitoring & Observability

### 10.1 Monitoring Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **APM** | Firebase Performance | Frontend performance |
| **Logs** | Cloud Logging | Centralized logs |
| **Errors** | Sentry | Error tracking |
| **Analytics** | Mixpanel | Product analytics |
| **Uptime** | Better Uptime | Availability monitoring |
| **Costs** | Firebase Console | Cost tracking |

### 10.2 Key Metrics Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPERATIONS DASHBOARD                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Uptime    │  │   P95 API   │  │   Error     │  │   Active    │       │
│  │   99.98%    │  │    342ms    │  │   Rate      │  │   Users     │       │
│  │     ✓       │  │     ✓       │  │   0.12%     │  │    1,234    │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  AI Copilot Metrics:                                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Requests/min: 45  │  Avg Latency: 2.3s  │  Cost/day: $12.50         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Alerts Configuration

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| Uptime | <99.5% (5min) | Critical | PagerDuty + Slack |
| API Latency | P95 >2s (5min) | Warning | Slack |
| Error Rate | >1% (5min) | Critical | PagerDuty |
| Copilot Latency | P95 >10s | Warning | Slack |
| Daily Cost | >$500 | Info | Email |

---

## 11. Migration Plan

### 11.1 Data Migration

```
Phase 1: Schema Extension (Week 1)
├── Add new collections (frameworks, controlMappings, complianceScores)
├── Deploy new security rules
└── No user-facing changes

Phase 2: Data Seeding (Week 2)
├── Import NIS2 framework data
├── Import DORA framework data
├── Create default control mappings
└── Backfill compliance scores

Phase 3: Feature Rollout (Week 3-4)
├── Enable framework module (feature flag)
├── Enable copilot module (beta users)
├── Gradual rollout to all users
└── Monitor and iterate
```

### 11.2 Feature Flags

```typescript
// Feature flag configuration
const FEATURES = {
  MULTI_FRAMEWORK: {
    enabled: true,
    rollout: 100, // percentage
  },
  AI_COPILOT: {
    enabled: true,
    rollout: 50, // beta
    allowlist: ['org-123', 'org-456'],
  },
  COMPLIANCE_GAMIFICATION: {
    enabled: false,
    rollout: 0,
  },
};
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-22 | Thibaultllopis | Initial architecture |

---

## Appendix A: Technology Decisions Matrix

| Decision | Options Considered | Selected | Rationale |
|----------|-------------------|----------|-----------|
| LLM Provider | OpenAI, Claude, Gemini | **Claude** | Best reasoning, EU-friendly |
| Vector DB | Pinecone, Weaviate, Chroma | **Pinecone** | Managed, EU region available |
| Embeddings | OpenAI, Cohere, Voyage | **OpenAI** | Cost/quality balance |
| State Mgmt | Redux, Zustand, Jotai | **Zustand** | Already in stack, simple |
| i18n | react-i18next, lingui | **react-i18next** | Mature, well-documented |
| Hosting | Firebase, Vercel, Cloudflare | **Firebase** | Already in stack, EU region |

---

*Architecture Document v1.0*
*Sentinel GRC - European Leader Strategy*
*Confidential*
