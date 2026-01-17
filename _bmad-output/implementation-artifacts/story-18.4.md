# Story 18.4: Calcul du Niveau de Risque

Status: done

> Note: Cette story était déjà implémentée dans Workshop4Content.tsx avec getRiskLevel() et affichage couleur codé

## Story

As a RSSI,
I want to see the calculated risk level,
so that I prioritize risks.

## Acceptance Criteria

1. Calcul automatique: Gravité (stratégique) × Vraisemblance (opérationnel)
2. Affichage avec code couleur dans le scénario
3. Matrice de risque montrant tous les scénarios positionnés
4. Tri des scénarios par niveau de risque
5. Validation: vraisemblance requise pour calcul
6. Indicateur de risque global pour l'analyse

## Tasks / Subtasks

- [ ] Task 1: Implémenter le calcul de risque (AC: 1, 5)
  - [ ] `calculateRiskLevel(gravity, likelihood)`
  - [ ] Validation: both values required
  - [ ] Scale: 1-16 (1×1 to 4×4)

- [ ] Task 2: Créer le composant RiskLevelDisplay (AC: 2)
  - [ ] `src/components/ebios/workshop4/RiskLevelDisplay.tsx`
  - [ ] Affichage numérique + couleur
  - [ ] Labels: Faible, Modéré, Élevé, Critique

- [ ] Task 3: Créer la matrice de risque (AC: 3)
  - [ ] `src/components/ebios/workshop4/RiskMatrix.tsx`
  - [ ] Axes: Gravité (Y) × Vraisemblance (X)
  - [ ] Points représentant les scénarios
  - [ ] Zones colorées (vert→rouge)

- [ ] Task 4: Implémenter le tri par risque (AC: 4)
  - [ ] Sort desc par défaut
  - [ ] Toggle pour ordre
  - [ ] Grouping par zone de risque

- [ ] Task 5: Créer l'indicateur global (AC: 6)
  - [ ] `RiskSummaryWidget.tsx`
  - [ ] Risque max, moyen, distribution
  - [ ] Trend indicator

## Dev Notes

### Risk Calculation

```typescript
const calculateRiskLevel = (gravity: number, likelihood: number): number => {
  return gravity * likelihood; // 1-16
};

const getRiskCategory = (riskLevel: number): RiskCategory => {
  if (riskLevel <= 4) return 'low';
  if (riskLevel <= 8) return 'moderate';
  if (riskLevel <= 12) return 'high';
  return 'critical';
};

type RiskCategory = 'low' | 'moderate' | 'high' | 'critical';

const riskColors: Record<RiskCategory, string> = {
  low: '#22c55e', // green
  moderate: '#eab308', // yellow
  high: '#f97316', // orange
  critical: '#ef4444', // red
};
```

### Risk Matrix Layout

```
     Gravité
  4  │ 4 │ 8 │12 │16 │
  3  │ 3 │ 6 │ 9 │12 │
  2  │ 2 │ 4 │ 6 │ 8 │
  1  │ 1 │ 2 │ 3 │ 4 │
     └───┴───┴───┴───┘
       1   2   3   4   Vraisemblance
```

### Matrix Colors

| Zone | Risk Levels | Color | Label |
|------|-------------|-------|-------|
| Green | 1-4 | #dcfce7 | Risque faible |
| Yellow | 5-8 | #fef9c3 | Risque modéré |
| Orange | 9-12 | #fed7aa | Risque élevé |
| Red | 13-16 | #fecaca | Risque critique |

### Data Structure

```typescript
interface OperationalScenario {
  // ... existing fields
  riskLevel: number; // Calculated: gravity * likelihood
  riskCategory: RiskCategory;
  riskCalculatedAt: Timestamp;
}
```

### Matrix Component

```tsx
const RiskMatrix = ({ scenarios }: { scenarios: OperationalScenario[] }) => {
  const getScenarioPosition = (scenario: OperationalScenario) => {
    const parentStrategic = getStrategicScenario(scenario.strategicScenarioId);
    return {
      x: scenario.likelihood, // 1-4
      y: parentStrategic.gravity, // 1-4
    };
  };

  return (
    <div className="grid grid-cols-4 gap-1">
      {/* Render 16 cells with scenarios positioned */}
    </div>
  );
};
```

### Risk Summary

```typescript
interface RiskSummary {
  totalScenarios: number;
  byCategory: Record<RiskCategory, number>;
  maxRiskLevel: number;
  avgRiskLevel: number;
  criticalCount: number;
}
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-16.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
