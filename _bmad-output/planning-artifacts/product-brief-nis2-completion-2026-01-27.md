---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - project-context.md
  - architecture-european-leader-2026-01-22.md
  - audit-exhaustif-agent-capabilities
date: 2026-01-27
author: Thibaultllopis
status: complete
---

# Product Brief: Completion NIS2 - Modules Manquants

## Executive Summary

Ce Product Brief adresse les **3 derniers gaps** identifiés lors de l'audit exhaustif de Sentinel GRC v2 pour atteindre une couverture **100% NIS2** (Directive EU 2022/2555).

**Couverture actuelle : 85%** | **Cible : 100%**

### Gaps identifiés (après audit de l'existant)

| Gap | Article NIS2 | Module proposé |
|-----|--------------|----------------|
| Formation & sensibilisation | Art. 21.2g | **Module A** |
| Inventaire certificats SSL/TLS | Art. 21.2h | **Module B** |
| Revue périodique des droits | Art. 21.2i | **Module B** |

### Ce qui existe DEJA (confirmé par audit)

- Agent endpoint avec 10 checks de conformite (MFA, encryption, patches, firewall, etc.)
- encryptionService.ts, signatureService.ts, integrityService.ts
- sessionMonitoringService.ts, RBAC complet
- CIS Benchmarks Windows/macOS/Linux
- Score de conformite multi-framework

---

## 1. Vision & Objectifs

### 1.1 Vision

Permettre aux organisations soumises a NIS2 d'atteindre une **conformite complete et demontrable** sur les 10 mesures de l'Article 21, en integrant les modules manquants de maniere coherente avec l'architecture existante.

### 1.2 Objectifs Business

| Objectif | Mesure de succes | Timeline |
|----------|------------------|----------|
| Couverture NIS2 100% | 10/10 articles Art.21 couverts | Sprint 1-2 |
| Auditabilite | Preuves exportables pour chaque exigence | Sprint 2 |
| Adoption utilisateurs | 80% des orgs utilisent les nouveaux modules | M+3 |

### 1.3 Alignement Strategique

- **Positionnement** : Leader europeen GRC avec conformite NIS2 native
- **Differenciateur** : Seule plateforme couvrant 100% NIS2 + DORA + RGPD
- **Marche cible** : 15,000+ organisations francaises sous NIS2

---

## 2. Module A : Formation & Sensibilisation Cyber

### 2.1 Contexte Reglementaire

**NIS2 Article 21.2(g)** : Les entites essentielles et importantes doivent mettre en oeuvre des mesures de **formation a la cybersecurite** et des **pratiques d'hygiene informatique de base**.

### 2.2 Probleme a Resoudre

L'agent endpoint verifie les configurations techniques (MFA, patches, etc.) mais **ne track pas la formation humaine**. Or NIS2 exige une preuve de sensibilisation du personnel.

### 2.3 Solution Proposee

#### Fonctionnalites Cles

| Feature | Description | Priorite |
|---------|-------------|----------|
| **Catalogue formations** | Bibliotheque de formations (ANSSI, ISO27001, Phishing, RGPD) | Haute |
| **Assignation & tracking** | Assigner des formations aux employes, suivre la completion | Haute |
| **Campagnes planifiees** | Programmer des campagnes de sensibilisation recurrentes | Haute |
| **Quiz & evaluation** | Evaluer la comprehension post-formation | Moyenne |
| **Dashboard completion** | Taux de completion par departement/role | Haute |
| **Attestations** | Generer des certificats de completion | Moyenne |
| **Integration score** | Impact sur le score de conformite global | Haute |

#### User Stories Cles

1. **En tant que** RSSI, **je veux** voir le taux de completion des formations par departement **afin de** identifier les equipes a risque
2. **En tant que** RH, **je veux** assigner des formations obligatoires aux nouveaux employes **afin de** garantir l'onboarding securite
3. **En tant qu'** employe, **je veux** voir mes formations assignees et mon avancement **afin de** rester conforme
4. **En tant qu'** auditeur, **je veux** exporter les preuves de formation **afin de** demontrer la conformite NIS2

### 2.4 Integration avec l'Existant

