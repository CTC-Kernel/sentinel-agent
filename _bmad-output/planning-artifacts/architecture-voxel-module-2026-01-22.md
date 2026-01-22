---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-01-22'
inputDocuments:
  - prd-voxel-module-2026-01-22.md
  - ux-design-voxel-module-2026-01-22.md
  - product-brief-voxel-module-2026-01-22.md
  - research/technical-voxel-3d-visualization-grc-research-2026-01-22.md
workflowType: 'architecture'
project_name: 'sentinel-grc-v2-prod'
module: 'voxel-3d-module'
user_name: 'Thibaultllopis'
date: '2026-01-22'
---

# Architecture Decision Document - Module Voxel 3D

_Ce document se construit collaborativement à travers une découverte étape par étape. Les sections sont ajoutées au fur et à mesure que nous travaillons ensemble sur chaque décision architecturale._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (52 FRs) :**

| Catégorie | Count | Exemples Clés |
|-----------|-------|---------------|
| 3D Canvas & Rendering | FR1-FR4 | Canvas R3F, 30+ FPS, WebGL fallback |
| Node Visualization | FR5-FR10 | Assets, Risks, Controls avec formes/couleurs |
| Edge & Connections | FR11-FR14 | Arcs entre noeuds, épaisseur selon type |
| Navigation & Interaction | FR15-FR21 | OrbitControls, click select, tooltip, detail panel |
| Filtering & Search | FR22-FR26 | Par type, framework, severity |
| Data Integration | FR27-FR30 | Real-time Firestore, multi-tenant |
| Detail Panel | FR31-FR35 | Asset/Risk/Control details, navigation |
| Accessibility | FR36-FR39 | Daltonisme, contraste, reduced motion |
| Security & RBAC | FR40-FR44 | Permission filtering, audit logs |
| MVP+ Features | FR45-FR52 | Zoom sémantique, alertes, clustering, export |

**Non-Functional Requirements :**

| Catégorie | Exigences Critiques |
|-----------|---------------------|
| **Performance** | 60 FPS (1K), 30 FPS (50K), <2s load, <100ms interaction |
| **Scalability** | 1K→10K→50K+ noeuds selon phase |
| **Security** | RBAC, pas de cache client, audit trail, session timeout |
| **Accessibility** | WCAG 2.1 AA, daltonisme-safe, keyboard nav |
| **Reliability** | 99.9% uptime, graceful recovery |
| **Integration** | Firestore real-time, browsers Chrome/Firefox/Safari/Edge |
| **Maintainability** | >70% test coverage, <500KB bundle |

### Scale & Complexity Assessment

| Indicateur | Valeur | Impact |
|------------|--------|--------|
| **Complexité globale** | Élevée | Architecture modulaire requise |
| **Domaine technique** | Frontend 3D + Backend Firebase | Stack spécialisée R3F |
| **Noeuds max supportés** | 50,000+ | Optimisations GPU critiques |
| **Personas supportés** | 5 | Modes UI multiples |
| **Frameworks conformité** | ISO 27001, NIS2, DORA, RGPD | Overlays dynamiques |

### Technical Constraints & Dependencies

**Stack imposée (PRD + Research) :**

```
React Three Fiber (R3F) ^8.x
├── Three.js ^0.160.x
├── @react-three/drei ^9.x
├── Zustand ^4.x (state management 3D)
└── Firestore (existant Sentinel)
```

