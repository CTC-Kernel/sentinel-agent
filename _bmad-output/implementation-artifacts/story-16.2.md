# Story 16.2: Création de Sources de Risque Custom

Status: done

> **Completed (2026-01-17):**
> - Created CustomRiskSourceForm.tsx with Zod validation
> - Created CustomTargetedObjectiveForm.tsx with Zod validation
> - Added "Add Custom Source/Objective" buttons in Workshop2Content.tsx
> - Integrated form modals with save/delete callbacks
> - Badge "Custom" displayed for non-ANSSI sources

## Story

As a RSSI,
I want to create custom risk sources,
so that I can add threats specific to my context.

## Acceptance Criteria

1. Bouton "Ajouter source personnalisée" visible
2. Formulaire avec: Code, Nom, Catégorie, Description, Motivation
3. Source custom sauvegardée au niveau tenant
4. Source apparaît aux côtés des sources ANSSI
5. Source réutilisable dans les analyses futures
6. Possibilité d'éditer et supprimer les sources custom

## Tasks / Subtasks

- [ ] Task 1: Créer le formulaire CustomRiskSourceForm (AC: 2)
  - [ ] `src/components/ebios/workshop2/CustomRiskSourceForm.tsx`
  - [ ] Champs: code, name, category (select), description, motivation
  - [ ] Champs optionnels: resources, capability (sliders)
  - [ ] Validation Zod

- [ ] Task 2: Implémenter la sauvegarde tenant (AC: 3, 5)
  - [ ] Collection `tenants/{tenantId}/customRiskSources`
  - [ ] Méthode `EbiosService.createCustomRiskSource()`
  - [ ] Marquer `isANSSIStandard: false`

- [ ] Task 3: Fusionner sources ANSSI et custom (AC: 4)
  - [ ] Query combinée ANSSI + tenant custom
  - [ ] Tri par catégorie puis nom
  - [ ] Badge visuel "Custom" pour les sources personnalisées

- [ ] Task 4: Implémenter édition/suppression (AC: 6)
  - [ ] Menu contextuel sur les sources custom
  - [ ] Modal d'édition pré-rempli
  - [ ] Confirmation de suppression
  - [ ] Vérifier si utilisée avant suppression

- [ ] Task 5: Créer les tests
  - [ ] Test création source custom
  - [ ] Test réutilisation cross-analyses
  - [ ] Test suppression avec dépendances

## Dev Notes

### Data Structure

```typescript
// Custom sources stored at tenant level
// Path: tenants/{tenantId}/customRiskSources/{sourceId}

interface CustomRiskSource extends RiskSource {
  isANSSIStandard: false;
  createdBy: string;
  usedInAnalyses: string[]; // Track usage for deletion check
}
```

### Category Options

```typescript
const categoryOptions = [
  { value: 'state', label: 'État / Nation' },
  { value: 'organized_crime', label: 'Crime organisé' },
  { value: 'terrorist', label: 'Terroriste' },
  { value: 'hacktivist', label: 'Hacktiviste' },
  { value: 'insider', label: 'Initié' },
  { value: 'competitor', label: 'Concurrent' },
  { value: 'amateur', label: 'Amateur' },
  { value: 'other', label: 'Autre' },
];
```

### UI Patterns

- Modal ou Drawer pour le formulaire
- Badge "Custom" (purple) vs "ANSSI" (blue)
- Edit/Delete only on hover for custom sources

### Validation Rules

- Code unique au niveau tenant
- Nom obligatoire, min 3 caractères
- Catégorie obligatoire
- Description recommandée (warning si vide)

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-14.2]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
