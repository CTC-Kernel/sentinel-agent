# Story 18.2: Séquences d'Attaque avec MITRE ATT&CK

Status: done

> Note: Cette story était déjà implémentée dans MitreSearchModal.tsx avec recherche MITRE ATT&CK complète (tactiques, techniques, sous-techniques)

## Story

As a RSSI,
I want to define attack sequences using MITRE ATT&CK,
so that I use industry-standard technique references.

## Acceptance Criteria

1. Ajout d'étapes d'attaque séquentielles à un scénario opérationnel
2. Recherche dans le framework MITRE ATT&CK
3. Sélection: Tactique, Technique, Sous-technique (optionnel)
4. Affichage de la référence MITRE (ex: T1566.001)
5. Description custom pour chaque étape
6. Visualisation de la séquence (timeline ou flow)

## Tasks / Subtasks

- [ ] Task 1: Créer le type AttackStep (AC: 3, 4, 5)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] Champs: order, mitreReference, tactic, technique, subtechnique
  - [ ] Description custom

- [ ] Task 2: Réutiliser/étendre MitreService (AC: 2)
  - [ ] Vérifier `src/services/mitreService.ts` existant
  - [ ] Ajouter search functionality si manquant
  - [ ] Cache des données MITRE

- [ ] Task 3: Créer le composant AttackSequenceBuilder (AC: 1, 6)
  - [ ] `src/components/ebios/workshop4/AttackSequenceBuilder.tsx`
  - [ ] Liste ordonnée des étapes
  - [ ] Drag & drop pour réordonner
  - [ ] Timeline ou flow visualization

- [ ] Task 4: Créer le composant MitreSearchModal (AC: 2, 3, 4)
  - [ ] `src/components/ebios/workshop4/MitreSearchModal.tsx`
  - [ ] Search bar avec autocomplete
  - [ ] Filtres par tactique
  - [ ] Affichage hiérarchique: Tactic > Technique > Subtechnique

- [ ] Task 5: Créer le composant AttackStepCard (AC: 4, 5)
  - [ ] Badge MITRE (T1566.001)
  - [ ] Nom de la technique
  - [ ] Description custom
  - [ ] Actions: Edit, Delete, Move

## Dev Notes

### Data Structure

```typescript
interface AttackStep {
  id: string;
  order: number;
  mitreReference?: string; // e.g., "T1566.001"
  tactic?: string; // e.g., "Initial Access"
  technique?: string; // e.g., "Phishing"
  subtechnique?: string; // e.g., "Spearphishing Attachment"
  customDescription: string;
  createdAt: Timestamp;
}

// MITRE data structure (cached/static)
interface MitreTechnique {
  id: string; // T1566
  name: string;
  tactic: string;
  description: string;
  subtechniques?: {
    id: string; // T1566.001
    name: string;
    description: string;
  }[];
}
```

### MITRE Tactics (Kill Chain)

| Order | Tactic | Description |
|-------|--------|-------------|
| 1 | Reconnaissance | Gathering information |
| 2 | Resource Development | Preparing infrastructure |
| 3 | Initial Access | Getting into the network |
| 4 | Execution | Running malicious code |
| 5 | Persistence | Maintaining foothold |
| 6 | Privilege Escalation | Gaining higher access |
| 7 | Defense Evasion | Avoiding detection |
| 8 | Credential Access | Stealing credentials |
| 9 | Discovery | Exploring the environment |
| 10 | Lateral Movement | Moving through network |
| 11 | Collection | Gathering target data |
| 12 | Exfiltration | Stealing data |
| 13 | Impact | Disrupting operations |

### Reuse Existing

- Check for existing `MitreService` in codebase
- Check for MITRE data in Firebase or static files
- Reuse search patterns from risk assessment

### Timeline Visualization

```tsx
const AttackTimeline = ({ steps }: { steps: AttackStep[] }) => (
  <div className="relative">
    {steps.map((step, index) => (
      <div key={step.id} className="flex items-start mb-4">
        <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center">
          {index + 1}
        </div>
        <div className="ml-4 flex-1">
          <div className="text-sm text-gray-500">{step.tactic}</div>
          <div className="font-medium">{step.technique}</div>
          <code className="text-xs bg-gray-100 px-1 rounded">{step.mitreReference}</code>
        </div>
      </div>
    ))}
  </div>
);
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-16.2]
- [Source: attack.mitre.org] - MITRE ATT&CK Framework
- [Source: src/services/mitreService.ts] - Existing service if available

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