**Contraintes techniques :**
- WebGL 2.0 requis (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- GPU minimum : Intel HD 4000
- Fallback obligatoire si WebGL indisponible
- Pas de cache localStorage pour données sensibles
- Mobile → Vue 2D alternative (pas de 3D)

**Dépendances existantes Sentinel :**
- React Query (cache Firestore)
- Tailwind CSS (UI overlays)
- RBAC système existant
- Collections Firestore : assets, risks, controls, frameworks

### Cross-Cutting Concerns

| Concern | Composants Affectés | Décision Requise |
|---------|---------------------|------------------|
| **Performance GPU** | Canvas, Nodes, Edges, Effects | InstancedMesh vs Mesh standard |
| **State Management** | Tous les composants 3D | Zustand architecture |
| **Real-time Sync** | Data layer, UI updates | Firestore subscriptions pattern |
| **Accessibility** | Navigation, Labels, Colors | Keyboard nav + ARIA + formes |
| **Multi-tenancy** | Queries, Filtering, RBAC | organizationId isolation |
| **Error Recovery** | Canvas, WebGL, Network | Graceful degradation patterns |
| **Testing 3D** | All components | Stratégie tests visuels |

### UX Architecture Implications

**From UX Design Specification :**

| UX Pattern | Implication Technique |
|------------|----------------------|
| **Zoom Sémantique** | LOD + label visibility par distance caméra |
| **Digital Galaxy Theme** | Lighting setup, materials config, glass morphism panels |
| **OrbitControls** | @react-three/drei integration |
| **Detail Panel Slide-in** | React portal + z-index management |
| **Minimap** | Secondary render target ou overlay 2D |
| **Keyboard Navigation** | Custom focus management dans canvas |
| **Reduced Motion** | CSS media query + animation disabling |

## Starter Template Evaluation

### Primary Technology Domain

**Brownfield Module Addition** — Intégration d'un module WebGL/3D dans une application React existante.

Ce n'est pas un projet greenfield nécessitant un starter complet. La fondation technique existe déjà dans Sentinel GRC.

### Technical Preferences (Existing)

**From Sentinel GRC Codebase:**

| Aspect | Technology | Status |
|--------|------------|--------|
| Framework | React 19 | ✅ Existant |
| Language | TypeScript 5.x | ✅ Existant |
| Styling | Tailwind CSS | ✅ Existant |
| State (UI) | Zustand | ✅ Existant |
| Data Fetching | React Query + Firestore | ✅ Existant |
| Testing | Vitest + React Testing Library | ✅ Existant |
| Build | Vite | ✅ Existant |

### New Dependencies for Voxel Module

**Core 3D Stack:**

```bash
npm install @react-three/fiber@^8.x three@^0.160.x @react-three/drei@^9.x
npm install -D @types/three
```

**State Management 3D:**

```bash
# Zustand already installed - will create dedicated 3D store
```

**MVP+ Dependencies (Later):**

```bash
npm install @react-three/postprocessing  # Bloom, effects
npm install maath                         # Math utilities for 3D
```

### Selected Approach: Module Integration Pattern

**Rationale:**
- Leverages existing Sentinel architecture and conventions
- No new build configuration needed
- Consistent with existing component patterns
- Reuses authentication, RBAC, and data layer

### Architectural Decisions from Integration

**Language & Runtime:**
- TypeScript strict mode (inherits from Sentinel tsconfig)
- ES2022 target (existing)
- React 19 concurrent features available

**Styling Solution:**
- Tailwind CSS for UI overlays (existing)
- Inline Three.js materials for 3D objects
- CSS-in-JS avoided for performance

**Build Tooling:**
- Vite (existing) — good R3F support
- Tree-shaking enabled for Three.js
- Separate chunk for 3D module (lazy loading)

**Testing Framework:**
- Vitest (existing)
- @react-three/test-renderer for 3D components
- Canvas mocking for unit tests

**Code Organization:**

```
src/
├── components/
│   └── voxel/                    # NEW: Voxel 3D module
│       ├── VoxelCanvas.tsx       # Main R3F canvas
│       ├── VoxelScene.tsx        # Scene setup
│       ├── nodes/                # 3D node components
│       ├── edges/                # Connection components
│       ├── effects/              # Visual effects
│       ├── overlays/             # HTML overlay UI
│       └── hooks/                # Voxel-specific hooks
├── stores/
│   └── voxelStore.ts             # NEW: Zustand store for 3D state
├── services/
│   └── voxel/                    # NEW: Graph building, layout
│       ├── GraphBuilder.ts
│       ├── LayoutEngine.ts
│       └── VoxelDataTransform.ts
└── types/
    └── voxel.ts                  # NEW: Voxel type definitions
```

**Development Experience:**
- Hot reloading works with R3F (Vite HMR)
- React DevTools + Zustand devtools
- Three.js inspector browser extension recommended
- Leva (debug GUI) for development

### Initialization Approach

**No CLI command needed.** Integration steps:

1. Install dependencies in existing package.json
2. Create voxel/ directory structure
3. Add lazy-loaded route for Voxel module
4. Configure Zustand store for 3D state

**First Implementation Story should cover:**
- Dependency installation
- Basic VoxelCanvas rendering "Hello 3D"
- Route integration with lazy loading
- Zustand store skeleton

**Note:** This approach preserves all existing Sentinel patterns while adding 3D capabilities.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. 3D Rendering Strategy (InstancedMesh vs Mesh standard)
2. Layout Algorithm et Web Workers
3. State Management 3D (Zustand store structure)
4. Data Flow Architecture (Firestore → 3D Scene)

**Important Decisions (Shape Architecture):**
1. LOD (Level of Detail) Strategy
2. WebGL Fallback Pattern
3. Performance Monitoring
4. 3D Testing Approach

**Deferred Decisions (Post-MVP):**
1. Multi-user collaboration (curseurs partagés)
2. Export 3D (glTF, screenshots)
3. AR/VR extensions

### 3D Rendering Architecture

#### Decision 1: Node Rendering Strategy

**Choice:** InstancedMesh + Standard Mesh Hybrid

**Rationale:**
- InstancedMesh pour nodes identiques (même type) → GPU batching
- Standard Mesh pour nodes sélectionnés/highlighted → interaction individuelle
- Threshold : switch à InstancedMesh au-delà de 100 nodes du même type

**Implementation:**

```typescript
// Hybrid rendering strategy
interface RenderStrategy {
  threshold: 100;  // Switch to instanced at 100+ nodes per type
  instancedTypes: ['asset', 'risk', 'control'];
  standardTypes: ['selected', 'highlighted', 'focused'];
}

// InstancedMesh for bulk rendering
<instancedMesh
  ref={meshRef}
  args={[geometry, material, count]}
  frustumCulled
>
  <sphereGeometry args={[1, 16, 16]} />
  <meshStandardMaterial />
</instancedMesh>
```

**Performance Target:**
- 1K nodes : 60 FPS (standard mesh OK)
- 10K nodes : 30 FPS (InstancedMesh required)
- 50K nodes : 30 FPS (InstancedMesh + LOD required)

#### Decision 2: Level of Detail (LOD) Strategy

**Choice:** Distance-based LOD avec 3 niveaux

| Distance | Detail Level | Vertices | Features |
|----------|--------------|----------|----------|
| < 50 units | High | 32 segments | Labels, glow, full material |
| 50-200 units | Medium | 16 segments | Simple material, no labels |
| > 200 units | Low | 8 segments | Flat color, point-like |

**Implementation:**

```typescript
// LOD component wrapper
const NodeLOD: FC<{ position: Vector3; nodeData: VoxelNode }> = ({ position, nodeData }) => {
  return (
    <Detailed distances={[0, 50, 200]}>
      <NodeHighDetail data={nodeData} />
      <NodeMediumDetail data={nodeData} />
      <NodeLowDetail data={nodeData} />
    </Detailed>
  );
};
```

### Layout Algorithm Architecture

#### Decision 3: Force-Directed Layout with Web Workers

**Choice:** Force-directed layout (d3-force) dans Web Worker

**Rationale:**
- Calculs layout non-bloquants (main thread libre pour rendu)
- d3-force mature et bien documenté
- Warm start pour layouts incrémentaux

**Architecture:**

```
┌─────────────────┐     ┌─────────────────┐
│   Main Thread   │     │   Web Worker    │
│                 │     │                 │
│ VoxelCanvas     │────▶│ LayoutEngine    │
│ (R3F render)    │     │ (d3-force)      │
│                 │◀────│                 │
│ Position updates│     │ Tick results    │
└─────────────────┘     └─────────────────┘
```

**Worker Message Protocol:**

```typescript
// Main → Worker
type LayoutCommand =
  | { type: 'INIT'; nodes: GraphNode[]; edges: GraphEdge[] }
  | { type: 'UPDATE'; changes: NodeChange[] }
  | { type: 'STOP' };

// Worker → Main
type LayoutResult =
  | { type: 'TICK'; positions: Map<string, Vector3> }
  | { type: 'STABLE'; finalPositions: Map<string, Vector3> }
  | { type: 'ERROR'; message: string };
```

**d3-force Configuration:**

```typescript
const simulation = forceSimulation(nodes)
  .force('charge', forceManyBody().strength(-300))
  .force('link', forceLink(edges).distance(100))
  .force('center', forceCenter(0, 0, 0))
  .force('collision', forceCollide().radius(20))
  .alphaDecay(0.02);  // Slower for smoother animation
```

### State Management Architecture

#### Decision 4: Zustand Store Structure for 3D

**Choice:** Dedicated voxelStore séparé du store UI principal

**Rationale:**
- Séparation des concerns (3D state vs UI state)
- Updates haute fréquence (positions, camera) isolés
- Subscriptions sélectives pour éviter re-renders

**Store Structure:**

```typescript
// stores/voxelStore.ts
interface VoxelState {
  // Graph Data
  nodes: Map<string, VoxelNode>;
  edges: Map<string, VoxelEdge>;

  // Selection State
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  focusedNodeIds: Set<string>;

  // Camera State
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  zoomLevel: number;

  // Filter State
  activeFilters: FilterSet;
  visibleNodeTypes: Set<NodeType>;
  activeFramework: string | null;

  // UI State
  detailPanelOpen: boolean;
  minimapVisible: boolean;

  // Actions
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  setFilters: (filters: FilterSet) => void;
  updateNodePositions: (positions: Map<string, Vector3>) => void;
  focusCameraOn: (nodeId: string) => void;
}

export const useVoxelStore = create<VoxelState>()(
  subscribeWithSelector((set, get) => ({
    // ... implementation
  }))
);
```

**Selector Pattern (Performance):**

```typescript
// Fine-grained selectors to minimize re-renders
const selectedNode = useVoxelStore((state) => state.selectedNodeId);
const visibleTypes = useVoxelStore((state) => state.visibleNodeTypes);

// Shallow comparison for collections
const filters = useVoxelStore(
  (state) => state.activeFilters,
  shallow
);
```

### Data Flow Architecture

#### Decision 5: Firestore → 3D Scene Pipeline

**Choice:** React Query + GraphBuilder + LayoutEngine

**Data Flow:**

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Firestore   │───▶│ React Query  │───▶│ GraphBuilder │───▶│LayoutEngine  │
│  (raw data)  │    │  (cache)     │    │  (transform) │    │  (positions) │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                    │
                                                                    ▼
                                        ┌──────────────┐    ┌──────────────┐
                                        │ VoxelCanvas  │◀───│ voxelStore   │
                                        │  (render)    │    │  (state)     │
                                        └──────────────┘    └──────────────┘
```

**GraphBuilder Service:**

```typescript
// services/voxel/GraphBuilder.ts
export class GraphBuilder {
  static buildGraph(
    assets: Asset[],
    risks: Risk[],
    controls: Control[],
    mappings: Mapping[]
  ): VoxelGraph {
    const nodes: VoxelNode[] = [
      ...assets.map(a => this.assetToNode(a)),
      ...risks.map(r => this.riskToNode(r)),
      ...controls.map(c => this.controlToNode(c)),
    ];

    const edges: VoxelEdge[] = mappings.map(m => ({
      id: m.id,
      source: m.sourceId,
      target: m.targetId,
      type: m.type,
    }));

    return { nodes, edges };
  }
}
```

**Real-time Sync Pattern:**

```typescript
// React Query subscription with Firestore
const useVoxelData = (organizationId: string) => {
  return useQuery({
    queryKey: ['voxel', organizationId],
    queryFn: () => fetchVoxelData(organizationId),
    refetchOnWindowFocus: false,
    staleTime: 30000,  // 30s before considered stale
  });
};

// Firestore listener for real-time updates
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

### Error Handling Architecture

#### Decision 6: WebGL Fallback Strategy

**Choice:** Graceful degradation avec détection proactive

**Fallback Hierarchy:**

```
WebGL 2.0 (Full) → WebGL 1.0 (Reduced) → Canvas 2D (Fallback) → Static Image (Minimal)
```

**Implementation:**

```typescript
// hooks/useWebGLCapability.ts
export const useWebGLCapability = (): WebGLCapability => {
  const [capability, setCapability] = useState<WebGLCapability>('checking');

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    const gl1 = canvas.getContext('webgl');

    if (gl2) {
      setCapability('webgl2');
    } else if (gl1) {
      setCapability('webgl1');
    } else {
      setCapability('none');
    }
  }, []);

  return capability;
};

// VoxelCanvas with fallback
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

### Testing Architecture

#### Decision 7: 3D Testing Strategy

**Choice:** Multi-layer testing approach

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Vitest | Store logic, GraphBuilder, utilities |
| Integration | @react-three/test-renderer | R3F component behavior |
| Visual | Playwright | Screenshot comparison |
| Performance | Custom metrics | FPS, memory, load time |

**R3F Testing Pattern:**

```typescript
// __tests__/VoxelNode.test.tsx
import { create } from '@react-three/test-renderer';

describe('VoxelNode', () => {
  it('renders with correct geometry', async () => {
    const renderer = await create(
      <VoxelNode
        position={[0, 0, 0]}
        type="asset"
        selected={false}
      />
    );

    const mesh = renderer.scene.children[0];
    expect(mesh.type).toBe('Mesh');
    expect(mesh.geometry.type).toBe('SphereGeometry');
  });
});
```

**Performance Testing:**

```typescript
// Custom performance monitor
const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memory: 0,
    drawCalls: 0,
  });

  useFrame((state) => {
    const info = state.gl.info;
    setMetrics({
      fps: 1 / state.clock.getDelta(),
      memory: info.memory.geometries + info.memory.textures,
      drawCalls: info.render.calls,
    });
  });

  return metrics;
};
```

### Decision Impact Analysis

**Implementation Sequence:**

1. **Foundation**
   - voxelStore setup
   - GraphBuilder service
   - WebGL detection

2. **Core Rendering**
   - VoxelCanvas + Scene setup
   - Basic node rendering
   - OrbitControls integration

3. **Layout & Data**
   - LayoutEngine Web Worker
   - Firestore integration
   - Real-time sync

4. **Interaction**
   - Selection/hover states
   - Detail panel
   - Filtering

5. **Optimization**
   - InstancedMesh migration
   - LOD implementation
   - Performance testing

**Cross-Component Dependencies:**

```
voxelStore ◀──────┬──────▶ GraphBuilder
     │            │             │
     ▼            │             ▼
