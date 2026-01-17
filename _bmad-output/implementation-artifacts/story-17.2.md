# Story 17.2: Définition des Chemins d'Attaque

Status: ready-for-dev

## Story

As a RSSI,
I want to define attack paths through the ecosystem,
so that I understand how threats can reach my assets.

## Acceptance Criteria

1. Création de chemins d'attaque depuis le diagramme
2. Sélection: Partie source, Actif cible, Parties intermédiaires
3. Évaluation: Vraisemblance, Complexité
4. Visualisation des chemins comme flèches sur la carte
5. Couleurs indiquant la vraisemblance (rouge=haute, vert=basse)
6. Liste des chemins avec détails au survol

## Tasks / Subtasks

- [ ] Task 1: Créer le type AttackPath (AC: 2, 3)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] Champs: sourcePartyId, targetAssetId, intermediatePartyIds[]
  - [ ] Évaluations: likelihood, complexity (1-4)

- [ ] Task 2: Créer le mode création de chemin (AC: 1, 2)
  - [ ] Toggle "Mode Chemin d'Attaque" dans EcosystemMap
  - [ ] Click séquentiel pour sélectionner les nœuds
  - [ ] Validation: au moins source et target

- [ ] Task 3: Créer le composant AttackPathForm (AC: 3)
  - [ ] `src/components/ebios/workshop3/AttackPathForm.tsx`
  - [ ] Modal après création du chemin
  - [ ] Sliders likelihood et complexity
  - [ ] Description optionnelle

- [ ] Task 4: Implémenter le rendu des edges (AC: 4, 5)
  - [ ] Custom edge type pour ReactFlow
  - [ ] Animation (dashed, flowing)
  - [ ] Couleur selon likelihood
  - [ ] Épaisseur selon importance

- [ ] Task 5: Créer la liste des chemins (AC: 6)
  - [ ] `AttackPathList.tsx` panel latéral
  - [ ] Highlight du chemin au hover
  - [ ] Click pour éditer/supprimer

## Dev Notes

### Data Structure

```typescript
interface AttackPath {
  id: string;
  name?: string;
  sourcePartyId: string; // Entry point (ecosystem party)
  targetAssetId: string; // Target (supporting/essential asset)
  intermediatePartyIds: string[]; // Ordered list of intermediaries
  likelihood: 1 | 2 | 3 | 4;
  complexity: 1 | 2 | 3 | 4;
  description?: string;
  createdAt: Timestamp;
}
```

### Likelihood Scale

| Level | Color | Label |
|-------|-------|-------|
| 1 | Green | Peu probable |
| 2 | Yellow | Possible |
| 3 | Orange | Probable |
| 4 | Red | Très probable |

### Complexity Scale

| Level | Description |
|-------|-------------|
| 1 | Très complexe (difficile à exploiter) |
| 2 | Complexe |
| 3 | Modérée |
| 4 | Simple (facile à exploiter) |

### ReactFlow Edge Styling

```typescript
const getEdgeStyle = (likelihood: number) => ({
  stroke: likelihoodColors[likelihood],
  strokeWidth: 2 + likelihood, // Thicker = more likely
  strokeDasharray: likelihood >= 3 ? '0' : '5 5', // Solid if likely
  animated: likelihood >= 3,
});

const likelihoodColors = {
  1: '#22c55e', // green-500
  2: '#eab308', // yellow-500
  3: '#f97316', // orange-500
  4: '#ef4444', // red-500
};
```

### Creation Flow

1. User clicks "Créer chemin"
2. Cursor changes to crosshair
3. Click source party → highlighted
4. Click intermediate parties (optional) → added to path
5. Click target asset → path created
6. Modal opens for likelihood/complexity
7. Save and render edge

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-15.2]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
