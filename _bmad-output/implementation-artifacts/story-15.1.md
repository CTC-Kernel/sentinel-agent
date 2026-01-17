# Story 15.1: Création d'une Analyse EBIOS RM

Status: done

> **Note (2026-01-17):** Cette story était déjà implémentée (brownfield).
> Les types, services, composants et routes EBIOS RM existaient dans le codebase.

## Story

As a RSSI,
I want to create a new EBIOS RM analysis,
so that I can start the risk assessment process following the ANSSI methodology.

## Acceptance Criteria

1. Un bouton "Nouvelle analyse EBIOS RM" est visible dans le module EBIOS
2. Un wizard s'ouvre avec Step 1: Cadrage
3. L'utilisateur peut saisir: Nom, Description, Date de certification cible
4. L'analyse est créée avec le statut "draft"
5. Un indicateur de progression affiche "Atelier 1/5"
6. Les 5 ateliers sont initialisés avec le statut "not_started"
7. Le draft mode (ADR-002) est appliqué avec auto-save

## Tasks / Subtasks

- [ ] Task 1: Créer le type EbiosAnalysis (AC: 3, 4, 6)
  - [ ] Définir l'interface TypeScript dans `src/types/ebios.ts`
  - [ ] Ajouter les champs: id, name, description, targetCertificationDate, status, currentWorkshop
  - [ ] Définir Workshop1Data, Workshop2Data, etc. comme sous-types
  - [ ] Créer le schéma Zod de validation

- [ ] Task 2: Créer le service EbiosService (AC: 4, 6)
  - [ ] Créer `src/services/ebiosService.ts`
  - [ ] Implémenter createAnalysis() avec initialisation des 5 ateliers
  - [ ] Implémenter getAnalysis(), updateAnalysis()
  - [ ] Gérer les règles Firestore pour `tenants/{tenantId}/ebiosAnalyses`

- [ ] Task 3: Créer le composant EbiosWizard (AC: 1, 2, 5)
  - [ ] Créer `src/components/ebios/EbiosWizard.tsx`
  - [ ] Implémenter la navigation multi-steps (5 ateliers)
  - [ ] Créer `EbiosProgressIndicator.tsx` pour "Atelier X/5"
  - [ ] Appliquer le style Apple (glass-panel, rounded corners)

- [ ] Task 4: Créer le formulaire de création (AC: 3, 7)
  - [ ] Créer `src/components/ebios/CreateAnalysisForm.tsx`
  - [ ] Intégrer react-hook-form + Zod validation
  - [ ] Appliquer useDraftMode() et useAutoSave() (ADR-002)
  - [ ] Ajouter les champs avec validation localisée

- [ ] Task 5: Créer la route et navigation (AC: 1)
  - [ ] Ajouter la route `/ebios` dans le router
  - [ ] Créer `src/views/EbiosRM.tsx` comme vue principale
  - [ ] Ajouter l'entrée dans le menu de navigation

## Dev Notes

### Architecture Patterns

- **State Machine**: Chaque analyse suit un état (draft → in_progress → completed)
- **Draft Mode**: Utiliser ADR-002 avec `useDraftMode()` hook
- **Auto-save**: Sauvegarder toutes les 30 secondes via `useAutoSave()`
- **Multi-tenant**: Données sous `tenants/{tenantId}/ebiosAnalyses/{analysisId}`

### Firestore Structure

```typescript
interface EbiosAnalysis {
  id: string;
  name: string;
  description: string;
  targetCertificationDate: Timestamp;
  status: 'draft' | 'in_progress' | 'completed';
  currentWorkshop: 1 | 2 | 3 | 4 | 5;
  workshops: {
    workshop1: { status: WorkshopStatus; data: Workshop1Data };
    workshop2: { status: WorkshopStatus; data: Workshop2Data };
    workshop3: { status: WorkshopStatus; data: Workshop3Data };
    workshop4: { status: WorkshopStatus; data: Workshop4Data };
    workshop5: { status: WorkshopStatus; data: Workshop5Data };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

### UI Components

- Utiliser les composants existants: `FormField`, `Button`, `Card`
- Style Apple: `glass-panel`, `shadow-apple-md`, `rounded-2xl`
- Animation spring pour les transitions

### Testing

- Test unitaire pour EbiosService.createAnalysis()
- Test d'intégration pour le wizard flow
- Vitest avec couverture minimum 70%

### References

- [Source: _bmad-output/planning-artifacts/architecture-ebios-rm-iso27003-2026-01-16.md#ADR-E001]
- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-13.1]
- [Source: CLAUDE.md#Draft/Auto-save-Pattern]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
