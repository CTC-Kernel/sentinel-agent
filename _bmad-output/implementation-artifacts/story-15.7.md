# Story 15.7: Liaison avec Actifs Existants

Status: ready-for-dev

## Story

As a RSSI,
I want to link EBIOS assets to my existing asset inventory,
so that I maintain data consistency.

## Acceptance Criteria

1. Bouton "Importer depuis inventaire" dans les sections d'actifs
2. Liste des actifs existants affichée avec multi-select
3. Actifs importés gardent leur lien vers l'enregistrement original
4. Les modifications de l'actif original mettent à jour la référence EBIOS
5. Indicateur visuel montrant les actifs liés vs standalone

## Tasks / Subtasks

- [ ] Task 1: Créer le composant ImportFromInventoryModal (AC: 1, 2)
  - [ ] `src/components/ebios/shared/ImportFromInventoryModal.tsx`
  - [ ] Recherche et filtrage des actifs
  - [ ] Multi-select avec checkboxes
  - [ ] Preview des actifs sélectionnés

- [ ] Task 2: Implémenter le mapping Asset → EBIOS (AC: 3)
  - [ ] Fonction `mapAssetToSupportingAsset(asset: Asset)`
  - [ ] Conserver `linkedAssetId` pour traçabilité
  - [ ] Copier les champs pertinents

- [ ] Task 3: Créer le listener de sync (AC: 4)
  - [ ] Cloud Function `onAssetUpdate`
  - [ ] Propager les modifications aux références EBIOS
  - [ ] Gérer les suppressions (soft-delete ou cascade?)

- [ ] Task 4: Ajouter l'indicateur visuel (AC: 5)
  - [ ] Badge "Lié" avec icône link
  - [ ] Badge "Standalone" pour les actifs créés manuellement
  - [ ] Tooltip avec détails de la liaison

- [ ] Task 5: Créer les tests d'intégration
  - [ ] Test sync bidirectionnelle
  - [ ] Test de création avec import
  - [ ] Test de mise à jour propagée

## Dev Notes

### Linking Strategy

```typescript
interface LinkedAssetReference {
  ebiosAssetId: string;
  globalAssetId: string;
  syncedAt: Timestamp;
  syncFields: string[]; // Fields to keep in sync
}

// In SupportingAsset
interface SupportingAsset {
  // ... existing fields
  linkedAssetId?: string;
  isLinked: boolean;
  lastSyncedAt?: Timestamp;
}
```

### Sync Cloud Function

```typescript
// functions/src/triggers/assetSync.ts
export const onAssetUpdate = onDocumentUpdated(
  'tenants/{tenantId}/assets/{assetId}',
  async (event) => {
    // Find all EBIOS analyses referencing this asset
    // Update the corresponding SupportingAsset
  }
);
```

### UI Patterns

- Import modal avec search bar
- Grouped by asset category
- Recent/Frequent assets at top
- Link icon (🔗) for linked assets

### Conflict Resolution

- Global asset is source of truth for synced fields
- EBIOS-specific fields remain local
- Deletion: Show warning, optionally unlink

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-13.7]
- [Source: src/types/asset.ts]
- [Source: src/services/assetService.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
