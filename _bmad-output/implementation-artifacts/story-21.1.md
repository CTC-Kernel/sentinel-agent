# Story 21.1: Définition du Contexte Business

Status: ready-for-dev

## Story

As a RSSI,
I want to document my business context,
so that risk assessments are grounded in reality.

## Acceptance Criteria

1. Accès au module "Contexte de Risque" dans la navigation
2. Documentation des: Activités, Objectifs, Processus critiques
3. Liaison possible vers les documents organisationnels
4. Contexte disponible pour toutes les analyses de risque
5. Versioning du contexte (historique des modifications)
6. Template de questions pour guider la saisie

## Tasks / Subtasks

- [ ] Task 1: Créer le type RiskContext (AC: 2)
  - [ ] Interface dans `src/types/riskContext.ts`
  - [ ] Sous-types: BusinessContext, RegulatoryContext, etc.

- [ ] Task 2: Créer le service RiskContextService (AC: 4, 5)
  - [ ] `src/services/riskContextService.ts`
  - [ ] CRUD operations
  - [ ] Version history

- [ ] Task 3: Créer la vue RiskContext (AC: 1)
  - [ ] `src/views/RiskContext.tsx`
  - [ ] Tabs: Business, Réglementaire, Appétit, Critères
  - [ ] Navigation et routing

- [ ] Task 4: Créer le formulaire BusinessContextForm (AC: 2, 6)
  - [ ] `src/components/riskContext/BusinessContextForm.tsx`
  - [ ] Questions guidées
  - [ ] Rich text editor pour descriptions
  - [ ] Linked documents picker

- [ ] Task 5: Implémenter la liaison documents (AC: 3)
  - [ ] Multi-select pour documents existants
  - [ ] Upload de nouveaux documents
  - [ ] Affichage des documents liés

## Dev Notes

### Data Structure

```typescript
interface RiskContext {
  id: string;
  tenantId: string;
  version: number;
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: string;
  businessContext: BusinessContext;
  regulatoryContext: RegulatoryContext;
  riskAppetite: RiskAppetite;
  evaluationCriteria: EvaluationCriteria;
}

interface BusinessContext {
  organizationMission: string;
  strategicObjectives: string[];
  criticalProcesses: CriticalProcess[];
  stakeholders: Stakeholder[];
  businessConstraints: string[];
  linkedDocumentIds: string[];
}

interface CriticalProcess {
  id: string;
  name: string;
  description: string;
  owner: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
}

interface Stakeholder {
  id: string;
  name: string;
  role: string;
  interests: string[];
  influence: 'low' | 'medium' | 'high';
}
```

### Guided Questions Template

```typescript
const businessContextQuestions = [
  {
    id: 'mission',
    question: 'Quelle est la mission principale de votre organisation?',
    field: 'organizationMission',
    type: 'textarea',
  },
  {
    id: 'objectives',
    question: 'Quels sont vos objectifs stratégiques pour les 3-5 prochaines années?',
    field: 'strategicObjectives',
    type: 'list',
  },
  {
    id: 'processes',
    question: 'Quels sont les processus critiques pour votre activité?',
    field: 'criticalProcesses',
    type: 'structured_list',
  },
  {
    id: 'constraints',
    question: 'Quelles sont les contraintes majeures de votre environnement?',
    field: 'businessConstraints',
    type: 'list',
    examples: ['Budget limité', 'Pénurie de compétences', 'Contraintes réglementaires'],
  },
];
```

### Version History

```typescript
interface ContextVersion {
  version: number;
  createdAt: Timestamp;
  createdBy: string;
  changeDescription: string;
  snapshot: RiskContext;
}

// Stored in: tenants/{tenantId}/riskContext/current
// History in: tenants/{tenantId}/riskContext/versions/{versionNumber}
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Contexte de Risque (ISO 27005)                 [Enregistrer]│
├──────────┬──────────┬──────────┬───────────────────────────┤
│ Business │ Réglementaire │ Appétit │ Critères           │
├──────────┴──────────┴──────────┴───────────────────────────┤
│                                                             │
│ Mission de l'organisation                                   │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ [Rich text editor]                                      ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Objectifs stratégiques                                      │
│ + Objectif 1                                               │
│ + Objectif 2                                               │
│ [+ Ajouter]                                                │
│                                                             │
│ Processus critiques                                         │
│ ┌─────────┬─────────┬──────────┬─────────┐                │
│ │ Processus│ Propriétaire│ Criticité │ Actions │          │
│ └─────────┴─────────┴──────────┴─────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-19.1]
- [Source: ISO 27005:2022 - Clause 7.2]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
