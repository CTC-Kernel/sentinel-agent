# Story 18.1: Déclinaison en Modes Opératoires

Status: done

> Note: Cette story était déjà implémentée dans Workshop4Content.tsx et OperationalScenarioForm.tsx

## Story

As a RSSI,
I want to break down strategic scenarios into operational modes,
so that I understand how attacks would actually happen.

## Acceptance Criteria

1. Accès à l'Atelier 4 avec liste des scénarios stratégiques de l'Atelier 3
2. Création d'un ou plusieurs scénarios opérationnels par scénario stratégique
3. Chaque scénario opérationnel a: Nom, Description, Scénario stratégique parent
4. Numérotation automatique: SO-001, SO-002, etc.
5. Navigation facile entre scénarios stratégiques et opérationnels
6. Indicateur de couverture: % de scénarios stratégiques déclinés

## Tasks / Subtasks

- [ ] Task 1: Créer le type OperationalScenario (AC: 3)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] Lien: strategicScenarioId
  - [ ] Champs: code, name, description, attackSteps[]

- [ ] Task 2: Créer le composant Workshop4Overview (AC: 1, 5)
  - [ ] `src/components/ebios/workshop4/Workshop4Overview.tsx`
  - [ ] Liste des scénarios stratégiques avec expand
  - [ ] Sous-liste des scénarios opérationnels par stratégique
  - [ ] Tree view ou accordion

- [ ] Task 3: Créer le formulaire OperationalScenarioForm (AC: 2, 3, 4)
  - [ ] `src/components/ebios/workshop4/OperationalScenarioForm.tsx`
  - [ ] Select pour scénario stratégique parent
  - [ ] Auto-génération du code SO-XXX
  - [ ] Pre-fill name basé sur le parent

- [ ] Task 4: Créer le composant CoverageIndicator (AC: 6)
  - [ ] `src/components/ebios/workshop4/CoverageIndicator.tsx`
  - [ ] Progress bar: X/Y scénarios déclinés
  - [ ] Badge par scénario stratégique (0, 1, 2+ opérationnels)

- [ ] Task 5: Implémenter la navigation (AC: 5)
  - [ ] Breadcrumb: Atelier 4 > SS-001 > SO-001
  - [ ] Back button vers parent
  - [ ] Quick switch entre opérationnels du même parent

## Dev Notes

### Data Structure

```typescript
interface OperationalScenario {
  id: string;
  code: string; // Auto: SO-001, SO-002
  name: string;
  description: string;
  strategicScenarioId: string; // Parent link
  attackSteps: AttackStep[]; // Defined in Story 18.2
  likelihood?: 1 | 2 | 3 | 4; // Evaluated in Story 18.3
  riskLevel?: number; // Calculated in Story 18.4
  linkedRiskId?: string; // Created in Story 18.5
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Workshop4Data {
  operationalScenarios: OperationalScenario[];
  coverageStats: {
    totalStrategic: number;
    coveredStrategic: number;
    totalOperational: number;
  };
}
```

### Code Generation

```typescript
const generateOperationalCode = (
  existingScenarios: OperationalScenario[]
): string => {
  const nextNumber = existingScenarios.length + 1;
  return `SO-${String(nextNumber).padStart(3, '0')}`;
};
```

### Coverage Calculation

```typescript
const calculateCoverage = (
  strategicScenarios: StrategicScenario[],
  operationalScenarios: OperationalScenario[]
): CoverageStats => {
  const strategicWithOperational = new Set(
    operationalScenarios.map(op => op.strategicScenarioId)
  );

  return {
    totalStrategic: strategicScenarios.length,
    coveredStrategic: strategicWithOperational.size,
    totalOperational: operationalScenarios.length,
    coveragePercent: Math.round(
      (strategicWithOperational.size / strategicScenarios.length) * 100
    ),
  };
};
```

### UI Layout

```
┌─────────────────────────────────────────┐
│ Atelier 4: Scénarios Opérationnels      │
│ Couverture: ████████░░ 80% (4/5)        │
├─────────────────────────────────────────┤
│ ▼ SS-001: Espionnage via fournisseur    │
│   ├─ SO-001: Phishing ciblé            │
│   ├─ SO-002: Compromission VPN          │
│   └─ [+ Ajouter opérationnel]           │
│ ▶ SS-002: Ransomware supply chain       │
│ ▶ SS-003: Sabotage interne              │
│   ⚠️ Aucun scénario opérationnel        │
└─────────────────────────────────────────┘
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-16.1]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
