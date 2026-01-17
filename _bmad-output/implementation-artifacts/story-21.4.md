# Story 21.4: Critères d'Évaluation des Risques

Status: ready-for-dev

## Story

As a RSSI,
I want to define risk evaluation criteria,
so that assessments are consistent.

## Acceptance Criteria

1. Section "Critères d'Évaluation" dans le module Contexte
2. Personnalisation des définitions d'échelle d'impact
3. Personnalisation des définitions d'échelle de probabilité
4. Critères appliqués à toutes les évaluations de risque
5. Analyses EBIOS utilisent ces critères
6. Preview de la matrice de risque résultante

## Tasks / Subtasks

- [ ] Task 1: Créer le type EvaluationCriteria (AC: 2, 3)
  - [ ] Interface dans `src/types/riskContext.ts`
  - [ ] ImpactScale et ProbabilityScale
  - [ ] Definitions par niveau

- [ ] Task 2: Créer le composant EvaluationCriteriaForm (AC: 1, 2, 3)
  - [ ] `src/components/riskContext/EvaluationCriteriaForm.tsx`
  - [ ] Editors pour chaque niveau d'échelle
  - [ ] Rich text pour descriptions
  - [ ] Exemples par niveau

- [ ] Task 3: Implémenter l'héritage dans EBIOS (AC: 4, 5)
  - [ ] `useEvaluationCriteria()` hook
  - [ ] Override des defaults EBIOS
  - [ ] Affichage des critères dans les évaluations

- [ ] Task 4: Créer la preview de matrice (AC: 6)
  - [ ] `RiskMatrixPreview.tsx`
  - [ ] Matrice avec couleurs configurées
  - [ ] Interactive: hover pour voir les définitions

- [ ] Task 5: Créer les templates par secteur
  - [ ] Critères pré-définis pour Finance, Santé, etc.
  - [ ] Import rapide de template
  - [ ] Personnalisation après import

## Dev Notes

### Data Structure

```typescript
interface EvaluationCriteria {
  id: string;
  impactScale: ImpactScaleDefinition;
  probabilityScale: ProbabilityScaleDefinition;
  riskMatrix: RiskMatrixConfiguration;
  customDimensions?: CustomDimension[];
}

interface ImpactScaleDefinition {
  levels: ImpactLevel[];
  dimensions: ImpactDimension[];
}

interface ImpactLevel {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
  definitions: Record<ImpactDimension, string>;
  financialRange?: { min: number; max: number };
  examples: string[];
}

type ImpactDimension =
  | 'financial'
  | 'operational'
  | 'reputational'
  | 'legal'
  | 'safety';

interface ProbabilityScaleDefinition {
  levels: ProbabilityLevel[];
}

interface ProbabilityLevel {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
  frequency: string; // e.g., "Once per year"
  likelihood: string; // e.g., "Likely to occur"
  examples: string[];
}

interface RiskMatrixConfiguration {
  colors: Record<RiskZone, string>;
  thresholds: {
    low: number; // e.g., 1-4
    medium: number; // e.g., 5-9
    high: number; // e.g., 10-15
    critical: number; // e.g., 16-25
  };
}
```

### Default Impact Scale

```typescript
const defaultImpactScale: ImpactLevel[] = [
  {
    value: 1,
    label: 'Négligeable',
    color: '#22c55e',
    definitions: {
      financial: '< 10 000 €',
      operational: 'Perturbation mineure, récupération < 1h',
      reputational: 'Pas d\'impact externe',
      legal: 'Aucune sanction',
      safety: 'Aucun impact santé/sécurité',
    },
    examples: ['Indisponibilité application interne < 1h'],
  },
  {
    value: 2,
    label: 'Mineure',
    color: '#84cc16',
    definitions: {
      financial: '10 000 € - 100 000 €',
      operational: 'Perturbation modérée, récupération < 1 jour',
      reputational: 'Plaintes isolées',
      legal: 'Mise en demeure',
      safety: 'Blessures légères',
    },
    examples: ['Perte de données non critiques'],
  },
  // ... levels 3, 4, 5
];
```

### Default Probability Scale

```typescript
const defaultProbabilityScale: ProbabilityLevel[] = [
  {
    value: 1,
    label: 'Rare',
    color: '#22c55e',
    frequency: 'Moins d\'une fois tous les 10 ans',
    likelihood: 'Très improbable',
    examples: ['Catastrophe naturelle majeure'],
  },
  {
    value: 2,
    label: 'Peu probable',
    color: '#84cc16',
    frequency: 'Une fois tous les 5-10 ans',
    likelihood: 'Improbable',
    examples: ['Attaque ciblée par groupe étatique'],
  },
  // ... levels 3, 4, 5
];
```

### Matrix Preview Component

```tsx
const RiskMatrixPreview = ({ criteria }: { criteria: EvaluationCriteria }) => {
  const { impactScale, probabilityScale, riskMatrix } = criteria;

  return (
    <div className="grid grid-cols-6 gap-1">
      {/* Header row - Impact levels */}
      <div /> {/* Empty corner */}
      {impactScale.levels.map(level => (
        <div key={level.value} className="text-center text-sm font-medium">
          {level.label}
        </div>
      ))}

      {/* Data rows */}
      {probabilityScale.levels.reverse().map(probLevel => (
        <Fragment key={probLevel.value}>
          <div className="text-sm font-medium">{probLevel.label}</div>
          {impactScale.levels.map(impactLevel => {
            const riskValue = probLevel.value * impactLevel.value;
            const zone = getRiskZone(riskValue, riskMatrix.thresholds);
            return (
              <div
                key={impactLevel.value}
                className="w-12 h-12 rounded flex items-center justify-center"
                style={{ backgroundColor: riskMatrix.colors[zone] }}
              >
                {riskValue}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
};
```

### EBIOS Integration

```typescript
const useEvaluationCriteria = () => {
  const { data: context } = useRiskContext();

  return {
    impactScale: context?.evaluationCriteria?.impactScale || defaultImpactScale,
    probabilityScale: context?.evaluationCriteria?.probabilityScale || defaultProbabilityScale,
    getImpactLabel: (value: number) => /* ... */,
    getProbabilityLabel: (value: number) => /* ... */,
    calculateRiskLevel: (impact: number, probability: number) => /* ... */,
  };
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-19.4]
- [Source: ISO 27005:2022 - Clause 8]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
