# Story 17.4: Évaluation de la Gravité

Status: done

## Story

As a RSSI,
I want to assess the gravity of strategic scenarios,
so that I prioritize the most impactful threats.

## Acceptance Criteria

1. Évaluation de la gravité sur échelle 1-4 pour chaque scénario
2. Justification obligatoire pour les niveaux 3 et 4
3. Tri des scénarios par gravité dans la liste
4. Mise en évidence visuelle des scénarios à haute gravité
5. Gravité héritée de l'événement redouté si non évaluée
6. Export possible de la liste priorisée

## Tasks / Subtasks

- [ ] Task 1: Ajouter l'évaluation de gravité au ScenarioForm (AC: 1, 2)
  - [ ] Section "Évaluation de la gravité"
  - [ ] SegmentedControl ou RadioGroup 1-4
  - [ ] Textarea justification (required si ≥3)

- [ ] Task 2: Implémenter l'héritage de gravité (AC: 5)
  - [ ] Suggestion basée sur fearedEvent.gravity
  - [ ] "Reprendre gravité de l'événement redouté?"
  - [ ] Override possible

- [ ] Task 3: Créer le tri par gravité (AC: 3)
  - [ ] Sort desc par défaut
  - [ ] Toggle pour changer l'ordre
  - [ ] Grouping optionnel par niveau

- [ ] Task 4: Ajouter les indicateurs visuels (AC: 4)
  - [ ] Badge gravité avec couleur
  - [ ] Border rouge pour gravité 4
  - [ ] Icône warning pour gravité ≥3
  - [ ] Animation pulse pour gravité 4

- [ ] Task 5: Implémenter l'export (AC: 6)
  - [ ] Bouton "Exporter liste"
  - [ ] Format CSV ou Excel
  - [ ] Colonnes: Code, Nom, SR, OV, Gravité, Justification

## Dev Notes

### Gravity Scale (ANSSI)

| Level | Label | Color | Description |
|-------|-------|-------|-------------|
| 1 | Négligeable | Gray | Impact mineur |
| 2 | Limitée | Blue | Impact modéré |
| 3 | Importante | Orange | Impact significatif |
| 4 | Critique | Red | Impact majeur |

### Gravity Inheritance Logic

```typescript
const getSuggestedGravity = (
  scenario: StrategicScenario,
  fearedEvents: FearedEvent[]
): number | null => {
  const linkedEvent = fearedEvents.find(e => e.id === scenario.fearedEventId);
  return linkedEvent?.gravity ?? null;
};

// In form
const handleInheritGravity = () => {
  const suggested = getSuggestedGravity(scenario, fearedEvents);
  if (suggested) {
    setValue('gravity', suggested);
    setValue('gravityJustification', `Héritée de l'événement redouté "${linkedEvent.name}"`);
  }
};
```

### Visual Indicators

```tsx
const GravityBadge = ({ level }: { level: 1 | 2 | 3 | 4 }) => {
  const styles = {
    1: 'bg-gray-100 text-gray-700',
    2: 'bg-blue-100 text-blue-700',
    3: 'bg-orange-100 text-orange-700 border-orange-300',
    4: 'bg-red-100 text-red-700 border-red-500 animate-pulse',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-sm font-medium ${styles[level]}`}>
      G{level}
    </span>
  );
};
```

### Export Format

| Code | Nom | Source de Risque | Objectif Visé | Gravité | Justification |
|------|-----|------------------|---------------|---------|---------------|
| SS-001 | ... | État étranger | Espionnage | 4 | Impact sur données stratégiques |

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-15.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
