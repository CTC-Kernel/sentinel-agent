# Story 16.6: Suggestions de Sources par Secteur

Status: done

## Story

As a RSSI,
I want to receive risk source suggestions based on my sector,
so that I don't miss relevant threats.

## Acceptance Criteria

1. Secteur de l'organisation défini (depuis onboarding ou settings)
2. Sources recommandées mises en avant à l'entrée de l'Atelier 2
3. Label "Recommandé pour votre secteur" sur les sources pertinentes
4. Recommandations basées sur les profils sectoriels ANSSI
5. Possibilité d'accepter ou ignorer les recommandations
6. Historique des recommandations acceptées/ignorées

## Tasks / Subtasks

- [x] Task 1: Créer le mapping secteur → sources (AC: 4)
  - [x] Document `ebiosLibrary/sectorProfiles` - Added SECTOR_PROFILES with 10 sectors
  - [x] Secteurs: finance, health, energy, telecom, defense, retail, public_sector, technology, manufacturing, transport
  - [x] Sources et objectifs recommandés par secteur

- [x] Task 2: Récupérer le secteur de l'organisation (AC: 1)
  - [x] Prop sectorId passée à Workshop2Content depuis EbiosAnalysisDetail
  - [x] Peut venir de organization.industry ou EbiosAnalysis

- [x] Task 3: Créer le composant SectorRecommendations (AC: 2, 3)
  - [x] `src/components/ebios/workshop2/SectorRecommendations.tsx`
  - [x] Banner/section au top de l'Atelier 2 avec gradient indigo/purple
  - [x] Liste des sources/objectifs recommandées avec boutons Ajouter/Ignorer

- [x] Task 4: Implémenter le tracking (AC: 5, 6)
  - [x] Props dismissedSourceCodes et dismissedObjectiveCodes
  - [x] Handlers onDismissSource et onDismissObjective
  - [x] Filtrage des recommandations déjà traitées

- [x] Task 5: Créer l'UI de mise en avant (AC: 3)
  - [x] Badge secteur avec nom localisé (fr/en)
  - [x] Boutons "Ajouter toutes" pour ajout en lot
  - [x] Sparkles icon pour l'aspect recommandation

## Dev Notes

### Sector Profiles (ANSSI)

```typescript
const sectorProfiles: Record<string, string[]> = {
  finance: ['SR-01', 'SR-02', 'SR-06'], // État, Crime organisé, Concurrent
  health: ['SR-01', 'SR-02', 'SR-04'], // État, Crime organisé, Hacktiviste
  energy: ['SR-01', 'SR-03', 'SR-04'], // État, Terroriste, Hacktiviste
  telecom: ['SR-01', 'SR-02'], // État, Crime organisé
  defense: ['SR-01', 'SR-03'], // État, Terroriste
  retail: ['SR-02', 'SR-05', 'SR-07'], // Crime organisé, Initié, Amateur
  public_sector: ['SR-01', 'SR-04', 'SR-08'], // État, Hacktiviste, Vengeur
  tech: ['SR-01', 'SR-02', 'SR-06'], // État, Crime organisé, Concurrent
};
```

### Data Structure

```typescript
interface SectorRecommendation {
  sector: string;
  riskSourceCodes: string[];
  rationale: string;
  lastUpdated: Timestamp;
}

interface RecommendationTracking {
  accepted: string[]; // Source IDs
  dismissed: string[]; // Source IDs
  shownAt: Timestamp;
}
```

### UI Components

- Alert/Banner avec icône secteur
- Pills pour les sources recommandées
- Actions: "Ajouter toutes" / "Ignorer"
- Animation pour les sources ajoutées

### Future Enhancement

- AI-powered suggestions basées sur le contexte
- Suggestions dynamiques selon les événements redoutés définis
- Benchmark avec organisations similaires

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-14.6]
- [Source: src/views/Onboarding.tsx] - Sector selection

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Debug Log References
N/A

### Completion Notes List
- Created SECTOR_PROFILES in ebiosLibrary.ts with 10 industry sectors
- Each sector has recommended risk source codes and objective codes based on ANSSI guidelines
- Created getRecommendedSourcesForSector() and getRecommendedObjectivesForSector() helper functions
- Created SectorRecommendations.tsx component with glass morphism UI
- Integrated component into Workshop2Content.tsx via props
- Support for adding all recommendations at once or one by one
- Support for dismissing recommendations to not show them again
- Bilingual support (fr/en) for sector names

### File List
- src/data/ebiosLibrary.ts (modified - added SECTOR_PROFILES, SectorProfile type, helper functions)
- src/components/ebios/workshop2/SectorRecommendations.tsx (created)
- src/components/ebios/workshops/Workshop2Content.tsx (modified - integrated SectorRecommendations)
