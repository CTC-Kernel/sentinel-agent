# Story 15.3: Identification des Biens Supports

Status: done

> **Note (2026-01-17):** Brownfield - SupportingAssetForm.tsx, Workshop1Content.tsx avec types et liaisons.

## Story

As a RSSI,
I want to identify supporting assets,
so that I know what systems support my essential missions.

## Acceptance Criteria

1. Section "Biens Supports" accessible après les missions
2. Ajout d'actifs avec: Nom, Type (SI, Local, Personnel, Organisation), Description
3. Liaison many-to-many entre actifs et missions
4. Import depuis l'inventaire d'actifs existant
5. Matrice visuelle des relations actif-mission
6. Distinction entre biens supports et biens essentiels

## Tasks / Subtasks

- [ ] Task 1: Créer les types d'actifs EBIOS (AC: 2, 6)
  - [ ] Interface `SupportingAsset` avec type enum
  - [ ] Interface `EssentialAsset`
  - [ ] Types: 'information_system' | 'premises' | 'personnel' | 'organization'

- [ ] Task 2: Créer le composant AssetsSection (AC: 1, 5)
  - [ ] `src/components/ebios/workshop1/AssetsSection.tsx`
  - [ ] Tabs: Biens Supports / Biens Essentiels
  - [ ] Matrice relationnelle avec checkboxes

- [ ] Task 3: Créer le formulaire AssetForm (AC: 2)
  - [ ] `src/components/ebios/workshop1/AssetForm.tsx`
  - [ ] Select pour type d'actif
  - [ ] Validation Zod

- [ ] Task 4: Créer la liaison actif-mission (AC: 3)
  - [ ] Composant `AssetMissionMatrix.tsx`
  - [ ] Checkboxes pour chaque couple
  - [ ] Sauvegarde des liaisons bidirectionnelles

- [ ] Task 5: Implémenter l'import d'actifs (AC: 4)
  - [ ] Réutiliser `ImportFromAssetsModal.tsx`
  - [ ] Mapper vers SupportingAsset
  - [ ] Conserver `linkedAssetId` pour sync

## Dev Notes

### Data Structure

```typescript
interface SupportingAsset {
  id: string;
  name: string;
  type: 'information_system' | 'premises' | 'personnel' | 'organization';
  description: string;
  linkedMissionIds: string[];
  linkedAssetId?: string; // Ref to global asset
  createdAt: Timestamp;
}

interface EssentialAsset {
  id: string;
  name: string;
  description: string;
  linkedMissionIds: string[];
  createdAt: Timestamp;
}
```

### Asset Types (ANSSI)

| Type | Description |
|------|-------------|
| information_system | Système d'information, applications, données |
| premises | Locaux, bâtiments, zones sécurisées |
| personnel | Personnes, compétences, savoir-faire |
| organization | Processus, procédures, partenaires |

### UI Components

- Matrix table avec headers sticky
- Icons par type d'actif
- Badge count sur les liaisons

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-13.3]
- [Source: src/types/asset.ts] - Types existants à mapper

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
