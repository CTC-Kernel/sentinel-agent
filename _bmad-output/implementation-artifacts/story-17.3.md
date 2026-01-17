# Story 17.3: Construction des Scénarios Stratégiques

Status: ready-for-dev

## Story

As a RSSI,
I want to build strategic scenarios,
so that I describe high-level attack narratives.

## Acceptance Criteria

1. Section "Scénarios Stratégiques" dans l'Atelier 3
2. Création avec liaison: Couple SR/OV, Chemin d'attaque, Événement redouté
3. Rédaction d'une description narrative
4. Liste des scénarios avec tous les éléments liés
5. Validation: au moins un scénario pour passer à l'Atelier 4
6. Numérotation automatique des scénarios

## Tasks / Subtasks

- [ ] Task 1: Créer le type StrategicScenario (AC: 2, 3)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] Liens: srovPairId, attackPathId, fearedEventId
  - [ ] Champs: name, narrative, gravity

- [ ] Task 2: Créer le composant StrategicScenariosSection (AC: 1, 4, 6)
  - [ ] `src/components/ebios/workshop3/StrategicScenariosSection.tsx`
  - [ ] Liste des scénarios avec cards
  - [ ] Numérotation: SS-001, SS-002, etc.
  - [ ] Empty state encourageant la création

- [ ] Task 3: Créer le formulaire StrategicScenarioForm (AC: 2, 3)
  - [ ] `src/components/ebios/workshop3/StrategicScenarioForm.tsx`
  - [ ] Select pour couple SR/OV (depuis Atelier 2, retenus seulement)
  - [ ] Select pour chemin d'attaque
  - [ ] Select pour événement redouté (depuis Atelier 1)
  - [ ] Textarea pour narrative

- [ ] Task 4: Créer le composant ScenarioCard (AC: 4)
  - [ ] Affiche: Numéro, Nom, SR→OV, Chemin, Événement
  - [ ] Expand pour voir la narrative complète
  - [ ] Actions: Éditer, Dupliquer, Supprimer

- [ ] Task 5: Implémenter la validation (AC: 5)
  - [ ] Vérifier ≥1 scénario pour passer à Atelier 4
  - [ ] Warning si pas de scénarios
  - [ ] Navigation conditionnelle

## Dev Notes

### Data Structure

```typescript
interface StrategicScenario {
  id: string;
  code: string; // Auto-generated: SS-001, SS-002
  name: string;
  srovPairId: string; // Link to retained SR/OV pair
  attackPathId?: string; // Optional link to attack path
  fearedEventId: string; // Link to feared event
  narrative: string; // Free text description
  gravity?: 1 | 2 | 3 | 4; // Evaluated in Story 17.4
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Scenario Code Generation

```typescript
const generateScenarioCode = (existingScenarios: StrategicScenario[]): string => {
  const nextNumber = existingScenarios.length + 1;
  return `SS-${String(nextNumber).padStart(3, '0')}`;
};
```

### Form Dependencies

```
Couple SR/OV ← From Workshop2Data.srovPairs (where retainedForAnalysis: true)
Chemin d'attaque ← From Workshop3Data.attackPaths
Événement redouté ← From Workshop1Data.fearedEvents
```

### Narrative Prompts

Suggestions pour aider la rédaction:
- "Décrivez comment [SR] pourrait atteindre [OV] en passant par [chemin]..."
- "Quelles seraient les conséquences sur [événement redouté]..."
- Template: "Un(e) [SR] cherchant à [OV] pourrait exploiter [chemin] pour provoquer [événement]."

### UI Components

- Card avec header coloré selon SR category
- Chips pour SR, OV, Chemin, Événement
- Collapsible narrative section
- Quick actions on hover

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-15.3]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