VoxelCanvas ◀─────┴──────▶ LayoutEngine
     │                          │
     ▼                          ▼
VoxelNodes ◀─────────────▶ Position Updates
```

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 12 areas where AI agents could make different choices

| Conflict Area | Risk Level | Pattern Required |
|---------------|------------|------------------|
| 3D Component naming | High | R3F naming conventions |
| Store slice organization | High | voxelStore structure |
| Event naming (3D interactions) | Medium | Consistent event taxonomy |
| Type definitions | High | Centralized voxel.ts types |
| File colocation | Medium | Tests and components together |
| CSS vs Three.js styling | Medium | Clear boundary rules |

### Naming Patterns

#### Database Naming (Inherited from Sentinel)

**Collections:** `camelCase` pluriel
- ✅ `assets`, `risks`, `controls`, `mappings`
- ❌ `Assets`, `asset_list`, `ASSETS`

**Document Fields:** `camelCase`
- ✅ `organizationId`, `createdAt`, `riskLevel`
- ❌ `organization_id`, `created_at`, `risk_level`

#### API Naming (N/A - Firestore Direct)

Le module Voxel utilise Firestore directement sans API REST custom.

#### Code Naming - React/TypeScript

**Components:** `PascalCase` avec préfixe `Voxel` pour le module

```typescript
// ✅ Correct
VoxelCanvas.tsx
VoxelNode.tsx
VoxelEdge.tsx
VoxelDetailPanel.tsx

// ❌ Incorrect
voxelCanvas.tsx
Voxel_Node.tsx
Node3D.tsx  // Missing Voxel prefix
```

**Hooks:** `camelCase` avec préfixe `use`

```typescript
// ✅ Correct
useVoxelStore.ts
useWebGLCapability.ts
useNodeSelection.ts
useLayoutEngine.ts

// ❌ Incorrect
VoxelStoreHook.ts
webgl-capability.ts
use_node_selection.ts
```

**Services:** `PascalCase` classe statique

```typescript
// ✅ Correct
GraphBuilder.ts      // Class: GraphBuilder
LayoutEngine.ts      // Class: LayoutEngine
VoxelDataTransform.ts // Class: VoxelDataTransform

// ❌ Incorrect
graphBuilder.ts
layout-engine.ts
```

**Types:** `PascalCase` avec préfixe descriptif

```typescript
// ✅ Correct (dans types/voxel.ts)
type VoxelNode = {...}
type VoxelEdge = {...}
type VoxelGraph = {...}
type NodeType = 'asset' | 'risk' | 'control'

// ❌ Incorrect
type voxelNode = {...}
type Node = {...}  // Too generic
type IVoxelNode = {...}  // No I prefix
```

#### Code Naming - Three.js/R3F

**Mesh References:** `camelCase` + `Ref` suffix

```typescript
// ✅ Correct
const meshRef = useRef<THREE.Mesh>(null)
const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
const groupRef = useRef<THREE.Group>(null)

// ❌ Incorrect
const MeshRef = useRef(null)
const mesh_ref = useRef(null)
const ref = useRef(null)  // Too generic
```

**Vector3/Euler Variables:** Descriptive `camelCase`

```typescript
// ✅ Correct
const nodePosition = new Vector3(x, y, z)
const cameraTarget = new Vector3(0, 0, 0)
const initialRotation = new Euler(0, Math.PI / 4, 0)

