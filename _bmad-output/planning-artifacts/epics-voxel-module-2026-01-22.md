---
stepsCompleted: [1, 2, 3, 4, 5]
status: complete
completedAt: 2026-01-22
inputDocuments:
  - prd-voxel-module-2026-01-22.md
  - architecture-voxel-module-2026-01-22.md
  - ux-design-voxel-module-2026-01-22.md
workflowType: 'epics-and-stories'
project_name: 'sentinel-grc-v2-prod'
module: 'voxel-3d-module'
user_name: 'Thibaultllopis'
date: '2026-01-22'
total_epics: 8
total_stories: 52
mvp_stories: 44
mvp_plus_stories: 8
---

# Epics & Stories - Module Voxel 3D

**Author:** Thibaultllopis
**Date:** 2026-01-22
**Module:** Voxel 3D Visualization

---

## Executive Summary

Ce document transforme les 52 Functional Requirements du PRD Voxel en **8 Epics** et **52 User Stories** prêtes pour l'implémentation. Les stories sont organisées par valeur utilisateur, avec acceptance criteria détaillés et références architecturales.

### Epic Overview

| # | Epic | Stories | Phase | Priority |
|---|------|---------|-------|----------|
| E1 | Foundation & Canvas Setup | 6 | MVP Core | P0 |
| E2 | Node Visualization | 6 | MVP Core | P0 |
| E3 | Edge & Connection Visualization | 4 | MVP Core | P0 |
| E4 | Navigation & Interaction | 7 | MVP Core | P0 |
| E5 | Filtering & Search | 5 | MVP Core | P0 |
| E6 | Data Integration | 4 | MVP Core | P0 |
| E7 | Detail Panel & Entity View | 5 | MVP Core | P0 |
| E8 | Security, RBAC & Accessibility | 9 | MVP Core | P0 |
| E9 | MVP+ Advanced Features | 8 | MVP+ | P1 |

### Requirements Traceability

| Category | FRs | Stories | Coverage |
|----------|-----|---------|----------|
| 3D Canvas & Rendering | FR1-FR4 | S1.1-S1.6 | 100% |
| Node Visualization | FR5-FR10 | S2.1-S2.6 | 100% |
| Edge & Connections | FR11-FR14 | S3.1-S3.4 | 100% |
| Navigation & Interaction | FR15-FR21 | S4.1-S4.7 | 100% |
| Filtering & Search | FR22-FR26 | S5.1-S5.5 | 100% |
| Data Integration | FR27-FR30 | S6.1-S6.4 | 100% |
| Detail Panel | FR31-FR35 | S7.1-S7.5 | 100% |
| Accessibility | FR36-FR39 | S8.1-S8.4 | 100% |
| Security & RBAC | FR40-FR44 | S8.5-S8.9 | 100% |
| MVP+ Features | FR45-FR52 | S9.1-S9.8 | 100% |

---

## Epic 1: Foundation & Canvas Setup

**Epic Goal:** Établir les fondations techniques permettant le rendu 3D dans l'application Sentinel.

**User Value:** "En tant qu'utilisateur, je peux accéder à une vue 3D de mon SI qui se charge rapidement et fonctionne sur mon navigateur."

**Dependencies:** None (foundational)

**Architecture Reference:**
- VoxelCanvas.tsx, VoxelScene.tsx
- voxelStore.ts (Zustand)
- useWebGLCapability.ts

### Story 1.1: R3F Canvas Integration

**FR Reference:** FR1 - Users can view a 3D canvas displaying their organization's GRC data

**As a** user
**I want** to see a 3D canvas when I navigate to the Voxel module
**So that** I can visualize my organization's GRC data spatially

