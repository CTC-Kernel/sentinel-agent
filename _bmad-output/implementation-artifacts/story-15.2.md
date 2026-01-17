# Story 15.2: Définition du Périmètre (Missions Essentielles)

Status: done

> **Note (2026-01-17):** Brownfield - MissionForm.tsx, Workshop1Content.tsx avec CRUD complet.

## Story

As a RSSI,
I want to define the scope with essential missions,
so that I establish what my security management covers.

## Acceptance Criteria

1. Section "Missions Essentielles" accessible dans l'Atelier 1
2. Possibilité d'ajouter des missions avec: Nom, Description, Criticité (1-4)
3. Import possible depuis les actifs existants
4. Liste des missions définies visible
5. Auto-save toutes les 30 secondes
6. Possibilité de marquer la section comme complète
7. Validation Zod avec messages localisés

## Tasks / Subtasks

- [ ] Task 1: Créer le type Mission (AC: 2)
  - [ ] Ajouter interface `EssentialMission` dans `src/types/ebios.ts`
  - [ ] Champs: id, name, description, criticality (1-4), linkedAssetIds
  - [ ] Schéma Zod avec validation criticité 1-4

- [ ] Task 2: Créer le composant MissionsSection (AC: 1, 4, 6)
  - [ ] Créer `src/components/ebios/workshop1/MissionsSection.tsx`
  - [ ] Liste des missions avec cards
  - [ ] Bouton "Ajouter mission"
  - [ ] Checkbox "Section complète"

- [ ] Task 3: Créer le formulaire MissionForm (AC: 2, 7)
  - [ ] Créer `src/components/ebios/workshop1/MissionForm.tsx`
  - [ ] Slider ou select pour criticité (1=Mineure, 4=Critique)
  - [ ] react-hook-form + Zod + useLocale()
  - [ ] Modal ou drawer pour l'édition

- [ ] Task 4: Implémenter l'import depuis actifs (AC: 3)
  - [ ] Créer `ImportFromAssetsModal.tsx`
  - [ ] Lister les actifs existants avec multi-select
  - [ ] Mapper Asset → EssentialMission
  - [ ] Préserver le lien `linkedAssetId`

- [ ] Task 5: Intégrer auto-save (AC: 5)
  - [ ] Utiliser useAutoSave() du hook existant
  - [ ] Sauvegarder Workshop1Data.scope.missions[]
  - [ ] Indicateur visuel de sauvegarde

## Dev Notes

### Data Structure

```typescript
interface Workshop1Data {
  scope: {
    missions: EssentialMission[];
    supportingAssets: SupportingAsset[];
    essentialAssets: EssentialAsset[];
  };
  fearedEvents: FearedEvent[];
  securityBaseline: SecurityBaselineItem[];
  sectionStatus: {
    missions: boolean;
    assets: boolean;
    fearedEvents: boolean;
    baseline: boolean;
  };
}

interface EssentialMission {
  id: string;
  name: string;
  description: string;
  criticality: 1 | 2 | 3 | 4;
  linkedAssetIds?: string[];
  createdAt: Timestamp;
}
```

### UI/UX

- Cards avec badge de criticité coloré (vert→rouge)
- Drag & drop pour réordonner (optionnel)
- Empty state avec illustration

### Reuse Existing

- `useAssets()` hook pour l'import
- `FormField`, `Select`, `Textarea` components
- `useAutoSave()` from ADR-002

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-13.2]
- [Source: src/hooks/useAutoSave.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
