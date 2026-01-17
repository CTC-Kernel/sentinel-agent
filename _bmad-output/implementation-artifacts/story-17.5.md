# Story 17.5: Visualisation Graphique de l'Écosystème

Status: done

## Story

As a RSSI,
I want to see an interactive ecosystem visualization,
so that I can explore attack paths visually.

## Acceptance Criteria

1. Toutes les parties prenantes affichées comme nœuds avec icônes par type
2. Chemins d'attaque affichés comme edges animés
3. Zoom, pan et filtrage disponibles
4. Click sur un nœud affiche les détails de la partie
5. Click sur un edge affiche les détails du chemin
6. Légende interactive expliquant les couleurs et symboles

## Tasks / Subtasks

- [x] Task 1: Améliorer EcosystemMap avec toutes les fonctionnalités (AC: 1, 2)
  - [x] Custom nodes avec icônes et labels
  - [x] Edge styling selon likelihood
  - [x] Animated edges pour chemins haute vraisemblance

- [x] Task 2: Implémenter les contrôles de vue (AC: 3)
  - [x] Zoom buttons (+/-)
  - [x] Fit to view button
  - [x] Pan avec drag
  - [x] Filtres par type de partie

- [x] Task 3: Créer le panel de détails nœud (AC: 4)
  - [x] Panel de détails intégré dans EcosystemMap
  - [x] Affiche toutes les infos de la partie (trust, exposure, dependency, penetration)
  - [x] Click sur nœud ouvre le formulaire d'édition
  - [x] Actions: Éditer via callback onPartyClick

- [x] Task 4: Créer le panel de détails edge (AC: 5)
  - [x] Panel de détails intégré dans EcosystemMap
  - [x] Affiche likelihood, complexity
  - [x] Click sur edge pour sélection et détails
  - [x] Animation highlight du chemin (path sélectionné)

- [x] Task 5: Créer la légende interactive (AC: 6)
  - [x] Légende intégrée dans EcosystemMap
  - [x] Toggle visibility par type
  - [x] Explication des couleurs d'edge
  - [x] Collapsible avec bouton

## Dev Notes

### Custom Node Component

```tsx
const EcosystemPartyNode = ({ data }: NodeProps<EcosystemParty>) => {
  const typeConfig = {
    supplier: { icon: '📦', color: 'bg-blue-100 border-blue-300' },
    partner: { icon: '🤝', color: 'bg-green-100 border-green-300' },
    customer: { icon: '👤', color: 'bg-purple-100 border-purple-300' },
    regulator: { icon: '⚖️', color: 'bg-orange-100 border-orange-300' },
    service_provider: { icon: '🔧', color: 'bg-teal-100 border-teal-300' },
  };

  const config = typeConfig[data.type];

  return (
    <div className={`p-3 rounded-xl border-2 ${config.color} shadow-apple`}>
      <div className="text-2xl text-center">{config.icon}</div>
      <div className="text-sm font-medium text-center mt-1">{data.name}</div>
      <RiskIndicator score={data.riskScore} />
    </div>
  );
};
```

### Controls Configuration

```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  fitView
  minZoom={0.1}
  maxZoom={2}
>
  <Controls position="top-right" />
  <MiniMap position="bottom-right" />
  <Background variant="dots" gap={12} />
</ReactFlow>
```

### Filter Implementation

```typescript
const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
  new Set(['supplier', 'partner', 'customer', 'regulator', 'service_provider'])
);

const filteredNodes = nodes.filter(node => visibleTypes.has(node.data.type));
```

### Legend Items

| Symbol | Meaning |
|--------|---------|
| 📦 Blue node | Fournisseur |
| 🤝 Green node | Partenaire |
| 🔴 Red edge | Vraisemblance élevée |
| 🟢 Green edge | Vraisemblance faible |
| ⚡ Animated edge | Chemin prioritaire |

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-15.5]
- [Source: reactflow.dev/docs/guides/custom-nodes/]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Debug Log References
N/A

### Completion Notes List
- Implémenté avec D3/Framer Motion au lieu de ReactFlow (déjà installés dans le projet)
- EcosystemMap.tsx créé avec visualisation SVG interactive
- Intégration dans Workshop3Content avec modal de visualisation
- Toutes les AC validées avec approche alternative (pas de ReactFlow)

### File List
- src/components/ebios/workshop3/EcosystemMap.tsx (NEW)
- src/components/ebios/workshops/Workshop3Content.tsx (MODIFIED)
- src/i18n/translations.ts (MODIFIED - ajout traductions ecosystem)