// ❌ Incorrect
const pos = new Vector3()
const v3 = new Vector3()
const nodePos = [x, y, z]  // Use Vector3, not arrays
```

### Structure Patterns

#### Project Organization

**Voxel Module Structure:**

```
src/components/voxel/
├── VoxelCanvas.tsx           # Entry point, Canvas setup
├── VoxelScene.tsx            # Scene, lights, controls
├── index.ts                  # Public exports
├── nodes/
│   ├── VoxelNode.tsx         # Single node component
│   ├── VoxelNodeInstanced.tsx # Instanced rendering
│   ├── NodeHighDetail.tsx    # LOD: High
│   ├── NodeMediumDetail.tsx  # LOD: Medium
│   ├── NodeLowDetail.tsx     # LOD: Low
│   └── index.ts
├── edges/
│   ├── VoxelEdge.tsx         # Connection line
│   ├── VoxelEdgeCurved.tsx   # Bezier curve variant
│   └── index.ts
├── effects/
│   ├── SelectionGlow.tsx     # Selection highlight
│   ├── HoverOutline.tsx      # Hover effect
│   └── index.ts
├── overlays/
│   ├── VoxelDetailPanel.tsx  # Right panel (HTML)
│   ├── VoxelMinimap.tsx      # Minimap overlay
│   ├── VoxelToolbar.tsx      # Filter controls
│   ├── VoxelTooltip.tsx      # Hover tooltip
│   └── index.ts
├── hooks/
│   ├── useWebGLCapability.ts
│   ├── useNodeSelection.ts
│   ├── useLayoutWorker.ts
│   ├── useCameraAnimation.ts
│   └── index.ts
└── __tests__/
    ├── VoxelCanvas.test.tsx
    ├── VoxelNode.test.tsx
    └── hooks/
        └── useWebGLCapability.test.ts
```

**Rule:** Tests are co-located in `__tests__/` subdirectory within the module.

**Services Organization:**

```
src/services/voxel/
├── GraphBuilder.ts
├── LayoutEngine.ts
├── LayoutEngine.worker.ts    # Web Worker file
├── VoxelDataTransform.ts
└── __tests__/
    ├── GraphBuilder.test.ts
    └── LayoutEngine.test.ts
```

**Store Organization:**

```
src/stores/
├── index.ts                  # Main store (existing)
└── voxelStore.ts             # Dedicated 3D store (new)
```

**Types Organization:**

```
src/types/
├── index.ts                  # Existing types
└── voxel.ts                  # All Voxel-related types
```

#### File Colocation Rules

| File Type | Location | Example |
|-----------|----------|---------|
| Component | `components/voxel/<name>/` | `VoxelNode.tsx` |
| Component Test | `components/voxel/__tests__/` | `VoxelNode.test.tsx` |
| Hook | `components/voxel/hooks/` | `useNodeSelection.ts` |
| Hook Test | `components/voxel/hooks/__tests__/` | `useNodeSelection.test.ts` |
| Service | `services/voxel/` | `GraphBuilder.ts` |
| Service Test | `services/voxel/__tests__/` | `GraphBuilder.test.ts` |
| Type | `types/voxel.ts` | All in single file |
| Store | `stores/voxelStore.ts` | Single store file |

### Format Patterns

#### Firestore Data Formats (Inherited)

**Timestamps:** Firestore `serverTimestamp()`

```typescript
// ✅ Correct
{
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}

// ❌ Incorrect
{
  createdAt: new Date().toISOString(),
  created_at: Date.now()
}
```

**IDs:** Firestore auto-generated

```typescript
// ✅ Correct - let Firestore generate
const docRef = await addDoc(collection(db, 'assets'), data)

// ❌ Incorrect - manual IDs
await setDoc(doc(db, 'assets', 'custom-id'), data)
```

#### 3D Data Formats

**Positions:** Always `Vector3` internally, array in store

```typescript
// Store format (serializable)
interface VoxelNode {
  position: [number, number, number];  // Tuple for serialization
}

// Component usage (Three.js)
const position = useMemo(
  () => new Vector3(...node.position),
  [node.position]
);
```

**Colors:** Hex strings for storage, Three.js Color for rendering

```typescript
// Type definition
interface VoxelNode {
  color: string;  // '#FF5733'
}

// Component usage
<meshStandardMaterial color={new Color(node.color)} />
```

**Node Types:** String literal union

```typescript
// ✅ Correct
type NodeType = 'asset' | 'risk' | 'control';

// ❌ Incorrect
type NodeType = string;
enum NodeType { Asset, Risk, Control }
```

### Communication Patterns

#### Zustand Store Patterns

**Action Naming:** `verb` + `Noun`

```typescript
// ✅ Correct
selectNode: (id: string | null) => void
hoverNode: (id: string | null) => void
setFilters: (filters: FilterSet) => void
updateNodePositions: (positions: Map<string, Vector3>) => void
clearSelection: () => void

// ❌ Incorrect
nodeSelect: () => void
setSelectedNode: () => void  // Use 'select' not 'setSelected'
handleNodeClick: () => void  // No 'handle' prefix
```

**Selector Pattern:** Fine-grained with `subscribeWithSelector`

```typescript
// ✅ Correct - minimal subscription
const selectedId = useVoxelStore(state => state.selectedNodeId);
const filters = useVoxelStore(state => state.activeFilters, shallow);

// ❌ Incorrect - over-subscription
const { selectedNodeId, nodes, edges } = useVoxelStore();  // Too broad
```

**State Updates:** Immutable avec spread

```typescript
// ✅ Correct
set((state) => ({
  nodes: new Map(state.nodes).set(id, updatedNode)
}))

// ❌ Incorrect
set((state) => {
  state.nodes.set(id, updatedNode);  // Direct mutation
  return state;
})
```

#### Web Worker Communication

**Message Types:** Discriminated union

```typescript
// Main → Worker
type LayoutCommand =
  | { type: 'INIT'; nodes: GraphNode[]; edges: GraphEdge[] }
  | { type: 'UPDATE'; changes: NodeChange[] }
  | { type: 'STOP' };

// Worker → Main
type LayoutResult =
  | { type: 'TICK'; positions: Record<string, [number, number, number]> }
  | { type: 'STABLE'; finalPositions: Record<string, [number, number, number]> }
  | { type: 'ERROR'; message: string };
```

**Message Handling Pattern:**

```typescript
// ✅ Correct - exhaustive switch
worker.onmessage = (e: MessageEvent<LayoutResult>) => {
  switch (e.data.type) {
    case 'TICK':
      updatePositions(e.data.positions);
      break;
    case 'STABLE':
      finalizePositions(e.data.finalPositions);
      break;
    case 'ERROR':
      handleError(e.data.message);
      break;
  }
};
```

### Process Patterns

#### Error Handling

**WebGL Errors:** Graceful degradation

```typescript
// ✅ Correct pattern
const VoxelViewer: FC = () => {
  const capability = useWebGLCapability();

  if (capability === 'none') {
    return <VoxelFallback2D />;
  }

  return (
    <ErrorBoundary
      fallback={<VoxelFallback2D />}
      onError={(error) => ErrorLogger.handleErrorWithToast(
        error,
        'voxel.webglError',
        addToast
      )}
    >
      <VoxelCanvas />
    </ErrorBoundary>
  );
};
```

**Data Loading Errors:** Use existing `ErrorLogger`

```typescript
// ✅ Correct - Sentinel pattern
try {
  const data = await fetchVoxelData(orgId);
} catch (error) {
  ErrorLogger.handleErrorWithToast(error, 'voxel.loadError', addToast);
}
```

#### Loading States

**State Naming:** `is` + `Verb` + `ing`

```typescript
// ✅ Correct
isLoadingGraph: boolean
isCalculatingLayout: boolean
isAnimatingCamera: boolean

// ❌ Incorrect
graphLoading: boolean
layoutCalculating: boolean
loading: boolean  // Too generic
```

**Loading UI Pattern:**

```typescript
// ✅ Correct - within overlay, not blocking canvas
{isLoadingGraph && (
  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
    <Spinner />
    <span className="ml-2">{t('voxel.loading')}</span>
  </div>
)}
<Canvas>
  {/* Canvas renders even during load */}
