# Story 18.6: Propositions de Techniques MITRE

Status: ready-for-dev

## Story

As a RSSI,
I want to receive MITRE technique suggestions,
so that I build realistic attack sequences.

## Acceptance Criteria

1. Suggestions de techniques lors de l'ajout d'étapes d'attaque
2. Suggestions basées sur: Étapes précédentes, Type d'actif cible
3. Possibilité d'accepter ou ignorer les suggestions
4. Fallback: recherche manuelle si pas de suggestion pertinente
5. Apprentissage: suggestions améliorées basées sur l'historique
6. Indication de la pertinence pour chaque suggestion

## Tasks / Subtasks

- [ ] Task 1: Créer le service de suggestions MITRE (AC: 2)
  - [ ] `src/services/mitreSuggestionService.ts`
  - [ ] `getSuggestions(previousSteps, targetAssetType)`
  - [ ] Mapping: tactic sequence + asset type → techniques

- [ ] Task 2: Créer le composant TechniqueSuggestions (AC: 1, 3, 6)
  - [ ] `src/components/ebios/workshop4/TechniqueSuggestions.tsx`
  - [ ] Panel latéral ou inline suggestions
  - [ ] Badge de pertinence (High/Medium/Low)
  - [ ] Boutons Accept/Dismiss

- [ ] Task 3: Implémenter la logique de séquence (AC: 2)
  - [ ] Kill chain flow: Reconnaissance → Initial Access → ...
  - [ ] Techniques compatibles avec la tactique courante
  - [ ] Suggestions basées sur la tactique précédente

- [ ] Task 4: Ajouter le fallback recherche (AC: 4)
  - [ ] Toggle "Recherche avancée"
  - [ ] Full search dans le framework MITRE
  - [ ] Combiné avec suggestions

- [ ] Task 5: Implémenter le tracking (AC: 5)
  - [ ] Log: suggestions acceptées, ignorées
  - [ ] Analytics pour améliorer les suggestions
  - [ ] (Future) ML-based ranking

## Dev Notes

### Suggestion Logic

```typescript
interface SuggestionContext {
  previousSteps: AttackStep[];
  targetAssetType: 'information_system' | 'premises' | 'personnel' | 'organization';
  riskSourceCategory: string;
  objectiveCategory: string;
}

const getSuggestions = (context: SuggestionContext): MitreSuggestion[] => {
  const suggestions: MitreSuggestion[] = [];

  // 1. Based on kill chain flow
  const lastTactic = context.previousSteps.slice(-1)[0]?.tactic;
  const nextTactics = getNextTacticsInKillChain(lastTactic);
  suggestions.push(...getTechniquesForTactics(nextTactics));

  // 2. Based on asset type
  suggestions.push(...getTechniquesForAssetType(context.targetAssetType));

  // 3. Based on attacker profile
  suggestions.push(...getTechniquesForAttacker(context.riskSourceCategory));

  // Score and deduplicate
  return rankSuggestions(suggestions);
};
```

### Kill Chain Transitions

```typescript
const killChainFlow: Record<string, string[]> = {
  'reconnaissance': ['resource-development', 'initial-access'],
  'resource-development': ['initial-access'],
  'initial-access': ['execution', 'persistence'],
  'execution': ['persistence', 'privilege-escalation'],
  'persistence': ['privilege-escalation', 'defense-evasion'],
  'privilege-escalation': ['defense-evasion', 'credential-access'],
  'defense-evasion': ['credential-access', 'discovery'],
  'credential-access': ['discovery', 'lateral-movement'],
  'discovery': ['lateral-movement', 'collection'],
  'lateral-movement': ['collection', 'exfiltration'],
  'collection': ['exfiltration', 'impact'],
  'exfiltration': ['impact'],
  'impact': [],
};
```

### Asset Type Mappings

```typescript
const assetTypeTechniques: Record<string, string[]> = {
  information_system: [
    'T1190', // Exploit Public-Facing Application
    'T1133', // External Remote Services
    'T1078', // Valid Accounts
  ],
  personnel: [
    'T1566', // Phishing
    'T1598', // Phishing for Information
    'T1534', // Internal Spearphishing
  ],
  premises: [
    'T1200', // Hardware Additions
    'T1091', // Replication Through Removable Media
  ],
  organization: [
    'T1195', // Supply Chain Compromise
    'T1199', // Trusted Relationship
  ],
};
```

### Suggestion UI

```tsx
const TechniqueSuggestions = ({ suggestions, onAccept, onDismiss }) => (
  <div className="space-y-2">
    <h4 className="font-medium">Techniques suggérées</h4>
    {suggestions.map(suggestion => (
      <div
        key={suggestion.id}
        className="flex items-center justify-between p-2 bg-gray-50 rounded"
      >
        <div>
          <code className="text-xs bg-gray-200 px-1 rounded">
            {suggestion.mitreId}
          </code>
          <span className="ml-2">{suggestion.name}</span>
          <RelevanceBadge level={suggestion.relevance} />
        </div>
        <div className="flex gap-1">
          <Button size="sm" onClick={() => onAccept(suggestion)}>✓</Button>
          <Button size="sm" variant="ghost" onClick={() => onDismiss(suggestion)}>✕</Button>
        </div>
      </div>
    ))}
  </div>
);
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-16.6]
- [Source: attack.mitre.org]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
