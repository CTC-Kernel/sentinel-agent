# Story 15.5: Évaluation du Socle de Sécurité

Status: done

> **Note (2026-01-17):** Brownfield - SecurityBaselinePanel.tsx avec score de maturité et filtres.

## Story

As a RSSI,
I want to evaluate my current security baseline,
so that I understand my starting maturity level.

## Acceptance Criteria

1. Section "Socle de Sécurité" dans l'Atelier 1
2. Checklist des mesures d'hygiène ANSSI affichée
3. Pour chaque mesure: Implémenté / Partiel / Non implémenté
4. Score de maturité calculé automatiquement
5. Possibilité d'ajouter des notes par mesure
6. Résumé visuel du niveau de maturité

## Tasks / Subtasks

- [ ] Task 1: Créer la collection de mesures ANSSI (AC: 2)
  - [ ] Document `ebiosLibrary/securityHygiene` avec les 42 mesures ANSSI
  - [ ] Structure: id, category, title, description
  - [ ] Catégories: Gouvernance, Protection, Défense, Résilience

- [ ] Task 2: Créer le type SecurityBaselineItem (AC: 3, 5)
  - [ ] Interface avec status: 'implemented' | 'partial' | 'not_implemented'
  - [ ] Champ notes optionnel
  - [ ] Référence à la mesure ANSSI

- [ ] Task 3: Créer le composant SecurityBaselineSection (AC: 1, 6)
  - [ ] `src/components/ebios/workshop1/SecurityBaselineSection.tsx`
  - [ ] Accordéon par catégorie
  - [ ] Progress bar global
  - [ ] Score en pourcentage

- [ ] Task 4: Créer les contrôles d'évaluation (AC: 3, 4)
  - [ ] Radio buttons ou SegmentedControl par mesure
  - [ ] Calcul du score: (implemented*1 + partial*0.5) / total * 100
  - [ ] Mise à jour en temps réel

- [ ] Task 5: Créer le résumé visuel (AC: 6)
  - [ ] Gauge ou progress ring
  - [ ] Breakdown par catégorie
  - [ ] Indicateur de tendance

## Dev Notes

### Data Structure

```typescript
interface SecurityBaselineItem {
  measureId: string; // Ref to ANSSI measure
  status: 'implemented' | 'partial' | 'not_implemented';
  notes?: string;
  assessedAt: Timestamp;
  assessedBy: string;
}

interface ANSSIHygieneMeasure {
  id: string;
  code: string; // e.g., "R1", "R2"
  category: 'governance' | 'protection' | 'defense' | 'resilience';
  title: string;
  description: string;
  priority: 'essential' | 'recommended';
}
```

### ANSSI Hygiene Categories

| Category | Description | Count |
|----------|-------------|-------|
| Gouvernance | Politiques, organisation, sensibilisation | ~10 |
| Protection | Contrôle d'accès, chiffrement, sauvegardes | ~15 |
| Défense | Détection, journalisation, réponse | ~10 |
| Résilience | Continuité, reprise, tests | ~7 |

### Score Calculation

```typescript
const calculateScore = (items: SecurityBaselineItem[]): number => {
  const weights = { implemented: 1, partial: 0.5, not_implemented: 0 };
  const total = items.reduce((sum, item) => sum + weights[item.status], 0);
  return Math.round((total / items.length) * 100);
};
```

### UI Components

- Accordion avec icônes de catégorie
- SegmentedControl pour le status (vert/jaune/rouge)
- AppleHealthGauge réutilisé pour le score global

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-13.5]
- [Source: Guide ANSSI - Hygiène informatique]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
