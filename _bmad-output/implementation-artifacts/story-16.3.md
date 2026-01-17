# Story 16.3: Définition des Objectifs Visés

Status: ready-for-dev

## Story

As a RSSI,
I want to define targeted objectives for each risk source,
so that I understand what attackers want.

## Acceptance Criteria

1. Section "Objectifs Visés" accessible dans l'Atelier 2
2. Affichage des objectifs standards ANSSI (espionnage, sabotage, etc.)
3. Possibilité d'ajouter des objectifs custom
4. Liaison des objectifs aux sources de risque
5. Vue matricielle sources vs objectifs
6. Justification optionnelle pour chaque liaison

## Tasks / Subtasks

- [ ] Task 1: Créer la collection objectifs ANSSI (AC: 2)
  - [ ] Document `ebiosLibrary/targetedObjectives`
  - [ ] Importer les objectifs standards
  - [ ] Structure: code, name, description, category

- [ ] Task 2: Créer le type TargetedObjective (AC: 2, 3)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] Catégories: espionage, sabotage, fraud, extortion, ideology

- [ ] Task 3: Créer le composant ObjectivesSection (AC: 1, 5)
  - [ ] `src/components/ebios/workshop2/ObjectivesSection.tsx`
  - [ ] Liste des objectifs disponibles
  - [ ] Matrice de liaison SR → OV

- [ ] Task 4: Créer le composant SRObjectiveMatrix (AC: 4, 5, 6)
  - [ ] `src/components/ebios/workshop2/SRObjectiveMatrix.tsx`
  - [ ] Headers: Sources en lignes, Objectifs en colonnes
  - [ ] Checkboxes pour les liaisons
  - [ ] Click pour ajouter justification

- [ ] Task 5: Implémenter les objectifs custom (AC: 3)
  - [ ] Formulaire d'ajout rapide
  - [ ] Sauvegarde au niveau tenant
  - [ ] Badge "Custom" dans la matrice

## Dev Notes

### ANSSI Standard Objectives

| Code | Name | Category |
|------|------|----------|
| OV-01 | Espionnage industriel | espionage |
| OV-02 | Espionnage politique | espionage |
| OV-03 | Sabotage informatique | sabotage |
| OV-04 | Sabotage physique | sabotage |
| OV-05 | Fraude financière | fraud |
| OV-06 | Extorsion (ransomware) | extortion |
| OV-07 | Atteinte à l'image | ideology |
| OV-08 | Déstabilisation | ideology |

### Data Structure

```typescript
interface TargetedObjective {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'espionage' | 'sabotage' | 'fraud' | 'extortion' | 'ideology' | 'other';
  isANSSIStandard: boolean;
}

interface SRObjectiveLink {
  riskSourceId: string;
  objectiveId: string;
  justification?: string;
  linkedAt: Timestamp;
}

// In Workshop2Data
interface Workshop2Data {
  riskSources: RiskSource[];
  targetedObjectives: TargetedObjective[];
  srObjectiveLinks: SRObjectiveLink[];
  // ...
}
```

### Matrix UI

```
          | OV-01 | OV-02 | OV-03 | OV-04 | ...
----------|-------|-------|-------|-------|----
SR-01     |  ✓    |  ✓    |       |       |
SR-02     |       |       |  ✓    |       |
SR-03     |       |       |  ✓    |  ✓    |
```

### UI Components

- Sticky headers for large matrices
- Cell highlight on hover
- Tooltip pour justification
- Quick-add inline pour objectifs custom

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-14.3]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
