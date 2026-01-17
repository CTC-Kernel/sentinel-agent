# Story 19.2: Sélection des Mesures ISO 27002

Status: ready-for-dev

## Story

As a RSSI,
I want to select ISO 27002 controls for mitigation,
so that I implement standard security measures.

## Acceptance Criteria

1. Accès au catalogue ISO 27002 (93 contrôles) pour les traitements "Réduire"
2. Recherche et filtrage des contrôles
3. Sélection de contrôles pertinents pour le risque
4. Affichage de l'efficacité attendue par contrôle
5. Contrôles sélectionnés liés au traitement
6. Visualisation de la couverture du risque

## Tasks / Subtasks

- [ ] Task 1: Vérifier la collection controls existante (AC: 1)
  - [ ] Confirmer présence des 93 contrôles ISO 27002:2022
  - [ ] Structure: id, code, name, category, description
  - [ ] Ajouter si manquant

- [ ] Task 2: Créer le composant ControlSelector (AC: 2, 3)
  - [ ] `src/components/ebios/workshop5/ControlSelector.tsx`
  - [ ] Search bar avec autocomplete
  - [ ] Filtres par catégorie (4 domaines)
  - [ ] Multi-select avec chips

- [ ] Task 3: Ajouter l'efficacité attendue (AC: 4)
  - [ ] Champ effectiveness (0-100%) par contrôle
  - [ ] Valeurs par défaut basées sur le type de contrôle
  - [ ] Override possible par l'utilisateur

- [ ] Task 4: Implémenter la liaison (AC: 5)
  - [ ] `RiskTreatment.controls[]` avec controlId et effectiveness
  - [ ] Affichage dans le formulaire de traitement
  - [ ] Liste des contrôles sélectionnés

- [ ] Task 5: Créer la visualisation de couverture (AC: 6)
  - [ ] `CoverageVisualization.tsx`
  - [ ] Gauge ou bar montrant la réduction attendue
  - [ ] Breakdown par contrôle

## Dev Notes

### ISO 27002:2022 Categories

| # | Category | Controls Count |
|---|----------|----------------|
| 5 | Organizational controls | 37 |
| 6 | People controls | 8 |
| 7 | Physical controls | 14 |
| 8 | Technological controls | 34 |
| **Total** | | **93** |

### Data Structure

```typescript
interface SelectedControl {
  controlId: string;
  controlCode: string; // e.g., "5.1"
  controlName: string;
  expectedEffectiveness: number; // 0-100
  implementationStatus?: 'not_started' | 'in_progress' | 'implemented';
  notes?: string;
}

interface RiskTreatment {
  // ... existing fields
  controls: SelectedControl[];
  overallEffectiveness: number; // Calculated
}
```

### Default Effectiveness by Control Type

```typescript
const defaultEffectiveness: Record<string, number> = {
  preventive: 70, // Controls that prevent threats
  detective: 50, // Controls that detect incidents
  corrective: 60, // Controls that recover from incidents
  deterrent: 40, // Controls that discourage attacks
};
```

### Control Selector UI

```tsx
const ControlSelector = () => (
  <div className="space-y-4">
    <SearchInput placeholder="Rechercher un contrôle..." />
    <CategoryFilter categories={['organizational', 'people', 'physical', 'technological']} />
    <ControlList>
      {controls.map(control => (
        <ControlCard
          key={control.id}
          control={control}
          onSelect={handleSelect}
          effectiveness={getDefaultEffectiveness(control)}
        />
      ))}
    </ControlList>
    <SelectedControls controls={selectedControls} onRemove={handleRemove} />
  </div>
);
```

### Coverage Calculation

```typescript
const calculateOverallEffectiveness = (controls: SelectedControl[]): number => {
  if (controls.length === 0) return 0;

  // Cumulative effectiveness (not additive)
  // E_total = 1 - ∏(1 - E_i)
  const residualRisk = controls.reduce(
    (acc, control) => acc * (1 - control.expectedEffectiveness / 100),
    1
  );

  return Math.round((1 - residualRisk) * 100);
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-17.2]
- [Source: src/types/control.ts]
- [Source: ISO 27002:2022]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
