# Story 16.4: Génération des Couples SR/OV

Status: done

> **Brownfield (2026-01-17):**
> - generatePairs() function in Workshop2Content.tsx
> - Cartesian product of selected sources × objectives
> - Duplicate prevention with existing pair keys
> - Auto-initialization with relevance=2 and retainedForAnalysis=false

## Story

As a RSSI,
I want to generate SR/OV pairs automatically,
so that I can evaluate threat scenarios.

## Acceptance Criteria

1. Bouton "Générer matrice SR/OV" disponible
2. Génération automatique de tous les couples possibles
3. Vue matricielle avec sources en lignes, objectifs en colonnes
4. Chaque cellule affiche le statut: À évaluer, Retenu, Écarté
5. Compteur de couples par statut
6. Possibilité de générer seulement les couples liés (optimization)

## Tasks / Subtasks

- [ ] Task 1: Créer le type SROVPair (AC: 4)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] Status: 'pending' | 'retained' | 'excluded'
  - [ ] Champs d'évaluation pour story suivante

- [ ] Task 2: Implémenter la génération (AC: 1, 2, 6)
  - [ ] `EbiosService.generateSROVPairs(analysisId, options)`
  - [ ] Option: tous les couples ou seulement les liés
  - [ ] Produit cartésien SR × OV
  - [ ] Éviter les doublons

- [ ] Task 3: Créer le composant SROVMatrix (AC: 3, 4)
  - [ ] `src/components/ebios/workshop2/SROVMatrix.tsx`
  - [ ] Table avec headers sticky
  - [ ] Cellules avec badge de statut coloré
  - [ ] Click pour changer statut rapidement

- [ ] Task 4: Créer le composant de statistiques (AC: 5)
  - [ ] Compteur par statut (pills)
  - [ ] Progress vers évaluation complète
  - [ ] Filtre par statut

- [ ] Task 5: Gérer la régénération (AC: 2)
  - [ ] Confirmation si couples existants
  - [ ] Option: Écraser / Fusionner
  - [ ] Préserver les évaluations existantes

## Dev Notes

### Data Structure

```typescript
interface SROVPair {
  id: string;
  riskSourceId: string;
  objectiveId: string;
  status: 'pending' | 'retained' | 'excluded';
  relevance?: 1 | 2 | 3 | 4;
  justification?: string;
  retainedForAnalysis: boolean;
  evaluatedAt?: Timestamp;
  evaluatedBy?: string;
}
```

### Generation Algorithm

```typescript
const generatePairs = (
  sources: RiskSource[],
  objectives: TargetedObjective[],
  linkedOnly: boolean,
  links: SRObjectiveLink[]
): SROVPair[] => {
  if (linkedOnly) {
    return links.map(link => ({
      riskSourceId: link.riskSourceId,
      objectiveId: link.objectiveId,
      status: 'pending',
      retainedForAnalysis: false,
    }));
  }

  // Cartesian product
  return sources.flatMap(source =>
    objectives.map(obj => ({
      riskSourceId: source.id,
      objectiveId: obj.id,
      status: 'pending',
      retainedForAnalysis: false,
    }))
  );
};
```

### Status Colors

| Status | Color | Description |
|--------|-------|-------------|
| pending | Gray | À évaluer |
| retained | Green | Retenu pour l'analyse |
| excluded | Red | Écarté (non pertinent) |

### UI Patterns

- Bulk actions: Tout retenir / Tout écarter
- Keyboard navigation dans la matrice
- Export possible vers Excel

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-14.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
