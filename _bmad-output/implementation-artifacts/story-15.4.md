# Story 15.4: Définition des Événements Redoutés

Status: done

> **Note (2026-01-17):** Brownfield - FearedEventForm.tsx avec gravité, types d'impact et liaisons missions.

## Story

As a RSSI,
I want to define feared events,
so that I identify what I'm protecting against.

## Acceptance Criteria

1. Section "Événements Redoutés" accessible dans l'Atelier 1
2. Ajout d'événements avec: Nom, Description, Type d'impact (C/I/D)
3. Évaluation de la gravité (1-4) pour chaque événement
4. Liaison des événements aux missions
5. Suggestions automatiques basées sur le type de mission
6. Liste des événements avec tri par gravité

## Tasks / Subtasks

- [ ] Task 1: Créer le type FearedEvent (AC: 2, 3)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] ImpactType: 'confidentiality' | 'integrity' | 'availability'
  - [ ] Gravity: 1 | 2 | 3 | 4

- [ ] Task 2: Créer le composant FearedEventsSection (AC: 1, 6)
  - [ ] `src/components/ebios/workshop1/FearedEventsSection.tsx`
  - [ ] Liste triable par gravité
  - [ ] Cards avec badge C/I/D coloré

- [ ] Task 3: Créer le formulaire FearedEventForm (AC: 2, 3, 4)
  - [ ] `src/components/ebios/workshop1/FearedEventForm.tsx`
  - [ ] Multi-select pour type d'impact
  - [ ] Slider gravité avec labels (1=Négligeable, 4=Critique)
  - [ ] Select missions liées

- [ ] Task 4: Implémenter les suggestions (AC: 5)
  - [ ] Créer `ebiosLibrary/fearedEventTemplates` collection
  - [ ] Mapper type de mission → suggestions
  - [ ] Afficher dans un panel latéral

- [ ] Task 5: Créer le service de suggestions
  - [ ] `EbiosSuggestionsService.getFearedEventSuggestions(missionTypes)`
  - [ ] Filtrer par pertinence

## Dev Notes

### Data Structure

```typescript
interface FearedEvent {
  id: string;
  name: string;
  description: string;
  impactTypes: ('confidentiality' | 'integrity' | 'availability')[];
  gravity: 1 | 2 | 3 | 4;
  linkedMissionIds: string[];
  isFromTemplate?: boolean;
  templateId?: string;
  createdAt: Timestamp;
}
```

### Gravity Scale (ANSSI)

| Level | Label | Description |
|-------|-------|-------------|
| 1 | Négligeable | Impact mineur, récupération rapide |
| 2 | Limitée | Impact modéré, récupération possible |
| 3 | Importante | Impact significatif, récupération difficile |
| 4 | Critique | Impact majeur, récupération très difficile |

### Impact Types Colors

- Confidentiality (C): Blue
- Integrity (I): Orange
- Availability (D): Red

### Suggestions Library

Exemples de templates par type de mission:
- Mission financière → Fraude, Vol de données, Indisponibilité SI
- Mission opérationnelle → Arrêt de production, Perte de données
- Mission réglementaire → Non-conformité, Fuite de données personnelles

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-13.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