</Canvas>
```

#### Animation Patterns

**Frame Loop:** Use `useFrame` from R3F

```typescript
// ✅ Correct
useFrame((state, delta) => {
  meshRef.current.rotation.y += delta * 0.5;
});

// ❌ Incorrect
useEffect(() => {
  const interval = setInterval(() => {
    // Animation logic
  }, 16);
  return () => clearInterval(interval);
}, []);
```

**Reduced Motion:** Respect `prefers-reduced-motion`

```typescript
// ✅ Correct
const prefersReduced = usePrefersReducedMotion();

useFrame((state, delta) => {
  if (!prefersReduced) {
    meshRef.current.rotation.y += delta * 0.5;
  }
});
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. ✅ Use `Voxel` prefix for all new components in this module
2. ✅ Place all types in `types/voxel.ts` - never inline complex types
3. ✅ Use `useVoxelStore` with fine-grained selectors
4. ✅ Handle WebGL failures with graceful fallback
5. ✅ Respect `prefers-reduced-motion` for all animations
6. ✅ Use `Vector3` class (not arrays) for 3D calculations
7. ✅ Follow existing Sentinel patterns for Firestore, toasts, and logging

**Pattern Enforcement:**

- PR reviews check naming conventions
- TypeScript strict mode catches type issues
- ESLint rules for import organization
- Vitest coverage requirements (>70%)

### Pattern Examples

#### Good Example: VoxelNode Component

```typescript
// components/voxel/nodes/VoxelNode.tsx
import { FC, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Vector3, Color } from 'three';
import type { VoxelNode as VoxelNodeType } from '@/types/voxel';
import { useVoxelStore } from '@/stores/voxelStore';
import { usePrefersReducedMotion } from '../hooks';

interface VoxelNodeProps {
  data: VoxelNodeType;
}

export const VoxelNode: FC<VoxelNodeProps> = ({ data }) => {
  const meshRef = useRef<Mesh>(null);
  const prefersReduced = usePrefersReducedMotion();
  const selectNode = useVoxelStore(state => state.selectNode);
  const isSelected = useVoxelStore(state => state.selectedNodeId === data.id);

  const position = useMemo(
    () => new Vector3(...data.position),
    [data.position]
  );

  const color = useMemo(
    () => new Color(data.color),
    [data.color]
  );

  useFrame((_, delta) => {
    if (!prefersReduced && isSelected && meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={() => selectNode(data.id)}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};
```

#### Anti-Patterns to Avoid

```typescript
// ❌ WRONG: Generic naming
const Node = () => {...}  // Missing Voxel prefix

// ❌ WRONG: Inline types
const MyComponent = ({ pos }: { pos: number[] }) => {...}

// ❌ WRONG: Direct store subscription
const store = useVoxelStore();  // Over-subscribes

// ❌ WRONG: Arrays instead of Vector3
const position = [1, 2, 3];  // Use new Vector3(1, 2, 3)

// ❌ WRONG: Ignoring reduced motion
useFrame(() => {
  mesh.rotation.y += 0.01;  // Always animates
});

// ❌ WRONG: No error boundary
<Canvas>  // Missing ErrorBoundary wrapper
  <VoxelScene />
</Canvas>
```

## Project Structure & Boundaries

### Complete Project Directory Structure

**Sentinel GRC avec Module Voxel 3D:**

```
sentinel-grc-v2-prod/
├── package.json                         # Updated with R3F deps
├── vite.config.ts                       # Existing (no changes needed)
├── tsconfig.json                        # Existing (no changes needed)
├── tailwind.config.js                   # Existing (no changes needed)
├── .env.local                           # Existing
├── .env.example                         # Existing
├── .gitignore                           # Existing
├── README.md                            # Existing
├── CLAUDE.md                            # Existing - project context
│
├── functions/                           # Existing Cloud Functions
│
├── public/                              # Existing static assets
│
├── src/
│   ├── App.tsx                          # Existing - add lazy route
│   ├── main.tsx                         # Existing entry
│   ├── index.css                        # Existing globals
│   ├── firebase.ts                      # Existing Firebase config
│   │
│   ├── components/
│   │   ├── ... (existing components)
│   │   │
│   │   └── voxel/                       # ✨ NEW: Voxel 3D Module
│   │       ├── index.ts                 # Public exports
│   │       ├── VoxelCanvas.tsx          # Main R3F Canvas wrapper
│   │       ├── VoxelScene.tsx           # Scene setup (lights, camera, controls)
│   │       ├── VoxelViewer.tsx          # Entry component with fallback
│   │       │
│   │       ├── nodes/
│   │       │   ├── index.ts
│   │       │   ├── VoxelNode.tsx        # Single node (standard mesh)
│   │       │   ├── VoxelNodeInstanced.tsx # Instanced rendering
│   │       │   ├── NodeHighDetail.tsx   # LOD high
│   │       │   ├── NodeMediumDetail.tsx # LOD medium
│   │       │   ├── NodeLowDetail.tsx    # LOD low
│   │       │   ├── AssetNode.tsx        # Asset-specific styling
│   │       │   ├── RiskNode.tsx         # Risk-specific styling
│   │       │   └── ControlNode.tsx      # Control-specific styling
│   │       │
│   │       ├── edges/
│   │       │   ├── index.ts
│   │       │   ├── VoxelEdge.tsx        # Line connection
│   │       │   ├── VoxelEdgeCurved.tsx  # Bezier curve
│   │       │   └── EdgeManager.tsx      # Edge collection renderer
│   │       │
│   │       ├── effects/
│   │       │   ├── index.ts
│   │       │   ├── SelectionGlow.tsx    # Selection highlight effect
│   │       │   ├── HoverOutline.tsx     # Hover outline
│   │       │   ├── ConnectionPulse.tsx  # Edge animation
│   │       │   └── BackgroundStars.tsx  # Galaxy background
│   │       │
│   │       ├── overlays/
│   │       │   ├── index.ts
│   │       │   ├── VoxelDetailPanel.tsx # Right slide-in panel
│   │       │   ├── VoxelMinimap.tsx     # Navigation minimap
│   │       │   ├── VoxelToolbar.tsx     # Top toolbar (filters, search)
│   │       │   ├── VoxelTooltip.tsx     # Hover tooltip
│   │       │   ├── VoxelLegend.tsx      # Color/shape legend
│   │       │   ├── VoxelStats.tsx       # Node counts, FPS
│   │       │   └── VoxelEmptyState.tsx  # No data placeholder
│   │       │
│   │       ├── controls/
│   │       │   ├── index.ts
│   │       │   ├── VoxelOrbitControls.tsx # Customized OrbitControls
│   │       │   ├── VoxelKeyboardNav.tsx   # Keyboard navigation
│   │       │   └── VoxelFocusManager.tsx  # Focus ring management
│   │       │
│   │       ├── hooks/
│   │       │   ├── index.ts
│   │       │   ├── useWebGLCapability.ts  # WebGL detection
│   │       │   ├── useNodeSelection.ts    # Selection logic
│   │       │   ├── useLayoutWorker.ts     # Web Worker comm
│   │       │   ├── useCameraAnimation.ts  # Smooth camera moves
│   │       │   ├── useVoxelData.ts        # Data fetching
│   │       │   ├── usePrefersReducedMotion.ts # Accessibility
│   │       │   ├── usePerformanceMonitor.ts   # FPS tracking
│   │       │   └── useResponsive3D.ts     # Breakpoint detection
│   │       │
│   │       ├── fallback/
│   │       │   ├── index.ts
│   │       │   ├── VoxelFallback2D.tsx    # 2D fallback view
│   │       │   └── VoxelErrorBoundary.tsx # Error boundary
│   │       │
│   │       └── __tests__/
│   │           ├── VoxelCanvas.test.tsx
│   │           ├── VoxelNode.test.tsx
│   │           ├── VoxelViewer.test.tsx
│   │           ├── overlays/
│   │           │   ├── VoxelDetailPanel.test.tsx
│   │           │   └── VoxelToolbar.test.tsx
│   │           └── hooks/
│   │               ├── useWebGLCapability.test.ts
│   │               ├── useNodeSelection.test.ts
│   │               └── useLayoutWorker.test.ts
│   │
│   ├── pages/
│   │   ├── ... (existing pages)
│   │   └── VoxelPage.tsx                # ✨ NEW: Voxel route page
│   │
│   ├── stores/
│   │   ├── index.ts                     # Existing main store
│   │   └── voxelStore.ts                # ✨ NEW: 3D state store
│   │
│   ├── services/
│   │   ├── ... (existing services)
│   │   │
│   │   └── voxel/                       # ✨ NEW: Voxel services
│   │       ├── index.ts
│   │       ├── GraphBuilder.ts          # Data → Graph transform
│   │       ├── LayoutEngine.ts          # Layout coordination
│   │       ├── LayoutEngine.worker.ts   # Web Worker (d3-force)
│   │       ├── VoxelDataTransform.ts    # Firestore → Voxel types
│   │       ├── NodeStyleResolver.ts     # Node colors/shapes
│   │       └── __tests__/
│   │           ├── GraphBuilder.test.ts
│   │           ├── LayoutEngine.test.ts
│   │           └── VoxelDataTransform.test.ts
│   │
│   ├── types/
│   │   ├── index.ts                     # Existing types
│   │   └── voxel.ts                     # ✨ NEW: All Voxel types
│   │
│   ├── hooks/
│   │   └── ... (existing hooks)         # No changes
│   │
│   ├── utils/
│   │   └── ... (existing utils)         # No changes
│   │
│   └── locales/
│       ├── en.json                      # Add voxel.* keys
│       └── fr.json                      # Add voxel.* keys
│
└── _bmad-output/
    └── planning-artifacts/
        ├── prd-voxel-module-2026-01-22.md
        ├── ux-design-voxel-module-2026-01-22.md
        └── architecture-voxel-module-2026-01-22.md
```

