# Story 18.3: Évaluation de la Vraisemblance

Status: ready-for-dev

## Story

As a RSSI,
I want to assess the likelihood of operational scenarios,
so that I calculate risk levels.

## Acceptance Criteria

1. Évaluation de la vraisemblance sur échelle 1-4 pour chaque scénario opérationnel
2. Prise en compte: Capacité de l'attaquant, Efficacité des défenses
3. Justification de l'évaluation
4. Vraisemblance utilisée pour le calcul du niveau de risque
5. Indicateurs visuels de vraisemblance dans la liste
6. Aide contextuelle expliquant l'échelle

## Tasks / Subtasks

- [ ] Task 1: Ajouter l'évaluation au ScenarioForm (AC: 1, 2, 3)
  - [ ] Section "Évaluation de la vraisemblance"
  - [ ] Slider ou SegmentedControl 1-4
  - [ ] Sub-évaluations: attackerCapability, defenseEffectiveness
  - [ ] Textarea justification

- [ ] Task 2: Créer le composant LikelihoodEvaluator (AC: 2)
  - [ ] `src/components/ebios/workshop4/LikelihoodEvaluator.tsx`
  - [ ] Deux sliders: Capacité attaquant (1-4), Défenses (1-4)
  - [ ] Calcul automatique de la vraisemblance suggérée
  - [ ] Override possible

- [ ] Task 3: Stocker la vraisemblance (AC: 4)
  - [ ] `OperationalScenario.likelihood`
  - [ ] `OperationalScenario.likelihoodJustification`
  - [ ] `OperationalScenario.likelihoodFactors`

- [ ] Task 4: Ajouter les indicateurs visuels (AC: 5)
  - [ ] Badge dans les cards
  - [ ] Couleur: vert (1) → rouge (4)
  - [ ] Icône probability

- [ ] Task 5: Créer l'aide contextuelle (AC: 6)
  - [ ] Tooltip sur le slider
  - [ ] Modal "Comment évaluer?"
  - [ ] Exemples par niveau

## Dev Notes

### Likelihood Scale (ANSSI)

| Level | Label | Description | Indicateurs |
|-------|-------|-------------|-------------|
| 1 | Très peu probable | Attaque très difficile | Défenses excellentes, attaquant peu capable |
| 2 | Peu probable | Attaque difficile | Défenses bonnes, attaquant capable |
| 3 | Probable | Attaque réalisable | Défenses moyennes, attaquant très capable |
| 4 | Très probable | Attaque facile | Défenses faibles, attaquant très capable |

### Likelihood Calculation

```typescript
interface LikelihoodFactors {
  attackerCapability: 1 | 2 | 3 | 4; // Resources, skills, motivation
  defenseEffectiveness: 1 | 2 | 3 | 4; // Controls, detection, response
}

const calculateSuggestedLikelihood = (factors: LikelihoodFactors): number => {
  // Higher attacker capability + lower defense = higher likelihood
  const invertedDefense = 5 - factors.defenseEffectiveness;
  const average = (factors.attackerCapability + invertedDefense) / 2;
  return Math.round(average) as 1 | 2 | 3 | 4;
};
```

### Data Structure

```typescript
interface OperationalScenario {
  // ... existing fields
  likelihood: 1 | 2 | 3 | 4;
  likelihoodJustification: string;
  likelihoodFactors: LikelihoodFactors;
  likelihoodEvaluatedAt: Timestamp;
  likelihoodEvaluatedBy: string;
}
```

### UI Components

```tsx
const LikelihoodEvaluator = () => (
  <div className="space-y-4">
    <div>
      <label>Capacité de l'attaquant</label>
      <Slider min={1} max={4} labels={['Faible', 'Modérée', 'Élevée', 'Très élevée']} />
    </div>
    <div>
      <label>Efficacité des défenses</label>
      <Slider min={1} max={4} labels={['Faible', 'Modérée', 'Bonne', 'Excellente']} />
    </div>
    <div className="p-4 bg-gray-100 rounded-lg">
      <span>Vraisemblance suggérée: </span>
      <LikelihoodBadge level={suggestedLevel} />
    </div>
  </div>
);
```

### Help Content

```markdown
## Comment évaluer la vraisemblance?

### Capacité de l'attaquant
- 1: Amateur, peu de ressources
- 2: Groupe organisé, ressources limitées
- 3: Groupe professionnel, bonnes ressources
- 4: État-nation, ressources illimitées

### Efficacité des défenses
- 1: Pas de contrôles, pas de détection
- 2: Contrôles basiques, détection limitée
- 3: Contrôles avancés, bonne détection
- 4: Défense en profondeur, SOC 24/7
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-16.3]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
