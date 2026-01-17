# Story 20.1: Création du Programme SMSI

Status: ready-for-dev

## Story

As a RSSI/PM,
I want to create an SMSI program with PDCA phases,
so that I can track my certification journey.

## Acceptance Criteria

1. Accès au module "Programme SMSI" dans la navigation
2. Création avec: Nom, Description, Date de certification cible
3. Programme créé avec 4 phases: Plan, Do, Check, Act
4. Chaque phase a le statut "Not started"
5. Visualisation du cycle PDCA (roue de Deming)
6. Un seul programme actif par tenant

## Tasks / Subtasks

- [ ] Task 1: Créer le type SMSIProgram (AC: 2, 3, 4)
  - [ ] Interface dans `src/types/smsi.ts`
  - [ ] Phases: plan, do, check, act
  - [ ] Status par phase: not_started, in_progress, completed

- [ ] Task 2: Créer le service SMSIProgramService (AC: 6)
  - [ ] `src/services/smsiProgramService.ts`
  - [ ] `createProgram()`, `getActiveProgram()`
  - [ ] Validation: un seul programme actif

- [ ] Task 3: Créer la vue SMSIProgram (AC: 1)
  - [ ] `src/views/SMSIProgram.tsx`
  - [ ] Ajout dans le router
  - [ ] Ajout dans la navigation principale

- [ ] Task 4: Créer le formulaire CreateProgramForm (AC: 2)
  - [ ] `src/components/smsi/CreateProgramForm.tsx`
  - [ ] Validation des champs
  - [ ] Date picker pour certification

- [ ] Task 5: Créer le composant PDCAWheel (AC: 5)
  - [ ] `src/components/smsi/PDCAWheel.tsx`
  - [ ] Roue interactive avec 4 quadrants
  - [ ] Couleurs par status
  - [ ] Animation de progression

## Dev Notes

### Data Structure

```typescript
interface SMSIProgram {
  id: string;
  name: string;
  description: string;
  targetCertificationDate: Timestamp;
  status: 'draft' | 'active' | 'completed' | 'archived';
  phases: {
    plan: PDCAPhase;
    do: PDCAPhase;
    check: PDCAPhase;
    act: PDCAPhase;
  };
  currentPhase: 'plan' | 'do' | 'check' | 'act';
  progress: number; // 0-100
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

interface PDCAPhase {
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  responsibleId?: string;
  milestones: Milestone[];
  progress: number; // 0-100
}
```

### PDCA Wheel Design

```
         PLAN
       ╱      ╲
      ╱   P    ╲
     │    ↓     │
  ACT│ ← ● → │DO
     │    ↑     │
      ╲   C    ╱
       ╲      ╱
        CHECK
```

### Phase Descriptions

| Phase | FR | Description |
|-------|-------|-------------|
| Plan | Planifier | Définir les objectifs, identifier les risques, planifier les actions |
| Do | Déployer | Mettre en œuvre les actions planifiées |
| Check | Contrôler | Mesurer les résultats, auditer, évaluer |
| Act | Améliorer | Corriger les écarts, améliorer continuellement |

### Firestore Path

```
tenants/{tenantId}/smsiPrograms/{programId}
```

### Single Active Program Validation

```typescript
const createProgram = async (program: Partial<SMSIProgram>): Promise<SMSIProgram> => {
  // Check for existing active program
  const existing = await getActiveProgram();
  if (existing) {
    throw new Error('Un programme SMSI est déjà actif. Archivez-le avant d\'en créer un nouveau.');
  }

  return await SMSIProgramService.create({
    ...program,
    status: 'active',
    phases: initializePhases(),
    currentPhase: 'plan',
    progress: 0,
  });
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-18.1]
- [Source: ISO 27003:2017 - ISMS Implementation Guidance]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