### Architectural Boundaries

#### Module Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                     Sentinel GRC Application                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Existing   │    │   Voxel 3D   │    │    Existing      │  │
│  │   Modules    │◄──►│    Module    │◄──►│    Services      │  │
│  │              │    │              │    │                  │  │
│  │ • Dashboard  │    │ • VoxelCanvas│    │ • Firebase       │  │
│  │ • Assets     │    │ • VoxelStore │    │ • React Query    │  │
│  │ • Risks      │    │ • Services   │    │ • ErrorLogger    │  │
│  │ • Controls   │    │              │    │                  │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│         │                    │                    │             │
│         └────────────────────┼────────────────────┘             │
│                              │                                  │
│                    ┌─────────▼─────────┐                        │
│                    │   Firestore DB    │                        │
│                    │ (shared data)     │                        │
│                    └───────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

#### API Boundaries

| Boundary | Pattern | Files |
|----------|---------|-------|
| **Firestore Access** | Via existing hooks | `useVoxelData.ts` uses existing Firebase patterns |
| **RBAC** | Via existing system | Filter nodes by `hasPermission()` |
| **Toasts** | Via `useStore().addToast` | All Voxel components use existing pattern |
| **Logging** | Via `ErrorLogger` | All errors through existing logger |
| **i18n** | Via `useStore().t()` | Add keys to `locales/*.json` |

#### Component Boundaries

**Voxel Module Internal:**
```
VoxelViewer (entry)
    │
    ├── VoxelCanvas (R3F)
    │   ├── VoxelScene
    │   │   ├── Nodes (3D)
    │   │   ├── Edges (3D)
    │   │   └── Effects (3D)
    │   └── OrbitControls
    │
    └── Overlays (HTML)
        ├── VoxelToolbar
        ├── VoxelDetailPanel
        ├── VoxelMinimap
        └── VoxelTooltip
```

**Boundary Rule:** 3D components (`<Canvas>` children) NEVER import HTML overlay components directly. Communication via `voxelStore` only.

#### Data Boundaries

**Data Flow Boundary:**

```
Firestore Collections          Voxel Module            3D Scene
┌─────────────────┐       ┌─────────────────┐     ┌──────────────┐
│ assets          │──────▶│ GraphBuilder    │────▶│ VoxelNode[]  │
│ risks           │       │ (transform)     │     │              │
│ controls        │       └────────┬────────┘     │ VoxelEdge[]  │
│ asset_risk_map  │                │              │              │
│ risk_control_map│       ┌────────▼────────┐     │ Positions    │
└─────────────────┘       │ LayoutEngine    │────▶│              │
                          │ (Web Worker)    │     └──────────────┘
                          └─────────────────┘
```

**Boundary Rules:**
- Firestore data NEVER passes directly to 3D components
- All data transforms through `GraphBuilder`
- Layout calculations ONLY in Web Worker
- Store holds serializable data (arrays, not Vector3)

### Requirements to Structure Mapping

#### FR Category → File Mapping

| FR Category | Primary Files | Tests |
|-------------|---------------|-------|
| **FR1-FR4: Canvas & Rendering** | `VoxelCanvas.tsx`, `VoxelScene.tsx` | `VoxelCanvas.test.tsx` |
| **FR5-FR10: Node Visualization** | `nodes/*.tsx`, `NodeStyleResolver.ts` | `VoxelNode.test.tsx` |
| **FR11-FR14: Edges** | `edges/*.tsx`, `EdgeManager.tsx` | `VoxelEdge.test.tsx` |
| **FR15-FR21: Navigation** | `controls/*.tsx`, hooks | `useNodeSelection.test.ts` |
| **FR22-FR26: Filtering** | `VoxelToolbar.tsx`, `voxelStore.ts` | `VoxelToolbar.test.tsx` |
| **FR27-FR30: Data Integration** | `services/voxel/*.ts` | `GraphBuilder.test.ts` |
| **FR31-FR35: Detail Panel** | `VoxelDetailPanel.tsx` | `VoxelDetailPanel.test.tsx` |
| **FR36-FR39: Accessibility** | hooks, `usePrefersReducedMotion.ts` | Accessibility tests |
| **FR40-FR44: Security/RBAC** | `useVoxelData.ts` (filtering) | Permission tests |
| **FR45-FR52: MVP+ Features** | Future files | Future tests |

#### Cross-Cutting Concerns Mapping

| Concern | Implementation Location |
|---------|------------------------|
| **Performance Monitoring** | `usePerformanceMonitor.ts` |
| **WebGL Detection** | `useWebGLCapability.ts` |
| **Error Boundaries** | `VoxelErrorBoundary.tsx` |
| **Reduced Motion** | `usePrefersReducedMotion.ts` |
| **Responsive Fallback** | `useResponsive3D.ts`, `VoxelFallback2D.tsx` |
| **Internationalization** | `locales/*.json` (voxel.* keys) |

### Integration Points

#### Internal Communication

**Store → Components:**
```typescript
// 3D components subscribe to voxelStore
const selectedId = useVoxelStore(s => s.selectedNodeId);

// Overlays also subscribe
const filters = useVoxelStore(s => s.activeFilters);
```

**Worker → Main Thread:**
```typescript
// LayoutEngine.worker.ts → useLayoutWorker.ts
worker.postMessage({ type: 'INIT', nodes, edges });
worker.onmessage = (e) => updateNodePositions(e.data.positions);
```

