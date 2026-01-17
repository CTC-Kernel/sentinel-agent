# Story 19.4: Calcul des Risques Résiduels

Status: ready-for-dev

## Story

As a RSSI,
I want to calculate residual risk after controls,
so that I know my remaining exposure.

## Acceptance Criteria

1. Calcul automatique du risque résiduel basé sur l'efficacité des contrôles
2. Affichage: Risque initial, Couverture des contrôles, Risque résiduel
3. Validation: Risque résiduel ≤ Risque initial
4. Possibilité d'ajuster les estimations d'efficacité
5. Indicateur visuel de la réduction obtenue
6. Alerte si risque résiduel dépasse l'appétit au risque

## Tasks / Subtasks

- [ ] Task 1: Implémenter le calcul de risque résiduel (AC: 1, 3)
  - [ ] `calculateResidualRisk(inherentRisk, controls)`
  - [ ] Formula: Residual = Inherent × (1 - Effectiveness)
  - [ ] Validation: residual ≤ inherent

- [ ] Task 2: Créer le composant RiskReductionDisplay (AC: 2, 5)
  - [ ] `src/components/ebios/workshop5/RiskReductionDisplay.tsx`
  - [ ] Gauge/Bar: Initial → Controls → Residual
  - [ ] Animation de la réduction
  - [ ] Couleurs par zone de risque

- [ ] Task 3: Ajouter l'ajustement d'efficacité (AC: 4)
  - [ ] Slider par contrôle dans le traitement
  - [ ] Recalcul en temps réel
  - [ ] Historique des ajustements

- [ ] Task 4: Intégrer l'appétit au risque (AC: 6)
  - [ ] Récupérer depuis RiskContext.riskAppetite
  - [ ] Comparer résiduel vs appétit
  - [ ] Alert si résiduel > appétit

- [ ] Task 5: Créer le résumé de traitement
  - [ ] Summary card avec tous les indicateurs
  - [ ] Export possible
  - [ ] Validation pour clore le traitement

## Dev Notes

### Residual Risk Calculation

```typescript
interface RiskCalculation {
  inherentRisk: number; // From Workshop 4: gravity × likelihood
  controlEffectiveness: number; // Combined effectiveness 0-100%
  residualRisk: number; // Calculated
  riskReduction: number; // Percentage reduced
}

const calculateResidualRisk = (
  inherentRisk: number,
  controls: SelectedControl[]
): RiskCalculation => {
  // Calculate combined effectiveness
  const controlEffectiveness = calculateOverallEffectiveness(controls);

  // Residual = Inherent × (1 - Effectiveness)
  const residualRisk = inherentRisk * (1 - controlEffectiveness / 100);

  // Ensure residual ≤ inherent
  const validatedResidual = Math.min(residualRisk, inherentRisk);

  return {
    inherentRisk,
    controlEffectiveness,
    residualRisk: Math.round(validatedResidual * 10) / 10,
    riskReduction: Math.round(((inherentRisk - validatedResidual) / inherentRisk) * 100),
  };
};
```

### Risk Appetite Check

```typescript
const checkRiskAppetite = (
  residualRisk: number,
  riskAppetite: RiskAppetite
): RiskAppetiteStatus => {
  if (residualRisk <= riskAppetite.acceptable) {
    return { status: 'acceptable', message: 'Risque dans les limites acceptables' };
  }
  if (residualRisk <= riskAppetite.tolerable) {
    return { status: 'tolerable', message: 'Risque tolérable, surveillance requise' };
  }
  return { status: 'unacceptable', message: 'Risque supérieur à l\'appétit défini' };
};
```

### Risk Reduction Visualization

```tsx
const RiskReductionDisplay = ({ calculation }: { calculation: RiskCalculation }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <RiskGauge value={calculation.inherentRisk} label="Initial" color="red" />
      <ArrowRight />
      <EffectivenessCircle value={calculation.controlEffectiveness} />
      <ArrowRight />
      <RiskGauge value={calculation.residualRisk} label="Résiduel" color="green" />
    </div>

    <div className="text-center">
      <span className="text-2xl font-bold text-green-600">
        -{calculation.riskReduction}%
      </span>
      <span className="text-gray-500 ml-2">de réduction</span>
    </div>

    <RiskAppetiteIndicator residualRisk={calculation.residualRisk} />
  </div>
);
```

### Data Structure Update

```typescript
interface RiskTreatment {
  // ... existing fields
  riskCalculation: {
    inherentRisk: number;
    controlEffectiveness: number;
    residualRisk: number;
    riskReduction: number;
    calculatedAt: Timestamp;
  };
  appetiteStatus: 'acceptable' | 'tolerable' | 'unacceptable';
}
```

### Alert Component

```tsx
const RiskAppetiteAlert = ({ status }: { status: RiskAppetiteStatus }) => {
  const styles = {
    acceptable: 'bg-green-50 border-green-200 text-green-800',
    tolerable: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    unacceptable: 'bg-red-50 border-red-200 text-red-800',
  };

  const icons = {
    acceptable: '✓',
    tolerable: '⚠️',
    unacceptable: '❌',
  };

  return (
    <div className={`p-3 rounded-lg border ${styles[status.status]}`}>
      <span className="mr-2">{icons[status.status]}</span>
      {status.message}
    </div>
  );
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-17.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
