# Story 16.5: Évaluation de la Pertinence SR/OV

Status: done

> **Brownfield (2026-01-17):**
> - Relevance slider (1-4 scale) with GRAVITY_SCALE colors
> - Retained/Not Retained toggle button
> - updatePair() function to save changes
> - Stats display: retainedPairsCount/pairsCount

## Story

As a RSSI,
I want to evaluate the relevance of each SR/OV pair,
so that I focus on realistic threats.

## Acceptance Criteria

1. Click sur un couple ouvre un panel d'évaluation
2. Évaluation de la pertinence sur échelle 1-4
3. Possibilité d'ajouter des notes de justification
4. Marquage "Retenu" ou "Écarté"
5. Seuls les couples retenus passent à l'Atelier 3
6. Indicateur de progression de l'évaluation

## Tasks / Subtasks

- [ ] Task 1: Créer le composant SROVEvaluationPanel (AC: 1, 2, 3, 4)
  - [ ] `src/components/ebios/workshop2/SROVEvaluationPanel.tsx`
  - [ ] Drawer ou Modal latéral
  - [ ] Affichage SR et OV sélectionnés
  - [ ] Slider pertinence 1-4
  - [ ] Textarea justification
  - [ ] Boutons Retenir / Écarter

- [ ] Task 2: Implémenter l'échelle de pertinence (AC: 2)
  - [ ] Labels: 1=Non pertinent, 2=Peu pertinent, 3=Pertinent, 4=Très pertinent
  - [ ] Seuil automatique: ≥3 suggère "Retenir"
  - [ ] Couleurs correspondantes

- [ ] Task 3: Créer le filtre pour Atelier 3 (AC: 5)
  - [ ] `EbiosService.getRetainedPairs(analysisId)`
  - [ ] Filter `retainedForAnalysis: true`
  - [ ] Validation: au moins 1 couple retenu pour continuer

- [ ] Task 4: Créer l'indicateur de progression (AC: 6)
  - [ ] `EvaluationProgress.tsx`
  - [ ] X/Y couples évalués
  - [ ] Breakdown: Retenus, Écartés, En attente

- [ ] Task 5: Implémenter la navigation rapide
  - [ ] Boutons Précédent/Suivant dans le panel
  - [ ] Keyboard shortcuts (←/→)
  - [ ] Auto-scroll dans la matrice

## Dev Notes

### Relevance Scale (ANSSI)

| Level | Label | Description | Action suggérée |
|-------|-------|-------------|-----------------|
| 1 | Non pertinent | Scénario irréaliste | Écarter |
| 2 | Peu pertinent | Scénario peu probable | Écarter |
| 3 | Pertinent | Scénario crédible | Retenir |
| 4 | Très pertinent | Scénario probable | Retenir |

### Evaluation Flow

```typescript
const evaluatePair = async (
  analysisId: string,
  pairId: string,
  evaluation: {
    relevance: 1 | 2 | 3 | 4;
    justification?: string;
    decision: 'retain' | 'exclude';
  }
) => {
  await updateDoc(ref, {
    relevance: evaluation.relevance,
    justification: evaluation.justification,
    status: evaluation.decision === 'retain' ? 'retained' : 'excluded',
    retainedForAnalysis: evaluation.decision === 'retain',
    evaluatedAt: serverTimestamp(),
    evaluatedBy: auth.currentUser?.uid,
  });
};
```

### UI Components

- Drawer avec transition smooth
- SegmentedControl pour pertinence
- Auto-focus sur le slider à l'ouverture
- Keyboard: Enter pour sauvegarder, Esc pour fermer

### Validation Rules

- Justification obligatoire si pertinence ≤2 et "Retenir"
- Warning si pertinence ≥3 et "Écarter"
- Au moins 1 couple retenu pour quitter Atelier 2

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-14.5]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