**Events (DOM → 3D):**
```typescript
// Overlay button → Store action → 3D reacts
<button onClick={() => useVoxelStore.getState().clearSelection()}>
  Clear Selection
</button>
```

#### External Integrations

| Integration | Entry Point | Pattern |
|-------------|-------------|---------|
| **Firestore** | `useVoxelData.ts` | React Query + onSnapshot |
| **Firebase Auth** | Inherited | RBAC via `hasPermission()` |
| **Navigation** | `VoxelPage.tsx` | React Router lazy load |
| **Toast System** | `useStore().addToast` | Existing pattern |
| **Error Logging** | `ErrorLogger` | Existing service |

#### Data Flow

```
User Action → Store Action → State Update → React Re-render
     │
     ├── Click node → selectNode(id) → selectedNodeId updates →
     │   → VoxelNode re-renders with selection → DetailPanel opens
     │
     ├── Filter change → setFilters() → visibleNodeTypes updates →
     │   → VoxelScene filters nodes → Node count updates
     │
     └── Camera move → focusCameraOn(id) → cameraTarget updates →
         → useCameraAnimation interpolates → OrbitControls moves
```

### File Organization Patterns

#### Configuration Files (Existing - Minimal Changes)

| File | Change | Purpose |
|------|--------|---------|
| `package.json` | Add deps | R3F, Three.js, @types/three |
| `vite.config.ts` | None | Vite handles R3F |
| `tsconfig.json` | None | Strict mode already enabled |
| `tailwind.config.js` | None | Existing classes work |

#### Source Organization

**Component Co-location Pattern:**
```
components/voxel/nodes/
├── VoxelNode.tsx          # Component
├── VoxelNode.types.ts     # ❌ NO - use types/voxel.ts
└── __tests__/
    └── VoxelNode.test.tsx # Test
```

**Service Organization Pattern:**
```
services/voxel/
├── GraphBuilder.ts        # Service
├── GraphBuilder.worker.ts # Web Worker (if needed)
└── __tests__/
    └── GraphBuilder.test.ts
```

#### Test Organization

**Test Naming:**
- `*.test.tsx` - React component tests
- `*.test.ts` - Service/utility tests
- `*.spec.ts` - Never use (consistency)

**Test Location:**
- Always in `__tests__/` subdirectory of module
- Mirror source structure inside `__tests__/`

**Mocking Pattern:**
```typescript
// __tests__/VoxelNode.test.tsx
vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn()
}));
```

### Development Workflow Integration

#### Route Integration

```typescript
// App.tsx - Add lazy-loaded route
const VoxelPage = lazy(() => import('./pages/VoxelPage'));

<Route path="/voxel" element={
  <Suspense fallback={<LoadingSpinner />}>
    <VoxelPage />
  </Suspense>
} />
```

#### Build Process

**Chunk Splitting (Automatic via Vite):**
```
dist/
├── index.js           # Main bundle
├── voxel-[hash].js    # Voxel module chunk (lazy)
└── three-[hash].js    # Three.js vendor chunk
```

**Tree Shaking:**
```typescript
// ✅ Correct - tree-shakeable
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// ❌ Incorrect - imports everything
import * as THREE from 'three';
```

#### Development Tools

**Recommended Browser Extensions:**
- React DevTools (existing)
- Three.js Inspector
- Zustand DevTools

**Debug UI (Dev Only):**
```typescript
// VoxelScene.tsx
{import.meta.env.DEV && <Leva collapsed />}
```

## Architecture Validation Results

### Coherence Validation ✅

#### Decision Compatibility

| Decision Pair | Compatibility | Notes |
|---------------|---------------|-------|
| R3F + Zustand | ✅ Compatible | Zustand recommandé par R3F docs |
| Three.js + Vite | ✅ Compatible | Tree-shaking natif |
| d3-force + Web Worker | ✅ Compatible | Calculs isolés, pas de conflits |
| React Query + Firestore | ✅ Compatible | Pattern existant Sentinel |
| InstancedMesh + LOD | ✅ Compatible | Complémentaires pour performance |
| TypeScript strict + R3F | ✅ Compatible | Types @types/three disponibles |

**Version Compatibility Matrix:**

```
React 19         ─┬─ @react-three/fiber ^8.x  ✅
                  │
Three.js ^0.160.x ─┤
                  │
@react-three/drei ^9.x ─┘
                  │
Zustand ^4.x ─────┘
                  │
d3-force ^3.x ────┘ (standalone, pas de conflit)
```

**Aucune décision contradictoire détectée.**

#### Pattern Consistency

| Pattern Category | Consistency | Verification |
|------------------|-------------|--------------|
| Naming (Voxel prefix) | ✅ Consistent | Tous composants 3D préfixés |
| Store patterns | ✅ Consistent | Zustand + selectors partout |
| Error handling | ✅ Consistent | ErrorLogger + ErrorBoundary |
| Test patterns | ✅ Consistent | `__tests__/` + Vitest |
| Import paths | ✅ Consistent | `@/` alias existant |

#### Structure Alignment

| Structure Element | Decision Support | Verification |
|-------------------|------------------|--------------|
| `components/voxel/` | ✅ Supports R3F component isolation |
| `services/voxel/` | ✅ Supports GraphBuilder/LayoutEngine separation |
| `stores/voxelStore.ts` | ✅ Supports dedicated 3D state |
| `types/voxel.ts` | ✅ Supports centralized type definitions |
| `*.worker.ts` | ✅ Supports Web Worker layout |
| `__tests__/` | ✅ Supports co-located testing |

### Requirements Coverage Validation ✅

#### Functional Requirements Coverage (52 FRs)

| FR Category | FRs | Coverage | Architectural Support |
|-------------|-----|----------|----------------------|
| 3D Canvas & Rendering | FR1-FR4 | ✅ 100% | VoxelCanvas, VoxelScene, WebGL detection |
| Node Visualization | FR5-FR10 | ✅ 100% | VoxelNode, NodeStyleResolver, LOD |
| Edge & Connections | FR11-FR14 | ✅ 100% | VoxelEdge, EdgeManager |
| Navigation & Interaction | FR15-FR21 | ✅ 100% | OrbitControls, useNodeSelection |
| Filtering & Search | FR22-FR26 | ✅ 100% | VoxelToolbar, voxelStore filters |
| Data Integration | FR27-FR30 | ✅ 100% | useVoxelData, GraphBuilder, Firestore |
| Detail Panel | FR31-FR35 | ✅ 100% | VoxelDetailPanel |
| Accessibility | FR36-FR39 | ✅ 100% | usePrefersReducedMotion, ARIA, keyboard nav |
| Security & RBAC | FR40-FR44 | ✅ 100% | Inherited RBAC, filtered queries |
| MVP+ Features | FR45-FR52 | ⏳ Deferred | Structure prête, implémentation post-MVP |

**FR Coverage Summary:** 44/44 MVP FRs covered (100%), 8 MVP+ deferred.

#### Non-Functional Requirements Coverage