```
┌─────────────────────────────────────────────────────────────┐
│                    SCORE CONFORMITE                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│  │Controls │ │ Risks   │ │ Audits  │ │ NEW: Formation  │   │
│  │  40%    │ │  30%    │ │  20%    │ │      10%        │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Collections Firestore :**
- `training_catalog` - Catalogue des formations
- `training_assignments` - Assignations par utilisateur
- `training_completions` - Historique des completions
- `training_campaigns` - Campagnes planifiees

**Integration Agent :**
- L'agent peut remonter les formations locales detectees (optionnel)
- Correlation avec les checks de securite (ex: formation MFA → check MFA)

### 2.5 Mockup UI

```
┌──────────────────────────────────────────────────────────────┐
│ Formation & Sensibilisation                    [+ Campagne]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │    85%      │  │    12       │  │     3       │          │
│  │ Completion  │  │ Formations  │  │ En retard   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  Par Departement           Formations Obligatoires          │
│  ├── IT: 95% ████████████  ├── Phishing 101 (ANSSI)        │
│  ├── RH: 78% ███████░░░░   ├── RGPD Fondamentaux           │
│  ├── Finance: 82% ████████ ├── Securite Mots de Passe      │
│  └── Marketing: 65% ██████ └── Gestion des Incidents       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Module B : Gouvernance des Acces & Certificats

### 3.1 Contexte Reglementaire

**NIS2 Article 21.2(h)** : Politiques et procedures relatives a l'utilisation de la **cryptographie** et, le cas echeant, du **chiffrement**.

**NIS2 Article 21.2(i)** : Securite des ressources humaines, politiques de **controle d'acces** et gestion des actifs.

### 3.2 Probleme a Resoudre

1. **Certificats** : L'agent check le chiffrement disque mais pas l'inventaire des certificats SSL/TLS de l'infrastructure
2. **Revue des droits** : Le RBAC existe mais pas de workflow de revue periodique obligatoire

### 3.3 Solution Proposee

#### 3.3.1 Inventaire Certificats

| Feature | Description | Priorite |
|---------|-------------|----------|
| **Inventaire certificats** | Liste de tous les certificats SSL/TLS | Haute |
| **Alertes expiration** | Notifications 30/15/7 jours avant expiration | Haute |
| **Cycle de vie** | Tracking creation → renouvellement → revocation | Moyenne |
| **Import automatique** | Scan des endpoints pour decouvrir les certificats | Basse |
| **Dashboard crypto** | Vue centralisee de l'etat cryptographique | Haute |

#### 3.3.2 Revue Periodique des Droits

| Feature | Description | Priorite |
|---------|-------------|----------|
| **Campagnes de revue** | Declencher une revue tous les 90 jours | Haute |
| **Workflow approbation** | Manager approuve/revoque les droits de son equipe | Haute |
| **Detection comptes dormants** | Alerter sur les comptes inactifs >90 jours | Haute |
| **Rapport d'audit** | Export des revues pour preuves audit | Haute |
| **Integration IAM** | Connexion avec les systemes IAM existants (optionnel) | Basse |

### 3.4 User Stories Cles

**Certificats :**
1. **En tant que** ops, **je veux** voir tous les certificats proches de l'expiration **afin de** planifier les renouvellements
2. **En tant que** RSSI, **je veux** un dashboard de l'etat crypto de l'organisation **afin de** demontrer la conformite

**Revue des droits :**
3. **En tant que** manager, **je veux** recevoir une notification de revue des droits de mon equipe **afin de** valider les acces
4. **En tant que** RSSI, **je veux** un rapport des revues effectuees **afin de** prouver la conformite NIS2

### 3.5 Integration avec l'Existant

**Collections Firestore :**
- `certificates` - Inventaire des certificats
- `access_reviews` - Historique des revues de droits
- `access_review_campaigns` - Campagnes de revue planifiees
- `dormant_accounts` - Comptes detectes comme dormants

**Integration Agent :**
- L'agent peut remonter les certificats locaux detectes (machine certs)
- Correlation avec les assets existants

**Integration avec modules existants :**
- Lien avec `assets` pour associer certificats aux actifs
- Lien avec `users` pour la revue des droits
- Impact sur le score de conformite

### 3.6 Mockup UI - Certificats

```
┌──────────────────────────────────────────────────────────────┐
│ Inventaire Certificats                      [+ Certificat]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │    24       │  │     3       │  │     1       │          │
│  │   Total     │  │  Expire <30j│  │   Expire    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  Nom              Domaine           Expiration    Status     │
│  ├── api-prod     api.sentinel.io   2026-02-15   ⚠️ 19j     │
│  ├── web-prod     app.sentinel.io   2026-06-01   ✅ OK      │
│  ├── mail         mail.sentinel.io  2026-01-30   🔴 3j      │
│  └── internal     *.internal.io     2027-01-01   ✅ OK      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.7 Mockup UI - Revue des Droits

```
┌──────────────────────────────────────────────────────────────┐
│ Revue des Droits d'Acces                   [Lancer Revue]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Campagne en cours: Q1 2026 (Deadline: 2026-02-15)          │
│  ████████████████████░░░░░░░░░░ 68% complete                │
│                                                              │
│  Par Manager           Status        Actions                 │
│  ├── J. Dupont        ✅ Complete   12/12 revus             │
│  ├── M. Martin        ⏳ En cours   8/15 revus              │
│  ├── S. Bernard       ⚠️ En retard  0/8 revus               │
│  └── A. Leroy         ✅ Complete   6/6 revus               │
│                                                              │
│  Comptes Dormants Detectes: 4                                │
│  └── [Voir details]                                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Architecture Technique