**Acceptance Criteria:**
- [ ] Lazy-loaded route `/voxel` exists in App.tsx
- [ ] VoxelCanvas component renders React Three Fiber Canvas
- [ ] Canvas occupies full viewport minus toolbar (48px)
- [ ] Basic lighting setup (ambient + directional) is configured
- [ ] OrbitControls from @react-three/drei is integrated
- [ ] Canvas has dark background (#0F172A) per Digital Galaxy theme

**Technical Notes:**
```typescript
// Component structure
<Suspense fallback={<VoxelSkeleton />}>
  <VoxelCanvas />
</Suspense>

// Lazy import
const VoxelPage = lazy(() => import('./pages/VoxelPage'));
```

**Files to Create/Modify:**
- `src/pages/VoxelPage.tsx` (create)
- `src/components/voxel/VoxelCanvas.tsx` (create)
- `src/components/voxel/VoxelScene.tsx` (create)
- `src/App.tsx` (modify - add route)

**Estimated Effort:** M

---

### Story 1.2: Zustand Store Setup

**FR Reference:** FR1 (supporting infrastructure)

**As a** developer
**I want** a dedicated Zustand store for 3D state
**So that** 3D components can share state efficiently without over-rendering

**Acceptance Criteria:**
- [ ] voxelStore.ts created with TypeScript strict types
- [ ] Store includes: nodes, edges, selectedNodeId, hoveredNodeId, filters
- [ ] subscribeWithSelector middleware configured for fine-grained subscriptions
- [ ] Actions follow verb+Noun pattern (selectNode, hoverNode, setFilters)
- [ ] All selectors use shallow comparison where appropriate

**Technical Notes:**
```typescript
// Store structure per Architecture doc
export const useVoxelStore = create<VoxelState>()(
  subscribeWithSelector((set, get) => ({
    nodes: new Map(),
    edges: new Map(),
    selectedNodeId: null,
    hoveredNodeId: null,
    // ...
  }))
);
```

**Files to Create:**
- `src/stores/voxelStore.ts`
- `src/types/voxel.ts`

**Estimated Effort:** S

---

### Story 1.3: Performance Frame Rate

**FR Reference:** FR2 - Users can see the canvas render at minimum 30 FPS with up to 1,000 nodes

**As a** user
**I want** the 3D view to render smoothly at 30+ FPS
**So that** I have a fluid, professional experience

**Acceptance Criteria:**
- [ ] Canvas maintains 30+ FPS with 1,000 test nodes
- [ ] usePerformanceMonitor hook tracks FPS in development
- [ ] Performance stats visible in dev mode (Leva or custom)
- [ ] No frame drops below 30 FPS during normal interactions

**Technical Notes:**
```typescript
// Performance monitoring hook
const usePerformanceMonitor = () => {
  useFrame((state) => {
    const fps = 1 / state.clock.getDelta();
    // Track and report
  });
};
```

**Files to Create:**
- `src/components/voxel/hooks/usePerformanceMonitor.ts`

**Testing:**
- Create performance benchmark test with 1,000 mock nodes
- Measure FPS under load

**Estimated Effort:** S

---

### Story 1.4: Loading State

**FR Reference:** FR3 - Users can see a loading indicator while the 3D scene initializes

**As a** user
**I want** to see a loading indicator while the 3D scene initializes
**So that** I know the application is working

**Acceptance Criteria:**
- [ ] Skeleton/spinner shown during canvas initialization
- [ ] Loading state transitions to canvas within 2s (target), 5s max
- [ ] Loading indicator matches Digital Galaxy theme (dark, subtle)
- [ ] Progress indication if data loading takes >1s
- [ ] Smooth fade transition from loading to canvas

**Technical Notes:**
```typescript
// Loading states
{isLoadingGraph && (
  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
    <Spinner />
    <span className="ml-2">{t('voxel.loading')}</span>
  </div>
)}
```

**Files to Create:**
- `src/components/voxel/fallback/VoxelSkeleton.tsx`

**Estimated Effort:** XS

---

### Story 1.5: WebGL Fallback Detection

**FR Reference:** FR4 - Users can see a fallback message if WebGL is not supported

**As a** user without WebGL support
**I want** to see a clear message and alternative
**So that** I can still access GRC data through another view

**Acceptance Criteria:**
- [ ] useWebGLCapability hook detects WebGL 2.0, 1.0, or none
- [ ] If WebGL unavailable, VoxelFallback2D component renders
- [ ] Fallback message includes link to classic dashboard
- [ ] Mobile devices (<768px) automatically get 2D fallback
- [ ] Error boundary catches WebGL runtime errors

**Technical Notes:**
```typescript
// WebGL detection per Architecture doc
const VoxelViewer: FC = () => {
  const capability = useWebGLCapability();
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile || capability === 'none') {
    return <VoxelFallback2D />;
  }

  return (
    <ErrorBoundary fallback={<VoxelFallback2D />}>
      <VoxelCanvas degraded={capability === 'webgl1'} />
    </ErrorBoundary>
  );
};
```

**Files to Create:**
- `src/components/voxel/hooks/useWebGLCapability.ts`
- `src/components/voxel/fallback/VoxelFallback2D.tsx`
- `src/components/voxel/fallback/VoxelErrorBoundary.tsx`

**Estimated Effort:** M

---

### Story 1.6: Type Definitions

**FR Reference:** Foundation (supporting)

**As a** developer
**I want** centralized type definitions for all Voxel entities
**So that** I have type safety across all components

**Acceptance Criteria:**
- [ ] types/voxel.ts contains all Voxel type definitions
- [ ] VoxelNode type with position, color, type, metadata
- [ ] VoxelEdge type with source, target, type
- [ ] VoxelGraph type combining nodes and edges
- [ ] NodeType literal union ('asset' | 'risk' | 'control')
- [ ] FilterSet type for filter state

**Technical Notes:**
```typescript
// types/voxel.ts
export type NodeType = 'asset' | 'risk' | 'control';

export interface VoxelNode {
  id: string;
  type: NodeType;
  position: [number, number, number];
  color: string;
  size: number;
  label: string;
  metadata: Record<string, unknown>;
}

export interface VoxelEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}
```

**Files to Create:**
- `src/types/voxel.ts`

**Estimated Effort:** S

---

## Epic 2: Node Visualization

**Epic Goal:** Rendre visuellement les assets, risques et contrôles comme des noeuds 3D distincts.

**User Value:** "En tant qu'utilisateur, je peux identifier visuellement mes assets, risques et contrôles grâce à des formes et couleurs distinctives."

**Dependencies:** E1 (Foundation)

**Architecture Reference:**
- VoxelNode.tsx, AssetNode.tsx, RiskNode.tsx, ControlNode.tsx
- NodeStyleResolver.ts
- VoxelTheme (colors, geometries)

### Story 2.1: Asset Node Rendering

**FR Reference:** FR5 - Users can see Assets represented as 3D nodes in the canvas

**As a** user
**I want** to see my assets as 3D nodes
**So that** I can identify them visually in the scene

**Acceptance Criteria:**
- [ ] Assets render as blue spheres (#3B82F6)
- [ ] Sphere geometry with 16 segments for performance
- [ ] Position determined by layout engine (or mock positions initially)
- [ ] Hover state: emissive +0.1, scale 1.05
- [ ] Asset nodes are visible when asset filter is active

**Technical Notes:**
```typescript
// AssetNode component
<mesh position={position} onClick={() => selectNode(id)}>
  <sphereGeometry args={[size, 16, 16]} />
  <meshStandardMaterial color="#3B82F6" />
</mesh>
```

**Files to Create:**
- `src/components/voxel/nodes/VoxelNode.tsx`
- `src/components/voxel/nodes/AssetNode.tsx`

**Estimated Effort:** M

---

### Story 2.2: Asset Size by Criticality

**FR Reference:** FR6 - Users can see node size reflect asset criticality

**As a** user
**I want** more critical assets to appear larger
**So that** I can identify important assets at a glance

**Acceptance Criteria:**
- [ ] Asset size scales with criticality (1-5 → 0.5-2.0 units)
- [ ] Critical assets (5) are 4x larger than low criticality (1)
- [ ] Size calculation is consistent and deterministic
- [ ] Visual distinction is clear at macro zoom level

**Technical Notes:**
```typescript
const getSizeFromCriticality = (criticality: number): number => {
  const baseSize = 0.5;
  const maxSize = 2.0;
  return baseSize + (criticality / 5) * (maxSize - baseSize);
};
```

**Files to Modify:**
- `src/components/voxel/nodes/AssetNode.tsx`
- `src/services/voxel/NodeStyleResolver.ts` (create)

**Estimated Effort:** S

---

### Story 2.3: Risk Node Rendering

**FR Reference:** FR7 - Users can see Risks represented as distinct 3D nodes

**As a** user
**I want** to see risks as distinct 3D nodes
**So that** I can identify risk entities in the scene

**Acceptance Criteria:**
- [ ] Risks render as icosahedron geometry (multi-faceted)
- [ ] Risk nodes visually distinct from asset spheres
- [ ] Position determined by layout engine
- [ ] Hover state consistent with other nodes

**Files to Create:**
- `src/components/voxel/nodes/RiskNode.tsx`

**Estimated Effort:** S

---

### Story 2.4: Risk Color by Severity

**FR Reference:** FR8 - Users can see risk node color reflect severity

**As a** user
**I want** risk colors to indicate severity level
**So that** I can quickly assess the threat landscape

**Acceptance Criteria:**
- [ ] Critical risks: Red (#EF4444)
- [ ] High risks: Orange (#F97316)
- [ ] Medium risks: Yellow (#EAB308)
- [ ] Low risks: Green (#22C55E)
- [ ] Colors match daltonisme-safe palette from UX design
- [ ] Color mapping is consistent across all risk displays

**Technical Notes:**
```typescript
const getRiskColor = (severity: 'critical' | 'high' | 'medium' | 'low'): string => {
  const colors = {
    critical: '#EF4444',
    high: '#F97316',
    medium: '#EAB308',
    low: '#22C55E'
  };
  return colors[severity];
};
```

**Files to Modify:**
- `src/components/voxel/nodes/RiskNode.tsx`
- `src/services/voxel/NodeStyleResolver.ts`

**Estimated Effort:** XS

---

### Story 2.5: Control Node Rendering

**FR Reference:** FR9 - Users can see Controls represented as distinct 3D nodes

**As a** user
**I want** to see controls as distinct 3D nodes
**So that** I can identify control coverage in my SI

**Acceptance Criteria:**
- [ ] Controls render as box geometry (cube)
- [ ] Purple color (#8B5CF6) for all controls
- [ ] Visually distinct from assets (spheres) and risks (icosahedrons)
- [ ] Hover state consistent with other nodes

**Files to Create:**
- `src/components/voxel/nodes/ControlNode.tsx`

**Estimated Effort:** S

---

### Story 2.6: Node Type Visual Distinction

**FR Reference:** FR10 - Users can distinguish node types visually

**As a** user
**I want** each entity type to have a distinct visual appearance
**So that** I can quickly identify what I'm looking at

**Acceptance Criteria:**
- [ ] Assets: Blue spheres
- [ ] Risks: Colored icosahedrons (color by severity)
- [ ] Controls: Purple boxes
- [ ] Legend component shows type-to-shape mapping
- [ ] Shapes are recognizable at all zoom levels

**Files to Create:**
- `src/components/voxel/overlays/VoxelLegend.tsx`

**Estimated Effort:** S

---

## Epic 3: Edge & Connection Visualization

**Epic Goal:** Visualiser les connexions entre entités pour révéler les interdépendances.

**User Value:** "En tant qu'utilisateur, je peux voir comment mes assets, risques et contrôles sont interconnectés."

**Dependencies:** E2 (Node Visualization)

**Architecture Reference:**
- VoxelEdge.tsx, EdgeManager.tsx
- VoxelEdgeCurved.tsx (optional)

### Story 3.1: Edge Line Rendering

**FR Reference:** FR11 - Users can see connections between related nodes as visual arcs/edges

**As a** user
**I want** to see lines connecting related nodes
**So that** I understand the relationships between entities

**Acceptance Criteria:**
- [ ] Edges render as lines between node centers
- [ ] Line component uses @react-three/drei Line
- [ ] Edges are semi-transparent to not obscure nodes
- [ ] Edge color is neutral (gray/white) by default
- [ ] Edges update when node positions change

**Technical Notes:**
```typescript
// Using drei Line component
<Line
  points={[sourcePosition, targetPosition]}
  color="#64748B"
  lineWidth={1}
  transparent
  opacity={0.5}
/>
```

**Files to Create:**
- `src/components/voxel/edges/VoxelEdge.tsx`
- `src/components/voxel/edges/EdgeManager.tsx`

**Estimated Effort:** M

---

### Story 3.2: Asset-Risk Connections

**FR Reference:** FR12 - Users can see which assets are linked to which risks

**As a** user
**I want** to see connections between assets and their associated risks
**So that** I understand which assets are at risk

**Acceptance Criteria:**
- [ ] Edges connect asset nodes to related risk nodes
- [ ] Edge data sourced from Firestore mappings collection
- [ ] Asset-risk edges have distinct styling (optional: slight red tint)
- [ ] Clicking an asset highlights connected risk edges

**Files to Modify:**
- `src/components/voxel/edges/EdgeManager.tsx`
- `src/services/voxel/GraphBuilder.ts`

**Estimated Effort:** S

---

### Story 3.3: Control-Asset Connections

**FR Reference:** FR13 - Users can see which controls cover which assets

**As a** user
**I want** to see connections between controls and the assets they protect
**So that** I understand my control coverage

**Acceptance Criteria:**
- [ ] Edges connect control nodes to covered asset nodes
- [ ] Control-asset edges have distinct styling (optional: purple tint)
- [ ] Clicking a control highlights connected asset edges
- [ ] Uncovered assets (no control edge) are identifiable

**Files to Modify:**
- `src/components/voxel/edges/EdgeManager.tsx`
- `src/services/voxel/GraphBuilder.ts`

**Estimated Effort:** S

---

### Story 3.4: Edge Style Variation

**FR Reference:** FR14 - Users can see edge thickness or style indicate relationship strength/type

**As a** user
**I want** edge appearance to convey relationship information
**So that** I can understand connection types at a glance

**Acceptance Criteria:**
- [ ] Edge thickness varies by relationship strength (if available)
- [ ] Different edge types (risk-asset, control-asset) have distinct styles
- [ ] Strong relationships: thicker, more opaque
- [ ] Weak relationships: thinner, more transparent
- [ ] Edge type is identifiable without clicking

**Technical Notes:**
```typescript
const getEdgeStyle = (type: string, strength: number) => ({
  lineWidth: 1 + strength * 2,
  opacity: 0.3 + strength * 0.5,
  color: type === 'risk' ? '#EF4444' : '#8B5CF6'
});
```

**Files to Modify:**
- `src/components/voxel/edges/VoxelEdge.tsx`

**Estimated Effort:** S

---

## Epic 4: Navigation & Interaction

**Epic Goal:** Permettre aux utilisateurs d'explorer l'espace 3D de manière intuitive.

**User Value:** "En tant qu'utilisateur, je peux naviguer dans l'espace 3D naturellement et interagir avec les noeuds."

**Dependencies:** E1 (Foundation), E2 (Nodes)

**Architecture Reference:**
- VoxelOrbitControls.tsx
- useNodeSelection.ts
- useCameraAnimation.ts

### Story 4.1: Orbit Rotation

**FR Reference:** FR15 - Users can rotate the 3D view by dragging

**As a** user
**I want** to rotate the view by dragging
**So that** I can see the graph from different angles

**Acceptance Criteria:**
- [ ] Left mouse drag rotates camera around center
- [ ] Rotation is smooth with damping enabled
- [ ] Inertia allows momentum after drag release
- [ ] Rotation respects min/max angles (prevent flipping)
- [ ] Touch support: two-finger drag rotates

**Technical Notes:**
```typescript
<OrbitControls
  enableDamping
  dampingFactor={0.05}
  rotateSpeed={0.5}
  maxPolarAngle={Math.PI * 0.9}
  minPolarAngle={Math.PI * 0.1}
/>
```

**Files to Create:**
- `src/components/voxel/controls/VoxelOrbitControls.tsx`

**Estimated Effort:** S

---

### Story 4.2: Zoom Control

**FR Reference:** FR16 - Users can zoom in and out using scroll or pinch gestures

**As a** user
**I want** to zoom using scroll or pinch
**So that** I can see details or the full picture

**Acceptance Criteria:**
- [ ] Scroll wheel zooms in/out smoothly
- [ ] Pinch gesture on touch devices zooms
- [ ] Zoom limits: 50 units (close) to 2000 units (far)
- [ ] Zoom speed is comfortable (not too fast/slow)
- [ ] Current zoom level affects label visibility (zoom sémantique prep)

**Files to Modify:**
- `src/components/voxel/controls/VoxelOrbitControls.tsx`

**Estimated Effort:** S

---

### Story 4.3: Pan Navigation

**FR Reference:** FR17 - Users can pan the view to explore different areas

**As a** user
**I want** to pan the view laterally
**So that** I can explore different areas of the graph

**Acceptance Criteria:**
- [ ] Right mouse drag pans the camera
- [ ] Pan has boundaries to prevent losing the graph
- [ ] Pan speed scales with zoom level
- [ ] Touch support: single finger pan (configurable)

**Files to Modify:**
- `src/components/voxel/controls/VoxelOrbitControls.tsx`

**Estimated Effort:** XS

---

### Story 4.4: Node Click Selection

**FR Reference:** FR18 - Users can click on a node to select it

**As a** user
**I want** to click a node to select it
**So that** I can focus on that entity and see its details

**Acceptance Criteria:**
- [ ] Click on node selects it
- [ ] Selected node has visual halo/ring
- [ ] Selected node stored in voxelStore.selectedNodeId
- [ ] Only one node can be selected at a time
- [ ] Click on empty space deselects

**Technical Notes:**
```typescript
// Selection handling in VoxelNode
<mesh
  onClick={(e) => {
    e.stopPropagation();
    selectNode(data.id);
  }}
/>

// In VoxelCanvas
<mesh onClick={() => selectNode(null)} />
```

**Files to Create:**
- `src/components/voxel/hooks/useNodeSelection.ts`
- `src/components/voxel/effects/SelectionGlow.tsx`

**Estimated Effort:** M

---

### Story 4.5: Hover Tooltip

**FR Reference:** FR19 - Users can see a tooltip with summary info when hovering

**As a** user
**I want** to see a tooltip when I hover over a node
**So that** I can quickly preview information without clicking

**Acceptance Criteria:**
- [ ] Tooltip appears after 200ms hover delay
- [ ] Tooltip shows: Type, Name, Key metric (1 line max)
- [ ] Tooltip positioned above node (Billboard)
- [ ] Tooltip disappears immediately on mouse leave
- [ ] Tooltip uses dark background, white text, matches theme

**Technical Notes:**
```typescript
// Using drei Html for tooltip
{hoveredNodeId === data.id && (
  <Html position={[0, size + 0.5, 0]}>
    <div className="voxel-tooltip">
      {data.label}
    </div>
  </Html>
)}
```

**Files to Create:**
- `src/components/voxel/overlays/VoxelTooltip.tsx`

**Estimated Effort:** S

---

### Story 4.6: Click Detail Panel

**FR Reference:** FR20 - Users can open a detail panel showing full information when clicking

**As a** user
**I want** a detail panel to open when I click a node
**So that** I can see complete information about that entity

**Acceptance Criteria:**
- [ ] Panel slides in from right on node selection (300ms)
- [ ] Panel shows entity type, name, full details
- [ ] Panel has close button and closes on Escape
- [ ] Panel uses glass morphism styling
- [ ] Panel width: 320px on desktop

**Files to Create:**
- `src/components/voxel/overlays/VoxelDetailPanel.tsx`

**Estimated Effort:** M

---

### Story 4.7: Reset View

**FR Reference:** FR21 - Users can reset the view to the initial camera position

**As a** user
**I want** to reset the view to the starting position
**So that** I can re-orient myself if I get lost

**Acceptance Criteria:**
- [ ] Home button in toolbar resets camera
- [ ] Escape key resets view (if no panel open)
- [ ] Camera animates to initial position (500ms)
- [ ] Reset clears selection
- [ ] Reset preserves filters

**Technical Notes:**
```typescript
// Camera animation hook
const focusCameraOn = (target: Vector3) => {
  // Animate camera to position over 500ms
};
```

**Files to Create:**
- `src/components/voxel/hooks/useCameraAnimation.ts`

**Estimated Effort:** S

---

## Epic 5: Filtering & Search

**Epic Goal:** Permettre aux utilisateurs de filtrer et rechercher dans le graphe 3D.

**User Value:** "En tant qu'utilisateur, je peux filtrer la vue pour me concentrer sur ce qui m'intéresse."

**Dependencies:** E1, E2, E3, E4

**Architecture Reference:**
- VoxelToolbar.tsx
- voxelStore.ts (filters)

### Story 5.1: Filter by Entity Type

**FR Reference:** FR22 - Users can filter visible nodes by entity type

**As a** user
**I want** to filter by Assets, Risks, or Controls
**So that** I can focus on one type of entity

**Acceptance Criteria:**
- [ ] Checkbox filter for each entity type
- [ ] Multiple types can be selected (OR logic)
- [ ] Filtered-out nodes are hidden, not just dimmed
- [ ] Connected edges to hidden nodes are also hidden
- [ ] Default: all types visible

**Files to Create:**
- `src/components/voxel/overlays/VoxelToolbar.tsx`

**Estimated Effort:** M

---

### Story 5.2: Filter by Framework

**FR Reference:** FR23 - Users can filter visible nodes by framework

**As a** user
**I want** to filter by compliance framework (ISO, NIS2, DORA)
**So that** I can focus on specific regulatory requirements

**Acceptance Criteria:**
- [ ] Radio button filter for framework selection
- [ ] Single framework active at a time
- [ ] Shows nodes relevant to selected framework
- [ ] "All frameworks" option shows everything
- [ ] Framework data comes from Firestore

**Files to Modify:**
- `src/components/voxel/overlays/VoxelToolbar.tsx`

**Estimated Effort:** M

---

### Story 5.3: Filter by Risk Severity

**FR Reference:** FR24 - Users can filter visible nodes by risk severity level

**As a** user
**I want** to filter risks by severity level
**So that** I can focus on critical threats

**Acceptance Criteria:**
- [ ] Checkbox filter for each severity (Critical, High, Medium, Low)
- [ ] Multiple severities can be selected
- [ ] Risk nodes outside selection are hidden
- [ ] Assets/Controls remain visible (unaffected by severity filter)

**Files to Modify:**
- `src/components/voxel/overlays/VoxelToolbar.tsx`

**Estimated Effort:** S

---

### Story 5.4: Filter Combinations

**FR Reference:** FR25 - Users can toggle filter combinations

**As a** user
**I want** to combine multiple filters
**So that** I can create specific views of my data

**Acceptance Criteria:**
- [ ] Multiple filter types can be combined
- [ ] Filters are AND logic between categories, OR within
- [ ] Active filters shown as removable badges
- [ ] "Clear all filters" option available
- [ ] Filter state persists during session

**Technical Notes:**
```typescript
// Filter state in voxelStore
activeFilters: {
  types: Set<NodeType>,
  framework: string | null,
  severities: Set<RiskSeverity>
}
```

**Files to Modify:**
- `src/stores/voxelStore.ts`
- `src/components/voxel/overlays/VoxelToolbar.tsx`

**Estimated Effort:** S

---

### Story 5.5: Filter Visual Feedback

**FR Reference:** FR26 - Users can see visual feedback when filters are applied

**As a** user
**I want** clear visual feedback when filters are active
**So that** I know I'm viewing a subset of data

**Acceptance Criteria:**
- [ ] Badge count shows filtered node count
- [ ] "Showing X of Y nodes" indicator
- [ ] Active filter badges are clickable to remove
- [ ] Filtered-out nodes smoothly disappear (fade)
- [ ] Layout re-adjusts (optional) when nodes filtered

**Files to Modify:**
- `src/components/voxel/overlays/VoxelToolbar.tsx`

**Estimated Effort:** S

---

## Epic 6: Data Integration

**Epic Goal:** Intégrer les données Firestore temps réel dans la visualisation 3D.

**User Value:** "En tant qu'utilisateur, je vois mes vraies données GRC reflétées dans la vue 3D."

**Dependencies:** E1 (Foundation)

**Architecture Reference:**
- useVoxelData.ts
- GraphBuilder.ts
- LayoutEngine.ts, LayoutEngine.worker.ts

### Story 6.1: Real-Time Firestore Display

**FR Reference:** FR27 - Users can see real-time data from Firestore reflected in visualization

**As a** user
**I want** to see my real GRC data in the 3D view
**So that** I get an accurate picture of my SI

**Acceptance Criteria:**
- [ ] Data fetched from assets, risks, controls, mappings collections
- [ ] organizationId filter applied to all queries
- [ ] React Query used for caching and state management
- [ ] Initial load < 5s for 1,000 nodes
- [ ] Data transforms to VoxelNode/VoxelEdge types

**Technical Notes:**
```typescript
// useVoxelData hook
const useVoxelData = (organizationId: string) => {
  return useQuery({
    queryKey: ['voxel', organizationId],
    queryFn: () => fetchVoxelData(organizationId),
    staleTime: 30000
  });
};
```

**Files to Create:**
- `src/components/voxel/hooks/useVoxelData.ts`
- `src/services/voxel/VoxelDataTransform.ts`

**Estimated Effort:** L

---

### Story 6.2: Live Data Updates

**FR Reference:** FR28 - Users can see node data update when underlying data changes

**As a** user
**I want** changes in my GRC data to appear in real-time
**So that** I always see current information

**Acceptance Criteria:**
- [ ] Firestore onSnapshot listeners update React Query cache
- [ ] Node additions appear smoothly
- [ ] Node deletions fade out
- [ ] Node updates (color, size) animate
- [ ] No full reload required for updates

**Technical Notes:**
```typescript
// Real-time sync pattern from Architecture
useEffect(() => {
  const unsubscribe = onSnapshot(
    query(collection(db, 'assets'), where('organizationId', '==', orgId)),
    (snapshot) => {
      queryClient.setQueryData(['voxel', orgId], (old) =>
        mergeSnapshotChanges(old, snapshot)
      );
    }
  );
  return unsubscribe;
}, [orgId]);
```

**Files to Modify:**
- `src/components/voxel/hooks/useVoxelData.ts`

**Estimated Effort:** M

---

### Story 6.3: Multi-Tenant Isolation

**FR Reference:** FR29 - Users can see only data belonging to their organization

**As a** user
**I want** to see only my organization's data
**So that** data isolation is maintained

**Acceptance Criteria:**
- [ ] All Firestore queries include `where('organizationId', '==', orgId)`
- [ ] organizationId comes from authenticated user
- [ ] No data leakage between tenants
- [ ] Query errors handled gracefully

**Files to Modify:**
- `src/components/voxel/hooks/useVoxelData.ts`

**Estimated Effort:** S

---

### Story 6.4: Graph Building Service

**FR Reference:** FR30 - System aggregates data from multiple collections

**As a** system
**I want** to build a unified graph from multiple Firestore collections
**So that** the 3D view represents the complete picture

**Acceptance Criteria:**
- [ ] GraphBuilder service transforms raw data to VoxelGraph
- [ ] Nodes created from assets, risks, controls
- [ ] Edges created from mapping collections
- [ ] Graph structure is consistent and valid
- [ ] Invalid data handled gracefully (logged, not rendered)

**Technical Notes:**
```typescript
// GraphBuilder per Architecture
export class GraphBuilder {
  static buildGraph(
    assets: Asset[],
    risks: Risk[],
    controls: Control[],
    mappings: Mapping[]
  ): VoxelGraph {
    // Transform to VoxelNode/VoxelEdge
  }
}
```

**Files to Create:**
- `src/services/voxel/GraphBuilder.ts`

**Estimated Effort:** M

---

## Epic 7: Detail Panel & Entity View

**Epic Goal:** Afficher les informations complètes des entités sélectionnées.

**User Value:** "En tant qu'utilisateur, je peux voir tous les détails d'un asset, risque ou contrôle."

**Dependencies:** E4 (Navigation), E6 (Data)

**Architecture Reference:**
- VoxelDetailPanel.tsx

### Story 7.1: Asset Details Display

**FR Reference:** FR31 - Users can view complete asset details

**As a** user
**I want** to see full asset details in the panel
**So that** I understand the asset's context

**Acceptance Criteria:**
- [ ] Asset name, description displayed
- [ ] Owner/responsible person shown
- [ ] Criticality level with visual indicator
- [ ] Asset type and category
- [ ] Creation/update timestamps

**Files to Modify:**
- `src/components/voxel/overlays/VoxelDetailPanel.tsx`

**Estimated Effort:** S

---

### Story 7.2: Risk Details Display

**FR Reference:** FR32 - Users can view complete risk details

**As a** user
**I want** to see full risk details in the panel
**So that** I understand the threat

**Acceptance Criteria:**
- [ ] Risk name/threat description
- [ ] Likelihood score with visual
- [ ] Impact score with visual
- [ ] Current status (Open, Mitigated, etc.)
- [ ] Risk owner and mitigation plan link

**Files to Modify:**
- `src/components/voxel/overlays/VoxelDetailPanel.tsx`

**Estimated Effort:** S

---

### Story 7.3: Control Details Display

**FR Reference:** FR33 - Users can view complete control details

**As a** user
**I want** to see full control details in the panel
**So that** I understand the protection measure

**Acceptance Criteria:**
- [ ] Control code/identifier
- [ ] Control description
- [ ] Implementation status (Implemented, Planned, etc.)
- [ ] Coverage percentage or scope
- [ ] Framework mappings (ISO, NIS2, DORA)

**Files to Modify:**
- `src/components/voxel/overlays/VoxelDetailPanel.tsx`

**Estimated Effort:** S

---

### Story 7.4: Linked Entities Display

**FR Reference:** FR34 - Users can see linked entities from the detail panel

**As a** user
**I want** to see related entities in the panel
**So that** I understand connections without leaving the panel

**Acceptance Criteria:**
- [ ] "Related Assets" section for risks/controls
- [ ] "Associated Risks" section for assets
- [ ] "Covering Controls" section for assets
- [ ] Each related entity is clickable
- [ ] Click switches selection to that entity

**Files to Modify:**
- `src/components/voxel/overlays/VoxelDetailPanel.tsx`

**Estimated Effort:** M

---

### Story 7.5: Navigation to Full Page

**FR Reference:** FR35 - Users can navigate to full entity page from panel

**As a** user
**I want** to navigate to the full entity page
**So that** I can take actions or see complete history

**Acceptance Criteria:**
- [ ] "View Full Details" button in panel
- [ ] Button navigates to existing Sentinel entity page
- [ ] Navigation preserves Voxel state for back navigation
- [ ] Uses React Router, not full page reload
- [ ] Confirmation if unsaved state (if applicable)

**Files to Modify:**
- `src/components/voxel/overlays/VoxelDetailPanel.tsx`

**Estimated Effort:** S

---

## Epic 8: Security, RBAC & Accessibility

**Epic Goal:** Assurer la sécurité, le contrôle d'accès et l'accessibilité du module Voxel.

**User Value:** "En tant qu'utilisateur, je suis certain que mes données sont protégées et que le module est accessible à tous."

**Dependencies:** All previous epics

**Architecture Reference:**
- RBAC filtering via hasPermission()
- usePrefersReducedMotion.ts
- VoxelKeyboardNav.tsx

### Story 8.1: Daltonisme-Safe Visuals

**FR Reference:** FR36 - Users with color blindness can distinguish risk levels via shapes

**As a** color blind user
**I want** risk levels distinguishable by shape as well as color
**So that** I can interpret the visualization accurately

**Acceptance Criteria:**
- [ ] Risk critical: Icosahedron + red (distinct shape)
- [ ] Different node types have different geometries
- [ ] Legend shows both color AND shape
- [ ] Pattern overlays optional for additional distinction
- [ ] Tested with color blindness simulators

**Files to Modify:**
- `src/components/voxel/nodes/RiskNode.tsx`
- `src/components/voxel/overlays/VoxelLegend.tsx`

**Estimated Effort:** S

---

### Story 8.2: Contrast Compliance

**FR Reference:** FR37 - Users can see sufficient contrast (4.5:1 ratio)

**As a** user
**I want** all text and indicators to have sufficient contrast
**So that** I can read everything clearly

**Acceptance Criteria:**
- [ ] All text meets WCAG AA 4.5:1 contrast ratio
- [ ] Focus indicators meet 3:1 ratio
- [ ] Tested with Colour Contrast Analyzer
- [ ] Dark theme maintains contrast
- [ ] Labels on dark background use light text

**Files to Review:**
- All CSS/Tailwind classes in voxel module

**Estimated Effort:** S

---

### Story 8.3: Text Labels for All Indicators

**FR Reference:** FR38 - Users can see text labels/tooltips for all visual indicators

**As a** user
**I want** every visual element to have a text explanation
**So that** I understand what I'm seeing

**Acceptance Criteria:**
- [ ] All color-coded elements have tooltips
- [ ] Icon-only buttons have aria-label
- [ ] Legend provides text for all visual conventions
- [ ] No information conveyed by color alone

**Files to Review:**
- All interactive components in voxel module

**Estimated Effort:** S

---

### Story 8.4: Reduced Motion Support

**FR Reference:** FR39 - System respects user's reduced motion preference

**As a** user with vestibular disorders
**I want** animations to be disabled when I prefer reduced motion
**So that** I can use the app comfortably

**Acceptance Criteria:**
- [ ] usePrefersReducedMotion hook implemented
- [ ] Pulse animations → static glow when reduced motion
- [ ] Camera transitions → instant position change
- [ ] Panel slides → instant show/hide
- [ ] All useFrame animations check preference

**Technical Notes:**
```typescript
// Per Architecture document
const prefersReduced = usePrefersReducedMotion();
useFrame((_, delta) => {
  if (!prefersReduced && meshRef.current) {
    meshRef.current.rotation.y += delta * 0.5;
  }
});
```

**Files to Create:**
- `src/components/voxel/hooks/usePrefersReducedMotion.ts`

**Estimated Effort:** M

---

### Story 8.5: RBAC Node Filtering

**FR Reference:** FR40 - Users can only see nodes they have permission to view

**As a** restricted user
**I want** to see only the nodes I'm authorized to view
**So that** data access is properly controlled

**Acceptance Criteria:**
- [ ] Nodes filtered by user permissions before rendering
- [ ] Uses existing Sentinel hasPermission() function
- [ ] assets.read controls Asset visibility
- [ ] risks.read controls Risk visibility
- [ ] controls.read controls Control visibility

**Technical Notes:**
```typescript
// From PRD RBAC section
const visibleNodes = allNodes.filter(node =>
  hasPermission(user, `${node.type}.read`)
);
```

**Files to Modify:**
- `src/components/voxel/hooks/useVoxelData.ts`

**Estimated Effort:** M

---

### Story 8.6: Admin Full Access

**FR Reference:** FR41 - Admins can see all nodes across all entity types

**As an** admin user
**I want** to see all nodes without restrictions
**So that** I can have a complete view of the organization's data

**Acceptance Criteria:**
- [ ] Admin role bypasses node filtering
- [ ] All entity types visible to admin
- [ ] Admin can see nodes assigned to any user
- [ ] Admin permission check uses existing RBAC

**Files to Modify:**
- `src/components/voxel/hooks/useVoxelData.ts`

**Estimated Effort:** XS

---

### Story 8.7: Analyst Restricted View

**FR Reference:** FR42 - Analysts can see only nodes assigned to them

**As an** analyst user
**I want** to see only my assigned entities
**So that** I focus on my responsibilities

**Acceptance Criteria:**
- [ ] Analyst sees only nodes where assignedTo === user.id
- [ ] Or nodes in analyst's assigned scope
- [ ] Unassigned nodes are hidden
- [ ] Clear indication of filtered view

**Files to Modify:**
- `src/components/voxel/hooks/useVoxelData.ts`

**Estimated Effort:** S

---

### Story 8.8: No Client Cache for Sensitive Data

**FR Reference:** FR43 - System does not cache sensitive data in browser storage

**As a** security-conscious organization
**I want** no sensitive GRC data stored in browser storage
**So that** data isn't exposed if device is compromised

**Acceptance Criteria:**
- [ ] No localStorage usage for Voxel data
- [ ] No IndexedDB usage for Voxel data
- [ ] React Query cache is memory-only
- [ ] Session storage not used for sensitive data
- [ ] Data cleared on logout/session end

**Files to Review:**
- All Voxel services and hooks

**Estimated Effort:** S

---

### Story 8.9: Audit Trail Logging

**FR Reference:** FR44 - System logs user access to the Voxel module

**As an** administrator
**I want** Voxel access logged for audit purposes
**So that** I can track who viewed what data

**Acceptance Criteria:**
- [ ] Voxel page load triggers audit log entry
- [ ] Log includes: userId, timestamp, action
- [ ] Node selection optionally logged
- [ ] Uses existing Sentinel logAction() function
- [ ] Logs stored per Sentinel audit trail pattern

**Technical Notes:**
```typescript
// On Voxel load
logAction('voxel.viewed', {
  userId: user.uid,
  organizationId: user.organizationId
});
```

**Files to Modify:**
- `src/pages/VoxelPage.tsx`

**Estimated Effort:** S

---

## Epic 9: MVP+ Advanced Features

**Epic Goal:** Fonctionnalités avancées pour la phase post-MVP.

**User Value:** "En tant qu'utilisateur avancé, j'ai accès à des fonctionnalités qui améliorent mon expérience."

**Dependencies:** E1-E8 (All MVP Core)

**Phase:** MVP+ (Post-MVP)

**Architecture Reference:**
- LOD components
- ClusterGroup
- Advanced effects

### Story 9.1: Zoom Sémantique

**FR Reference:** FR45 - Users can experience smooth zoom transition between macro and micro views

**As a** user
**I want** details to appear as I zoom in
**So that** I get more information progressively

**Acceptance Criteria:**
- [ ] Macro view (>1000u): Clusters visible, no labels
- [ ] Medium view (200-1000u): Individual nodes, short labels
- [ ] Micro view (<200u): Full details, all labels
- [ ] Smooth transition between levels (fade)
- [ ] Label visibility tied to camera distance

**Files to Create:**
- `src/components/voxel/nodes/NodeHighDetail.tsx`
- `src/components/voxel/nodes/NodeMediumDetail.tsx`
- `src/components/voxel/nodes/NodeLowDetail.tsx`

**Estimated Effort:** L

---

### Story 9.2: Alertes Visuelles (Pulse)

**FR Reference:** FR46 - Users can see critical risks pulse/glow

**As a** user
**I want** critical risks to visually pulse
**So that** they catch my attention automatically

**Acceptance Criteria:**
- [ ] Critical risk nodes pulse (scale 1.0 → 1.1, 2s loop)
- [ ] Pulse respects prefers-reduced-motion
- [ ] Pulse can be disabled in settings
- [ ] Other severity levels don't pulse
- [ ] Pulse is subtle, not distracting

**Files to Create:**
- `src/components/voxel/effects/RiskPulse.tsx`

**Estimated Effort:** M

---

### Story 9.3: Mode Guidé

**FR Reference:** FR47 - Users can activate guided navigation to critical points

**As a** new user or executive
**I want** guided navigation to important areas
**So that** I can learn the interface or get a quick overview

**Acceptance Criteria:**
- [ ] "Start Tour" button in toolbar
- [ ] Camera animates to critical risk areas
- [ ] Explanatory tooltips at each stop
- [ ] User can skip or exit tour
- [ ] Tour completes with summary

**Files to Create:**
- `src/components/voxel/overlays/VoxelGuidedTour.tsx`

**Estimated Effort:** L

---

### Story 9.4: Clustering Automatique

**FR Reference:** FR48 - Users can see nodes automatically clustered

**As a** user with many nodes
**I want** related nodes clustered
**So that** I can manage visual complexity

**Acceptance Criteria:**
- [ ] Nodes grouped by department/domain
- [ ] Cluster appears as larger aggregate node
- [ ] Click cluster expands to show children
- [ ] Cluster shows aggregate metrics
- [ ] Works with 1000+ nodes

**Files to Create:**
- `src/components/voxel/nodes/ClusterGroup.tsx`

**Estimated Effort:** XL

---

### Story 9.5: Minimap Navigation

**FR Reference:** FR49 - Users can see a minimap for orientation

**As a** user exploring a large graph
**I want** a minimap showing my position
**So that** I can orient myself in the space

**Acceptance Criteria:**
- [ ] Minimap in bottom-left corner (160px)
- [ ] Shows full graph in simplified form
- [ ] Current viewport indicated
- [ ] Click on minimap moves camera
- [ ] Minimap can be hidden

**Files to Create:**
- `src/components/voxel/overlays/VoxelMinimap.tsx`

**Estimated Effort:** L

---

### Story 9.6: Framework Overlay

**FR Reference:** FR50 - Users can overlay compliance framework coverage

**As an** auditor or compliance officer
**I want** to see framework coverage overlaid on the graph
**So that** I can assess compliance visually

**Acceptance Criteria:**
- [ ] Toggle for ISO 27001, NIS2, DORA overlays
- [ ] Covered assets show green indicator
- [ ] Gaps show red pulsing indicator
- [ ] Coverage percentage displayed
- [ ] Framework selector in toolbar

**Files to Create:**
- `src/components/voxel/overlays/FrameworkOverlay.tsx`

**Estimated Effort:** L

---

### Story 9.7: Export View

**FR Reference:** FR51 - Users can export the current view as an image

**As a** user preparing a report
**I want** to export the 3D view as an image
**So that** I can include it in documentation

**Acceptance Criteria:**
- [ ] Export button in toolbar
- [ ] Exports current canvas as PNG
- [ ] High resolution option (2x)
- [ ] Watermark with user/date (optional, per RBAC)
- [ ] Download triggers automatically

**Files to Create:**
- `src/components/voxel/hooks/useExportCapture.ts`

**Estimated Effort:** M

---

### Story 9.8: Mode Direction

**FR Reference:** FR52 - Direction users can see a simplified executive view

**As an** executive
**I want** a simplified view focused on key metrics
**So that** I can understand the situation quickly

**Acceptance Criteria:**
- [ ] Mode Direction toggle in toolbar
- [ ] Simplified UI: score prominent, minimal controls
- [ ] Only high-level clusters visible
- [ ] Key risk areas highlighted
- [ ] Suitable for board presentations

**Files to Create:**
- `src/components/voxel/modes/DirectionMode.tsx`

**Estimated Effort:** L

---

## Implementation Sequence

### Recommended Implementation Order

Based on dependencies and architectural foundations:

**Sprint 1: Foundation (E1)**
1. S1.6: Type Definitions
2. S1.2: Zustand Store Setup
3. S1.1: R3F Canvas Integration
4. S1.4: Loading State
5. S1.5: WebGL Fallback Detection
6. S1.3: Performance Frame Rate

**Sprint 2: Node Visualization (E2)**
1. S2.1: Asset Node Rendering
2. S2.2: Asset Size by Criticality
3. S2.3: Risk Node Rendering
4. S2.4: Risk Color by Severity
5. S2.5: Control Node Rendering
6. S2.6: Node Type Visual Distinction

**Sprint 3: Edges & Navigation (E3, E4)**
1. S3.1: Edge Line Rendering
2. S3.2: Asset-Risk Connections
3. S3.3: Control-Asset Connections
4. S3.4: Edge Style Variation
5. S4.1: Orbit Rotation
6. S4.2: Zoom Control
7. S4.3: Pan Navigation

**Sprint 4: Interaction & Data (E4 cont., E6)**
1. S4.4: Node Click Selection
2. S4.5: Hover Tooltip
3. S4.6: Click Detail Panel
4. S4.7: Reset View
5. S6.4: Graph Building Service
6. S6.1: Real-Time Firestore Display

**Sprint 5: Data & Filters (E6 cont., E5)**
1. S6.2: Live Data Updates
2. S6.3: Multi-Tenant Isolation
3. S5.1: Filter by Entity Type
4. S5.2: Filter by Framework
5. S5.3: Filter by Risk Severity
6. S5.4: Filter Combinations
7. S5.5: Filter Visual Feedback

**Sprint 6: Details & Security (E7, E8)**
1. S7.1-S7.5: Detail Panel Content
2. S8.1: Daltonisme-Safe Visuals
3. S8.2: Contrast Compliance
4. S8.3: Text Labels for All Indicators
5. S8.4: Reduced Motion Support
6. S8.5-S8.9: RBAC & Security

**Sprint 7+: MVP+ Features (E9)**
- Prioritize based on user feedback from MVP

---

## Testing Strategy

### Unit Tests Required

Each story must include:
- Component unit tests (Vitest + React Testing Library)
- Hook unit tests
- Service unit tests

### Integration Tests

Per Epic:
- E1: Canvas rendering integration
- E2: Node rendering with data
- E3: Edge rendering with layout
- E4: User interaction flows
- E5: Filter state management
- E6: Firestore data flow
- E7: Panel data binding
- E8: RBAC filtering accuracy

### Accessibility Tests

- Keyboard navigation flow test
- Screen reader announcement test
- Color contrast automated check
- Reduced motion behavior test

### Performance Tests

- 1,000 node render benchmark
- 10,000 node render benchmark (MVP+)
- Interaction latency (<100ms)
- Initial load time (<5s)

---

## Definition of Done

For each story to be considered complete:

- [ ] Code implemented and compiles without errors
- [ ] TypeScript strict mode passes
- [ ] Unit tests written and passing (>70% coverage)
- [ ] Acceptance criteria verified
- [ ] Accessibility requirements met (WCAG AA)
- [ ] Code reviewed and approved
- [ ] Documentation updated (JSDoc, README if needed)
- [ ] i18n keys added to both locales (en.json, fr.json)
- [ ] No ESLint errors
- [ ] Manual QA verification

---

## Glossary

| Term | Definition |
|------|------------|
| **Node** | 3D representation of an entity (Asset, Risk, Control) |
| **Edge** | Visual connection line between two nodes |
| **OrbitControls** | Three.js/R3F camera control for rotate/zoom/pan |
| **LOD** | Level of Detail - different visual quality based on distance |
| **Zoom Sémantique** | Information density changes with zoom level |
| **RBAC** | Role-Based Access Control |
| **R3F** | React Three Fiber - React renderer for Three.js |

---

**Document Status:** COMPLETE ✅

**Next Steps:**
1. Create sprint planning file
2. Begin Sprint 1 implementation
3. Set up CI/CD for Voxel module tests
