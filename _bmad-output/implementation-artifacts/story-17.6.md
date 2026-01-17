# Story 17.6: Suggestions de Scénarios par Secteur

Status: ready-for-dev

## Story

As a RSSI,
I want to see scenario suggestions based on my sector,
so that I don't miss common attack patterns.

## Acceptance Criteria

1. Affichage de suggestions lors de la création de scénarios
2. Suggestions basées sur le secteur de l'organisation
3. Chaque suggestion inclut: Nom, Description, Gravité typique
4. Possibilité d'importer une suggestion comme point de départ
5. Suggestions filtrables par pertinence
6. Tracking des suggestions utilisées vs ignorées

## Tasks / Subtasks

- [ ] Task 1: Créer la collection de templates sectoriels (AC: 2, 3)
  - [ ] Document `ebiosLibrary/scenarioTemplates`
  - [ ] Templates par secteur d'activité
  - [ ] Champs: name, description, typicalGravity, sectors[]

- [ ] Task 2: Créer le composant ScenarioSuggestions (AC: 1, 5)
  - [ ] `src/components/ebios/workshop3/ScenarioSuggestions.tsx`
  - [ ] Panel latéral ou section collapsible
  - [ ] Filtres: Par pertinence, Par gravité
  - [ ] Search dans les suggestions

- [ ] Task 3: Créer le composant SuggestionCard (AC: 3, 4)
  - [ ] Affiche nom, description tronquée, gravité badge
  - [ ] Bouton "Utiliser comme base"
  - [ ] Preview au hover

- [ ] Task 4: Implémenter l'import de suggestion (AC: 4)
  - [ ] Pré-remplir le formulaire de création
  - [ ] Permettre la modification avant sauvegarde
  - [ ] Marquer `fromTemplate: true`

- [ ] Task 5: Implémenter le tracking (AC: 6)
  - [ ] `Workshop3Data.suggestions.used[]`
  - [ ] `Workshop3Data.suggestions.dismissed[]`
  - [ ] Analytics pour améliorer les suggestions

## Dev Notes

### Scenario Templates by Sector

```typescript
interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  typicalGravity: 1 | 2 | 3 | 4;
  sectors: string[];
  typicalSRCategories: string[];
  typicalOVCategories: string[];
  createdAt: Timestamp;
}

// Example templates
const templates: ScenarioTemplate[] = [
  {
    id: 'tmpl-001',
    name: 'Exfiltration de données clients',
    description: 'Un attaquant externe accède aux bases clients via un fournisseur compromis...',
    typicalGravity: 4,
    sectors: ['finance', 'retail', 'health'],
    typicalSRCategories: ['organized_crime', 'competitor'],
    typicalOVCategories: ['espionage', 'fraud'],
  },
  {
    id: 'tmpl-002',
    name: 'Ransomware via supply chain',
    description: 'Une mise à jour logicielle compromise déploie un ransomware...',
    typicalGravity: 4,
    sectors: ['all'],
    typicalSRCategories: ['organized_crime'],
    typicalOVCategories: ['extortion'],
  },
];
```

### Suggestion Scoring

```typescript
const scoreSuggestion = (
  template: ScenarioTemplate,
  organizationSector: string,
  selectedSR: RiskSource | null,
  selectedOV: TargetedObjective | null
): number => {
  let score = 0;

  // Sector match
  if (template.sectors.includes(organizationSector) || template.sectors.includes('all')) {
    score += 50;
  }

  // SR category match
  if (selectedSR && template.typicalSRCategories.includes(selectedSR.category)) {
    score += 25;
  }

  // OV category match
  if (selectedOV && template.typicalOVCategories.includes(selectedOV.category)) {
    score += 25;
  }

  return score;
};
```

### UI Components

- Accordion or side panel
- Cards with gradient border based on relevance
- "Pertinence: 95%" badge
- Quick import button

### Future Enhancement (AI)

- AI-generated suggestions based on context
- Learning from user choices
- Dynamic recommendations

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-15.6]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