### 4.1 Nouveaux Composants

```
src/
├── components/
│   ├── training/                    # Module Formation
│   │   ├── TrainingDashboard.tsx
│   │   ├── TrainingCatalog.tsx
│   │   ├── TrainingAssignment.tsx
│   │   ├── TrainingProgress.tsx
│   │   ├── CampaignManager.tsx
│   │   └── CertificateGenerator.tsx
│   │
│   ├── certificates/                # Module Certificats
│   │   ├── CertificateDashboard.tsx
│   │   ├── CertificateList.tsx
│   │   ├── CertificateForm.tsx
│   │   └── CertificateAlerts.tsx
│   │
│   └── access-review/               # Module Revue Droits
│       ├── AccessReviewDashboard.tsx
│       ├── ReviewCampaign.tsx
│       ├── ManagerReviewForm.tsx
│       ├── DormantAccountsList.tsx
│       └── AccessReviewReport.tsx
│
├── services/
│   ├── TrainingService.ts
│   ├── CertificateService.ts
│   └── AccessReviewService.ts
│
├── types/
│   ├── training.ts
│   ├── certificates.ts
│   └── accessReview.ts
│
└── hooks/
    ├── useTraining.ts
    ├── useCertificates.ts
    └── useAccessReview.ts
```

### 4.2 Cloud Functions

```
functions/
├── scheduled/
│   ├── checkCertificateExpiration.js    # Daily - alertes expiration
│   ├── checkAccessReviewDeadlines.js    # Daily - rappels revue
│   └── detectDormantAccounts.js         # Weekly - comptes dormants
│
├── triggers/
│   ├── onTrainingComplete.ts            # Mise a jour score
│   ├── onCertificateChange.ts           # Alertes
│   └── onAccessReviewComplete.ts        # Mise a jour audit trail
│
└── callable/
    ├── generateTrainingCertificate.ts   # PDF attestation
    └── exportAccessReviewReport.ts      # Export audit
```

### 4.3 Impact Score Conformite

```typescript
// Nouvelle formule de score (mise a jour)
const complianceScore = {
  controls: 35%,      // Actuellement 40% → reduit
  risks: 25%,         // Actuellement 30% → reduit
  audits: 20%,        // Inchange
  documents: 10%,     // Inchange
  training: 10%       // NOUVEAU
};

// Score formation
const trainingScore = (completedAssignments / totalAssignments) * 100;
```

---

## 5. Donnees & Collections Firestore

### 5.1 Schema Training

```typescript
// Collection: training_catalog
interface TrainingCourse {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  category: 'security' | 'compliance' | 'awareness' | 'technical';
  source: 'anssi' | 'internal' | 'external';
  duration: number; // minutes
  isRequired: boolean;
  targetRoles: string[];
  frameworkMappings: {
    nis2?: string[];    // ex: ['21.2g']
    iso27001?: string[]; // ex: ['A.7.2.2']
  };
  content?: {
    type: 'video' | 'document' | 'quiz' | 'external_link';
    url?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Collection: training_assignments
interface TrainingAssignment {
  id: string;
  organizationId: string;
  userId: string;
  courseId: string;
  assignedBy: string;
  assignedAt: Timestamp;
  dueDate: Timestamp;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  completedAt?: Timestamp;
  score?: number; // Quiz score
  certificateUrl?: string;
}
```

### 5.2 Schema Certificates

```typescript
// Collection: certificates
interface Certificate {
  id: string;
  organizationId: string;
  name: string;
  domain: string;
  issuer: string;
  serialNumber: string;
  validFrom: Timestamp;
  validTo: Timestamp;
  algorithm: string;
  keySize: number;
  linkedAssetId?: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'revoked';
  lastCheckedAt: Timestamp;
  renewalReminder: boolean;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 5.3 Schema Access Review

```typescript
// Collection: access_review_campaigns
interface AccessReviewCampaign {
  id: string;
  organizationId: string;
  name: string;
  startDate: Timestamp;
  dueDate: Timestamp;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  scope: 'all' | 'department' | 'role';
  scopeFilter?: string[];
  progress: {
    total: number;
    completed: number;
    approved: number;
    revoked: number;
  };
  createdBy: string;
  createdAt: Timestamp;
}

