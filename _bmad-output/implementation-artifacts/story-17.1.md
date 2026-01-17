# Story 17.1: Cartographie de l'Écosystème

Status: ready-for-dev

## Story

As a RSSI,
I want to map my organization's ecosystem,
so that I identify potential attack vectors.

## Acceptance Criteria

1. Section "Cartographie Écosystème" accessible dans l'Atelier 3
2. Ajout de parties prenantes avec: Nom, Type, Catégorie
3. Évaluation par partie: Niveau de confiance, Exposition, Cyber-dépendance
4. Affichage sur un diagramme interactif
5. Drag & drop pour organiser la vue
6. Sauvegarde automatique des positions

## Tasks / Subtasks

- [ ] Task 1: Créer le type EcosystemParty (AC: 2, 3)
  - [ ] Interface dans `src/types/ebios.ts`
  - [ ] Types: supplier, partner, customer, regulator, service_provider
  - [ ] Évaluations: trustLevel, exposure, cyberDependency (1-4)

- [ ] Task 2: Créer le composant EcosystemSection (AC: 1)
  - [ ] `src/components/ebios/workshop3/EcosystemSection.tsx`
  - [ ] Split view: Liste gauche, Diagramme droite
  - [ ] Tabs ou toggle pour vue liste/diagramme

- [ ] Task 3: Créer le composant EcosystemMap (AC: 4, 5, 6)
  - [ ] `src/components/ebios/workshop3/EcosystemMap.tsx`
  - [ ] Utiliser ReactFlow pour le diagramme
  - [ ] Nœuds custom par type de partie
  - [ ] Sauvegarder positions dans Firestore

- [ ] Task 4: Créer le formulaire EcosystemPartyForm (AC: 2, 3)
  - [ ] `src/components/ebios/workshop3/EcosystemPartyForm.tsx`
  - [ ] Select pour type et catégorie
  - [ ] Sliders pour les 3 évaluations
  - [ ] Préview des couleurs selon risque

- [ ] Task 5: Implémenter la persistence des positions (AC: 6)
  - [ ] `Workshop3Data.ecosystemLayout`
  - [ ] Debounce sur drag end
  - [ ] Restore positions au chargement

## Dev Notes

### Data Structure

```typescript
interface EcosystemParty {
  id: string;
  name: string;
  type: 'supplier' | 'partner' | 'customer' | 'regulator' | 'service_provider' | 'other';
  category: string; // Free text for sub-categorization
  description?: string;
  trustLevel: 1 | 2 | 3 | 4; // 1=Low trust, 4=High trust
  exposure: 1 | 2 | 3 | 4; // 1=Low exposure, 4=High exposure
  cyberDependency: 1 | 2 | 3 | 4; // 1=Low dependency, 4=High dependency
  riskScore?: number; // Calculated: (4 - trustLevel + exposure + cyberDependency) / 3
  position?: { x: number; y: number }; // For ReactFlow
  createdAt: Timestamp;
}

interface Workshop3Data {
  ecosystem: EcosystemParty[];
  ecosystemLayout: {
    zoom: number;
    position: { x: number; y: number };
    lastUpdated: Timestamp;
  };
  attackPaths: AttackPath[];
  strategicScenarios: StrategicScenario[];
}
```

### Party Types & Icons

| Type | Icon | Color |
|------|------|-------|
| supplier | 📦 | Blue |
| partner | 🤝 | Green |
| customer | 👤 | Purple |
| regulator | ⚖️ | Orange |
| service_provider | 🔧 | Teal |
| other | ❓ | Gray |

### ReactFlow Setup

```typescript
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';

const nodeTypes = {
  ecosystemParty: EcosystemPartyNode,
};
```

### Risk Score Calculation

```typescript
const calculateRiskScore = (party: EcosystemParty): number => {
  // Higher trust = lower risk, Higher exposure/dependency = higher risk
  const trustFactor = 4 - party.trustLevel; // Invert: 1→3, 4→0
  const score = (trustFactor + party.exposure + party.cyberDependency) / 3;
  return Math.round(score * 25); // Scale to 0-100
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-15.1]
- [Source: reactflow.dev] - ReactFlow documentation

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
