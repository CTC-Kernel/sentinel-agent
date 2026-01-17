# Story 16.1: Sélection des Sources de Risque ANSSI

Status: done

> **Brownfield (2026-01-17):**
> - ANSSI_RISK_SOURCES library with 20 standard sources in src/data/ebiosLibrary.ts
> - Workshop2Content.tsx with risk source selection UI
> - Sources grouped by category (state_sponsored, organized_crime, etc.)
> - Checkbox selection with visual feedback

## Story

As a RSSI,
I want to select risk sources from the ANSSI library,
so that I use standardized threat categories.

## Acceptance Criteria

1. Accès à la section "Sources de Risque" dans l'Atelier 2
2. Affichage de la bibliothèque ANSSI avec 8+ sources standards
3. Chaque source affiche: Code, Nom, Catégorie, Motivation, Ressources
4. Possibilité de sélectionner les sources pertinentes
5. Sources sélectionnées apparaissent dans la liste de l'analyse
6. Filtre et recherche dans la bibliothèque

## Tasks / Subtasks

- [ ] Task 1: Créer la collection bibliothèque ANSSI (AC: 2, 3)
  - [ ] Document `ebiosLibrary/riskSources` dans Firestore
  - [ ] Importer les 8 sources ANSSI standards
  - [ ] Structure: code, name, category, motivation, resources, capability

- [ ] Task 2: Créer le type RiskSource (AC: 3)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] Catégories: state, organized_crime, terrorist, hacktivist, insider, competitor

- [ ] Task 3: Créer le composant RiskSourcesSection (AC: 1, 5)
  - [ ] `src/components/ebios/workshop2/RiskSourcesSection.tsx`
  - [ ] Deux colonnes: Bibliothèque | Sélectionnées
  - [ ] Drag & drop ou boutons add/remove

- [ ] Task 4: Créer le composant RiskSourceLibrary (AC: 2, 6)
  - [ ] `src/components/ebios/workshop2/RiskSourceLibrary.tsx`
  - [ ] Cards pour chaque source
  - [ ] Search bar et filtres par catégorie
  - [ ] Bouton "Ajouter à l'analyse"

- [ ] Task 5: Implémenter la sélection (AC: 4, 5)
  - [ ] Copier la source vers `Workshop2Data.riskSources[]`
  - [ ] Marquer comme `isANSSIStandard: true`
  - [ ] Empêcher les doublons

## Dev Notes

### ANSSI Standard Risk Sources

| Code | Name | Category |
|------|------|----------|
| SR-01 | État étranger | state |
| SR-02 | Crime organisé | organized_crime |
| SR-03 | Terroriste | terrorist |
| SR-04 | Hacktiviste | hacktivist |
| SR-05 | Initié malveillant | insider |
| SR-06 | Concurrent | competitor |
| SR-07 | Amateur | amateur |
| SR-08 | Vengeur | avenger |

### Data Structure

```typescript
interface RiskSource {
  id: string;
  code: string;
  name: string;
  category: RiskSourceCategory;
  description: string;
  motivation: string;
  resources: 'low' | 'medium' | 'high' | 'very_high';
  capability: 'low' | 'medium' | 'high' | 'very_high';
  isANSSIStandard: boolean;
  createdAt: Timestamp;
}

type RiskSourceCategory =
  | 'state'
  | 'organized_crime'
  | 'terrorist'
  | 'hacktivist'
  | 'insider'
  | 'competitor'
  | 'amateur'
  | 'other';
```

### UI Components

- Card avec icône par catégorie
- Badge ressources/capacité (gradient vert→rouge)
- Tooltip avec description complète

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-14.1]
- [Source: Guide ANSSI EBIOS RM - Sources de risque]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