// Collection: access_reviews
interface AccessReview {
  id: string;
  organizationId: string;
  campaignId: string;
  userId: string;
  reviewerId: string; // Manager
  status: 'pending' | 'approved' | 'revoked' | 'escalated';
  permissions: {
    resource: string;
    level: string;
    decision: 'keep' | 'revoke' | 'escalate';
    reason?: string;
  }[];
  reviewedAt?: Timestamp;
  createdAt: Timestamp;
}
```

---

## 6. Plan d'Implementation

### 6.1 Sprint 1 (Semaines 1-2) : Module Formation

| Story | Points | Description |
|-------|--------|-------------|
| TRN-1 | 5 | Creer TrainingService et types |
| TRN-2 | 8 | TrainingCatalog avec CRUD |
| TRN-3 | 8 | TrainingAssignment et tracking |
| TRN-4 | 5 | TrainingDashboard avec stats |
| TRN-5 | 3 | Integration score conformite |
| TRN-6 | 5 | Cloud function rappels |

**Total Sprint 1 : 34 points**

### 6.2 Sprint 2 (Semaines 3-4) : Module Certificats + Revue Droits

| Story | Points | Description |
|-------|--------|-------------|
| CRT-1 | 5 | CertificateService et types |
| CRT-2 | 5 | CertificateList avec alertes |
| CRT-3 | 3 | Cloud function expiration |
| ARV-1 | 5 | AccessReviewService et types |
| ARV-2 | 8 | ReviewCampaign workflow |
| ARV-3 | 5 | ManagerReviewForm |
| ARV-4 | 3 | DormantAccounts detection |
| ARV-5 | 5 | Export rapport audit |

**Total Sprint 2 : 39 points**

### 6.3 Sprint 3 (Semaine 5) : Integration & Tests

| Story | Points | Description |
|-------|--------|-------------|
| INT-1 | 5 | Integration dashboard principal |
| INT-2 | 3 | Tests unitaires (>70% coverage) |
| INT-3 | 3 | Tests E2E parcours critiques |
| INT-4 | 2 | i18n FR/EN |
| INT-5 | 2 | Documentation utilisateur |

**Total Sprint 3 : 15 points**

---

## 7. Criteres d'Acceptance

### 7.1 Module Formation

- [ ] Catalogue de formations avec CRUD complet
- [ ] Assignation de formations aux utilisateurs
- [ ] Tracking de la completion avec dates
- [ ] Dashboard avec taux de completion par departement
- [ ] Generation d'attestations PDF
- [ ] Impact sur le score de conformite (10%)
- [ ] Notifications de rappel avant deadline
- [ ] Export CSV des completions

### 7.2 Module Certificats

- [ ] Inventaire des certificats avec CRUD
- [ ] Alertes automatiques 30/15/7 jours avant expiration
- [ ] Dashboard avec vue globale de l'etat crypto
- [ ] Lien optionnel avec les actifs
- [ ] Export pour audit

### 7.3 Module Revue des Droits

- [ ] Creation de campagnes de revue
- [ ] Workflow manager → approbation/revocation
- [ ] Detection automatique des comptes dormants (>90j)
- [ ] Rapport exportable pour audit NIS2
- [ ] Notifications de rappel aux managers

---

## 8. Risques & Mitigations

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|-------------|------------|
| Adoption faible du module formation | Moyen | Moyenne | Gamification, rappels automatiques |
| Donnees certificats incompletes | Moyen | Haute | Import manuel + scan optionnel |
| Resistance des managers a la revue | Moyen | Moyenne | UI simple, delegation possible |
| Surcharge du score conformite | Bas | Basse | Ponderation ajustable par config |

---

## 9. Metriques de Succes

| KPI | Baseline | Cible M+3 |
|-----|----------|-----------|
| Couverture NIS2 Art.21 | 85% | 100% |
| Taux completion formations | N/A | 80% |
| Certificats expires | N/A | 0 |
| Revues completees a temps | N/A | 95% |
| Comptes dormants traites | N/A | 100% |

---

## 10. Conclusion

Ce Product Brief definit les **2 modules manquants** pour atteindre une couverture NIS2 complete :

1. **Module Formation & Sensibilisation** - Art. 21.2g
2. **Module Gouvernance (Certificats + Revue Droits)** - Art. 21.2h/i

L'implementation s'appuie sur l'architecture existante de Sentinel GRC v2, reutilise les patterns etablis (services statiques, Zustand, Firestore), et s'integre avec le score de conformite existant.

**Effort total estime : 88 points (~5 semaines)**

---

_Document genere le 2026-01-27 par Mary (Business Analyst) apres audit exhaustif de Sentinel GRC v2_
