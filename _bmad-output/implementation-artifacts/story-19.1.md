# Story 19.1: Définition du Plan de Traitement

Status: ready-for-dev

## Story

As a RSSI,
I want to define a treatment plan for each risk,
so that I address identified risks.

## Acceptance Criteria

1. Accès à l'Atelier 5 avec liste des risques de l'Atelier 4
2. Choix de traitement par risque: Accepter, Réduire, Transférer, Éviter
3. Justification du choix de traitement
4. Assignation d'un responsable et d'une échéance
5. État de traitement visible dans la liste
6. Validation: tous les risques doivent avoir un traitement défini

## Tasks / Subtasks

- [ ] Task 1: Créer le type RiskTreatment (AC: 2, 3, 4)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] TreatmentType: 'accept' | 'mitigate' | 'transfer' | 'avoid'
  - [ ] Champs: justification, responsibleId, deadline

- [ ] Task 2: Créer le composant Workshop5Overview (AC: 1, 5)
  - [ ] `src/components/ebios/workshop5/Workshop5Overview.tsx`
  - [ ] Liste des risques avec status traitement
  - [ ] Filtres par type de traitement
  - [ ] Progress bar: X/Y risques traités

- [ ] Task 3: Créer le formulaire TreatmentPlanForm (AC: 2, 3, 4)
  - [ ] `src/components/ebios/workshop5/TreatmentPlanForm.tsx`
  - [ ] Radio/Select pour type de traitement
  - [ ] Textarea justification
  - [ ] User picker pour responsable
  - [ ] Date picker pour échéance

- [ ] Task 4: Créer les cards de traitement (AC: 5)
  - [ ] Badge coloré par type de traitement
  - [ ] Avatar responsable
  - [ ] Countdown pour deadline

- [ ] Task 5: Implémenter la validation (AC: 6)
  - [ ] Vérifier: tous les risques ont un traitement
  - [ ] Warning pour risques sans traitement
  - [ ] Block progression si incomplet (optionnel)

## Dev Notes

### Data Structure

```typescript
interface RiskTreatment {
  id: string;
  operationalScenarioId: string;
  riskId?: string; // If created in risk registry
  treatmentType: 'accept' | 'mitigate' | 'transfer' | 'avoid';
  justification: string;
  responsibleId: string;
  deadline: Timestamp;
  status: 'planned' | 'in_progress' | 'completed';
  controls?: string[]; // Control IDs for mitigation
  residualRiskLevel?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Workshop5Data {
  treatmentPlan: RiskTreatment[];
  completionStats: {
    total: number;
    treated: number;
    byType: Record<TreatmentType, number>;
  };
}
```

### Treatment Types

| Type | Label FR | Color | Description |
|------|----------|-------|-------------|
| accept | Accepter | Gray | Risque accepté, pas d'action |
| mitigate | Réduire | Blue | Mise en place de contrôles |
| transfer | Transférer | Purple | Assurance, externalisation |
| avoid | Éviter | Orange | Arrêt de l'activité à risque |

### Form Validation

```typescript
const treatmentSchema = z.object({
  treatmentType: z.enum(['accept', 'mitigate', 'transfer', 'avoid']),
  justification: z.string().min(20, 'Justification trop courte'),
  responsibleId: z.string().min(1, 'Responsable requis'),
  deadline: z.date().min(new Date(), 'Date dans le futur requise'),
});
```

### UI Layout

```
┌─────────────────────────────────────────────────┐
│ Atelier 5: Traitement du Risque                 │
│ Progression: ████████░░ 80% (8/10 traités)      │
├─────────────────────────────────────────────────┤
│ [🔴 Critique] SO-001: Phishing ciblé           │
│   Traitement: Réduire │ Resp: J. Dupont        │
│   Deadline: 15/02/2026 │ [Éditer]              │
├─────────────────────────────────────────────────┤
│ [🟠 Élevé] SO-002: Compromission VPN            │
│   ⚠️ Traitement non défini │ [Définir]         │
└─────────────────────────────────────────────────┘
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-17.1]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