| NFR Category | Requirement | Architectural Support | Status |
|--------------|-------------|----------------------|--------|
| **Performance** | 60 FPS (1K nodes) | Standard Mesh | ✅ |
| | 30 FPS (10K-50K nodes) | InstancedMesh + LOD | ✅ |
| | <2s initial load | Lazy loading + code splitting | ✅ |
| | <100ms interaction | Zustand selectors | ✅ |
| **Scalability** | 1K → 50K+ nodes | InstancedMesh + Web Worker layout | ✅ |
| **Security** | RBAC filtering | Inherited from Sentinel | ✅ |
| | No client cache | Firestore direct, no localStorage | ✅ |
| | Audit trail | Existing logging service | ✅ |
| **Accessibility** | WCAG 2.1 AA | Keyboard nav, ARIA, reduced motion | ✅ |
| | Daltonisme-safe | Shape + color coding | ✅ |
| **Reliability** | WebGL fallback | useWebGLCapability + Fallback2D | ✅ |
| | Error recovery | ErrorBoundary pattern | ✅ |
| **Maintainability** | >70% test coverage | Test structure defined | ✅ |
| | <500KB bundle | Code splitting Three.js | ✅ |

### Implementation Readiness Validation ✅

#### Decision Completeness

| Aspect | Status | Evidence |
|--------|--------|----------|
| Critical decisions documented | ✅ | 7 major decisions with rationale |
| Technology versions specified | ✅ | R3F ^8.x, Three.js ^0.160.x, etc. |
| Implementation patterns defined | ✅ | Naming, structure, communication |
| Examples provided | ✅ | Good/bad examples for each pattern |
| Enforcement guidelines | ✅ | 7 mandatory rules for AI agents |

#### Structure Completeness

| Element | Status | Count |
|---------|--------|-------|
| Components defined | ✅ | 25+ components |
| Hooks defined | ✅ | 8 hooks |
| Services defined | ✅ | 5 services |
| Test locations | ✅ | Mirrored structure |
| Integration points | ✅ | 5 external integrations |

#### Pattern Completeness

| Pattern Type | Completeness | Examples |
|--------------|--------------|----------|
| Naming conventions | ✅ Complete | Component, hook, service, type |
| File organization | ✅ Complete | Co-location rules |
| State management | ✅ Complete | Actions, selectors, updates |
| Error handling | ✅ Complete | WebGL, data, boundaries |
| Communication | ✅ Complete | Store, worker, events |

### Gap Analysis Results

#### Critical Gaps: None ✅

Aucun gap critique bloquant l'implémentation.

#### Important Gaps (Addressables Post-MVP)

| Gap | Impact | Mitigation |
|-----|--------|------------|
| Performance benchmarks | Medium | Add monitoring in first sprint |
| E2E test strategy | Medium | Playwright visual tests post-MVP |
| Minimap implementation detail | Low | Defer to MVP+ |

#### Nice-to-Have Gaps

| Gap | Description |
|-----|-------------|
| Debug tooling | Leva configuration examples |
| Storybook stories | Visual component documentation |
| Performance profiling guide | Three.js inspector usage |

### Validation Issues Addressed

**Issue #1: Web Worker Type Safety**
- **Found:** Worker message types could benefit from runtime validation
- **Resolution:** Discriminated unions already defined, Zod validation optional

**Issue #2: Mobile Fallback Completeness**
- **Found:** 2D fallback needs UI specification
- **Resolution:** Deferred to implementation, architecture supports fallback

**Issue #3: Firestore Query Efficiency**
- **Found:** Large org data could cause slow initial loads
- **Resolution:** React Query staleTime + pagination ready in structure

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (52 FRs, NFRs)
- [x] Scale and complexity assessed (1K→50K nodes)
- [x] Technical constraints identified (WebGL, browsers, mobile)
- [x] Cross-cutting concerns mapped (7 concerns)

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions (7 decisions)
- [x] Technology stack fully specified (R3F, Three.js, Zustand)
- [x] Integration patterns defined (Firestore, RBAC, i18n)
- [x] Performance considerations addressed (InstancedMesh, LOD, Workers)

**✅ Implementation Patterns**

- [x] Naming conventions established (components, hooks, types)
- [x] Structure patterns defined (co-location, boundaries)
- [x] Communication patterns specified (store, worker, events)
- [x] Process patterns documented (errors, loading, animations)

**✅ Project Structure**

- [x] Complete directory structure defined (40+ files mapped)
- [x] Component boundaries established (3D vs HTML)
- [x] Integration points mapped (5 external integrations)
- [x] Requirements to structure mapping complete (FR → files)

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

- Toutes les décisions critiques documentées
- Patterns complets avec exemples
- Structure alignée avec Sentinel existant
- Aucun gap bloquant identifié

**Key Strengths:**

1. **Brownfield Integration** - Réutilise patterns Sentinel éprouvés
2. **Performance Architecture** - InstancedMesh + LOD + Workers dès la conception
3. **Accessibility First** - WCAG 2.1 AA intégré dans l'architecture
4. **Graceful Degradation** - Fallback WebGL/Mobile prévu
5. **Type Safety** - TypeScript strict + types centralisés
6. **Test Strategy** - Multi-layer testing défini

**Areas for Future Enhancement:**

1. Multi-user collaboration (curseurs partagés)
2. Export 3D (glTF, screenshots)
3. AR/VR extensions
4. Advanced clustering algorithms
5. Custom shader effects

### Implementation Handoff

**AI Agent Guidelines:**

1. ✅ Suivre TOUTES les décisions architecturales exactement comme documentées
2. ✅ Utiliser les patterns d'implémentation de manière cohérente
3. ✅ Respecter la structure projet et les boundaries
4. ✅ Référencer ce document pour TOUTES les questions architecturales
5. ✅ Préfixer TOUS les composants avec `Voxel`
6. ✅ Placer TOUS les types dans `types/voxel.ts`
7. ✅ Utiliser `useVoxelStore` avec selectors fine-grained

**First Implementation Priority:**

```bash
# 1. Installer les dépendances
npm install @react-three/fiber@^8 three@^0.160 @react-three/drei@^9
npm install -D @types/three

# 2. Créer la structure de base
mkdir -p src/components/voxel/{nodes,edges,effects,overlays,controls,hooks,fallback,__tests__}
mkdir -p src/services/voxel/__tests__

# 3. Créer les fichiers fondation
touch src/types/voxel.ts
touch src/stores/voxelStore.ts
touch src/pages/VoxelPage.tsx
```

**Implementation Sequence:**
1. Foundation: voxelStore, types, WebGL detection
2. Canvas: VoxelCanvas, VoxelScene, basic node
3. Layout: GraphBuilder, LayoutEngine worker
4. Interaction: Selection, hover, detail panel
5. Optimization: InstancedMesh, LOD, performance

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-22
**Document Location:** `_bmad-output/planning-artifacts/architecture-voxel-module-2026-01-22.md`

### Final Architecture Deliverables

**📋 Complete Architecture Document**

- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**🏗️ Implementation Ready Foundation**

- 7 architectural decisions made
- 12 implementation patterns defined
- 40+ architectural components specified
- 52 requirements fully supported (44 MVP + 8 deferred)

**📚 AI Agent Implementation Guide**

- Technology stack with verified versions (R3F ^8.x, Three.js ^0.160.x)
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries (3D vs HTML)
- Integration patterns and communication standards

### Quality Assurance Checklist

**✅ Architecture Coherence**

- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**

- [x] All functional requirements are supported
- [x] All non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined

**✅ Implementation Readiness**

- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

### Project Success Factors

**🎯 Clear Decision Framework**
Every technology choice was made collaboratively with clear rationale, ensuring all stakeholders understand the architectural direction.

**🔧 Consistency Guarantee**
Implementation patterns and rules ensure that multiple AI agents will produce compatible, consistent code that works together seamlessly.

**📋 Complete Coverage**
All project requirements are architecturally supported, with clear mapping from business needs to technical implementation.

**🏗️ Solid Foundation**
The brownfield integration approach leverages existing Sentinel patterns while adding cutting-edge 3D capabilities.

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

