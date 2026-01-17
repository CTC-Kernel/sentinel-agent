# Story 16.6: Suggestions de Sources par Secteur

Status: ready-for-dev

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

- [ ] Task 1: Créer le mapping secteur → sources (AC: 4)
  - [ ] Document `ebiosLibrary/sectorProfiles`
  - [ ] Secteurs: finance, health, energy, telecom, defense, retail, etc.
  - [ ] Sources recommandées par secteur

- [ ] Task 2: Récupérer le secteur de l'organisation (AC: 1)
  - [ ] Lire depuis `organization.industry` ou `organization.sector`
  - [ ] Fallback: demander à l'utilisateur
  - [ ] Stocker dans `EbiosAnalysis.organizationSector`

- [ ] Task 3: Créer le composant SectorRecommendations (AC: 2, 3)
  - [ ] `src/components/ebios/workshop2/SectorRecommendations.tsx`
  - [ ] Banner ou section en haut de l'Atelier 2
  - [ ] Liste des sources recommandées avec boutons Ajouter/Ignorer

- [ ] Task 4: Implémenter le tracking (AC: 5, 6)
  - [ ] `Workshop2Data.recommendations.accepted[]`
  - [ ] `Workshop2Data.recommendations.dismissed[]`
  - [ ] Ne plus afficher les recommandations déjà traitées

- [ ] Task 5: Créer l'UI de mise en avant (AC: 3)
  - [ ] Badge "Recommandé" sur les cards de sources
  - [ ] Ordre de tri: Recommandées en premier
  - [ ] Couleur accent pour les recommandées

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

### Debug Log References

### Completion Notes List

### File List
