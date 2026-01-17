# Story 19.3: Mapping Automatique Risques → Contrôles

Status: ready-for-dev

## Story

As a RSSI,
I want automatic control suggestions based on risk type,
so that I don't miss relevant controls.

## Acceptance Criteria

1. Suggestions de contrôles lors du traitement d'un risque
2. Suggestions basées sur: Catégorie de risque, Techniques MITRE utilisées
3. Score de pertinence pour chaque suggestion
4. Possibilité d'accepter ou ignorer les suggestions
5. Affichage des meilleures pratiques sectorielles (optionnel)
6. Apprentissage basé sur les choix précédents (future)

## Tasks / Subtasks

- [ ] Task 1: Créer le mapping MITRE → ISO 27002 (AC: 2)
  - [ ] Document `ebiosLibrary/mitreToControlMapping`
  - [ ] Mapping: technique MITRE → contrôles recommandés
  - [ ] Score de pertinence par mapping

- [ ] Task 2: Créer le service de suggestions (AC: 1, 3)
  - [ ] `src/services/controlSuggestionService.ts`
  - [ ] `getSuggestions(operationalScenario)`
  - [ ] Ranking par score de pertinence

- [ ] Task 3: Créer le composant ControlSuggestions (AC: 1, 4)
  - [ ] `src/components/ebios/workshop5/ControlSuggestions.tsx`
  - [ ] Panel de suggestions avec scores
  - [ ] Boutons Accept/Dismiss
  - [ ] Quick-add au traitement

- [ ] Task 4: Créer le composant RelevanceScore (AC: 3)
  - [ ] Badge avec pourcentage
  - [ ] Couleur: vert (>70%), jaune (50-70%), gris (<50%)
  - [ ] Tooltip avec explication

- [ ] Task 5: Implémenter les best practices (AC: 5)
  - [ ] Section "Recommandations sectorielles"
  - [ ] Basé sur organization.industry
  - [ ] Contrôles fréquemment utilisés dans le secteur

## Dev Notes

### MITRE to ISO 27002 Mapping

```typescript
interface MitreControlMapping {
  mitreId: string;
  mitreName: string;
  recommendedControls: {
    controlId: string;
    controlCode: string;
    relevanceScore: number; // 0-100
    rationale: string;
  }[];
}

// Example mappings
const mappings: MitreControlMapping[] = [
  {
    mitreId: 'T1566',
    mitreName: 'Phishing',
    recommendedControls: [
      { controlId: 'c-6.3', controlCode: '6.3', relevanceScore: 95, rationale: 'Sensibilisation au phishing' },
      { controlId: 'c-8.7', controlCode: '8.7', relevanceScore: 85, rationale: 'Protection contre les malwares' },
      { controlId: 'c-8.23', controlCode: '8.23', relevanceScore: 80, rationale: 'Filtrage web' },
    ],
  },
  {
    mitreId: 'T1078',
    mitreName: 'Valid Accounts',
    recommendedControls: [
      { controlId: 'c-5.16', controlCode: '5.16', relevanceScore: 90, rationale: 'Gestion des identités' },
      { controlId: 'c-8.5', controlCode: '8.5', relevanceScore: 85, rationale: 'Authentification sécurisée' },
      { controlId: 'c-5.18', controlCode: '5.18', relevanceScore: 80, rationale: 'Gestion des droits d\'accès' },
    ],
  },
];
```

### Suggestion Algorithm

```typescript
const getSuggestions = async (
  scenario: OperationalScenario
): Promise<ControlSuggestion[]> => {
  const suggestions = new Map<string, ControlSuggestion>();

  // 1. Based on MITRE techniques
  for (const step of scenario.attackSteps) {
    if (step.mitreReference) {
      const mapping = await getMitreMapping(step.mitreReference);
      for (const control of mapping.recommendedControls) {
        const existing = suggestions.get(control.controlId);
        if (!existing || control.relevanceScore > existing.relevanceScore) {
          suggestions.set(control.controlId, {
            ...control,
            source: 'mitre',
          });
        }
      }
    }
  }

  // 2. Based on risk category
  const categorySuggestions = getCategoryControls(scenario.riskCategory);
  for (const control of categorySuggestions) {
    if (!suggestions.has(control.controlId)) {
      suggestions.set(control.controlId, {
        ...control,
        source: 'category',
      });
    }
  }

  // 3. Sort by relevance
  return Array.from(suggestions.values())
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
};
```

### Suggestion UI

```tsx
const ControlSuggestions = ({ scenario, onAccept }) => {
  const { data: suggestions } = useControlSuggestions(scenario);

  return (
    <div className="space-y-2">
      <h4 className="font-medium flex items-center">
        <span className="mr-2">💡</span>
        Contrôles suggérés
      </h4>
      {suggestions.map(suggestion => (
        <SuggestionCard
          key={suggestion.controlId}
          suggestion={suggestion}
          onAccept={() => onAccept(suggestion)}
        />
      ))}
    </div>
  );
};

const SuggestionCard = ({ suggestion, onAccept }) => (
  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
    <div>
      <code className="text-xs bg-blue-100 px-1 rounded">{suggestion.controlCode}</code>
      <span className="ml-2 font-medium">{suggestion.controlName}</span>
      <RelevanceScore score={suggestion.relevanceScore} />
    </div>
    <Button size="sm" onClick={onAccept}>Ajouter</Button>
  </div>
);
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-17.3]
- [Source: ADR-005 Multi-Framework Mapping]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
