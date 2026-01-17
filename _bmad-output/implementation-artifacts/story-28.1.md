# Story 28.1: Zustand Store pour Voxel State

## Metadata
- **Story ID:** 28.1
- **Epic:** 28 - Synchronisation Temps Réel
- **Priority:** P0
- **Story Points:** 5
- **Status:** in-progress
- **Created:** 2026-01-17
- **FR Reference:** FR-VOXEL-001

## Description

**As a** developer,
**I want** a centralized Zustand store for Voxel state management,
**So that** real-time updates can be efficiently propagated to all components.

## Acceptance Criteria

### AC1: Store Initialization
```gherkin
Given the Voxel module is loaded
When I initialize the store
Then it should contain nodes, edges, anomalies, filters, and UI state
```

### AC2: Component Subscription
```gherkin
Given multiple components subscribe to the store
When a node is updated
Then all subscribed components should re-render with new data
```

### AC3: Persistence
```gherkin
Given user closes the Voxel view
When they reopen it
Then persisted preferences (filters, view) should be restored from localStorage
```

## Technical Implementation

### 1. Types & Interfaces

```typescript
// src/types/voxel.ts
import { Vector3 } from 'three';

export type VoxelNodeType =
  | 'asset'
  | 'risk'
  | 'control'
  | 'incident'
  | 'supplier'
  | 'project'
  | 'audit';

export type VoxelNodeStatus =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'inactive';

export interface VoxelNode {
  id: string;
  type: VoxelNodeType;
  label: string;
  status: VoxelNodeStatus;
  position: { x: number; y: number; z: number };
  data: Record<string, unknown>;
  connections: string[]; // IDs of connected nodes
  anomalyIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VoxelEdge {
  id: string;
  source: string;
  target: string;
  type: 'dependency' | 'mitigation' | 'assignment' | 'impact';
  weight: number;
}

export interface VoxelAnomaly {
  id: string;
  type: 'orphan' | 'stale' | 'inconsistency' | 'cycle' | 'cluster' | 'trend';
  severity: 'low' | 'medium' | 'high' | 'critical';
  nodeId: string;
  message: string;
  detectedAt: Date;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
}

export interface VoxelFilters {
  nodeTypes: VoxelNodeType[];
  statuses: VoxelNodeStatus[];
  dateRange?: { start: Date; end: Date };
  searchQuery: string;
  showAnomaliesOnly: boolean;
}

export interface VoxelUIState {
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  zoom: number;
  showLabels: boolean;
  showEdges: boolean;
  layoutType: 'force' | 'hierarchical' | 'radial' | 'timeline';
}

export interface VoxelSyncState {
  status: 'connected' | 'syncing' | 'offline';
  lastSyncAt: Date | null;
  pendingChanges: number;
}

export type ViewPreset = 'executive' | 'rssi' | 'auditor' | 'soc' | 'compliance' | 'custom';
```

### 2. Zustand Store

```typescript
// src/stores/voxelStore.ts
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  VoxelNode,
  VoxelEdge,
  VoxelAnomaly,
  VoxelFilters,
  VoxelUIState,
  VoxelSyncState,
  ViewPreset,
  VoxelNodeType
} from '@/types/voxel';

interface VoxelState {
  // Data
  nodes: Map<string, VoxelNode>;
  edges: Map<string, VoxelEdge>;
  anomalies: Map<string, VoxelAnomaly>;

  // UI State
  filters: VoxelFilters;
  ui: VoxelUIState;
  sync: VoxelSyncState;
  activePreset: ViewPreset;

  // Computed
  filteredNodeIds: string[];
  visibleEdgeIds: string[];
  dataHealthScore: number;

  // Node Actions
  setNodes: (nodes: VoxelNode[]) => void;
  addNode: (node: VoxelNode) => void;
  updateNode: (id: string, updates: Partial<VoxelNode>) => void;
  removeNode: (id: string) => void;

  // Edge Actions
  setEdges: (edges: VoxelEdge[]) => void;
  computeEdges: () => void;

  // Anomaly Actions
  setAnomalies: (anomalies: VoxelAnomaly[]) => void;
  addAnomaly: (anomaly: VoxelAnomaly) => void;
  acknowledgeAnomaly: (id: string, userId: string) => void;
  dismissAnomaly: (id: string, reason: string) => void;
  resolveAnomaly: (id: string) => void;

  // Filter Actions
  setFilters: (filters: Partial<VoxelFilters>) => void;
  resetFilters: () => void;
  toggleNodeType: (type: VoxelNodeType) => void;

  // UI Actions
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  setCameraPosition: (position: { x: number; y: number; z: number }) => void;
  setCameraTarget: (target: { x: number; y: number; z: number }) => void;
  setZoom: (zoom: number) => void;
  toggleLabels: () => void;
  toggleEdges: () => void;
  setLayoutType: (type: VoxelUIState['layoutType']) => void;

  // Sync Actions
  setSyncStatus: (status: VoxelSyncState['status']) => void;
  setLastSyncAt: (date: Date) => void;

  // Preset Actions
  applyPreset: (preset: ViewPreset) => void;

  // Batch Actions
  batchUpdate: (updates: {
    added?: VoxelNode[];
    modified?: VoxelNode[];
    removed?: string[];
  }) => void;

  // Reset
  reset: () => void;
}

const DEFAULT_FILTERS: VoxelFilters = {
  nodeTypes: ['asset', 'risk', 'control', 'incident', 'supplier', 'project', 'audit'],
  statuses: ['normal', 'warning', 'critical', 'inactive'],
  searchQuery: '',
  showAnomaliesOnly: false,
};

const DEFAULT_UI: VoxelUIState = {
  selectedNodeId: null,
  hoveredNodeId: null,
  cameraPosition: { x: 0, y: 10, z: 20 },
  cameraTarget: { x: 0, y: 0, z: 0 },
  zoom: 1,
  showLabels: true,
  showEdges: true,
  layoutType: 'force',
};

const DEFAULT_SYNC: VoxelSyncState = {
  status: 'syncing',
  lastSyncAt: null,
  pendingChanges: 0,
};

export const useVoxelStore = create<VoxelState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial State
          nodes: new Map(),
          edges: new Map(),
          anomalies: new Map(),
          filters: DEFAULT_FILTERS,
          ui: DEFAULT_UI,
          sync: DEFAULT_SYNC,
          activePreset: 'rssi',
          filteredNodeIds: [],
          visibleEdgeIds: [],
          dataHealthScore: 100,

          // Node Actions
          setNodes: (nodes) => set((state) => {
            state.nodes = new Map(nodes.map(n => [n.id, n]));
            // Recompute filtered nodes
            state.filteredNodeIds = computeFilteredNodes(state.nodes, state.filters);
          }),

          addNode: (node) => set((state) => {
            state.nodes.set(node.id, node);
            state.filteredNodeIds = computeFilteredNodes(state.nodes, state.filters);
          }),

          updateNode: (id, updates) => set((state) => {
            const node = state.nodes.get(id);
            if (node) {
              state.nodes.set(id, { ...node, ...updates, updatedAt: new Date() });
            }
          }),

          removeNode: (id) => set((state) => {
            state.nodes.delete(id);
            state.filteredNodeIds = computeFilteredNodes(state.nodes, state.filters);
            // Also remove edges connected to this node
            for (const [edgeId, edge] of state.edges) {
              if (edge.source === id || edge.target === id) {
                state.edges.delete(edgeId);
              }
            }
          }),

          // Edge Actions
          setEdges: (edges) => set((state) => {
            state.edges = new Map(edges.map(e => [e.id, e]));
            state.visibleEdgeIds = computeVisibleEdges(state.edges, state.filteredNodeIds);
          }),

          computeEdges: () => set((state) => {
            // Compute edges based on node connections
            const edges: VoxelEdge[] = [];
            for (const node of state.nodes.values()) {
              for (const targetId of node.connections) {
                if (state.nodes.has(targetId)) {
                  edges.push({
                    id: `${node.id}-${targetId}`,
                    source: node.id,
                    target: targetId,
                    type: 'dependency',
                    weight: 1,
                  });
                }
              }
            }
            state.edges = new Map(edges.map(e => [e.id, e]));
            state.visibleEdgeIds = computeVisibleEdges(state.edges, state.filteredNodeIds);
          }),

          // Anomaly Actions
          setAnomalies: (anomalies) => set((state) => {
            state.anomalies = new Map(anomalies.map(a => [a.id, a]));
            state.dataHealthScore = computeDataHealthScore(anomalies);
          }),

          addAnomaly: (anomaly) => set((state) => {
            state.anomalies.set(anomaly.id, anomaly);
            state.dataHealthScore = computeDataHealthScore(Array.from(state.anomalies.values()));
          }),

          acknowledgeAnomaly: (id, userId) => set((state) => {
            const anomaly = state.anomalies.get(id);
            if (anomaly) {
              state.anomalies.set(id, { ...anomaly, status: 'acknowledged' });
            }
          }),

          dismissAnomaly: (id, reason) => set((state) => {
            const anomaly = state.anomalies.get(id);
            if (anomaly) {
              state.anomalies.set(id, { ...anomaly, status: 'dismissed' });
            }
          }),

          resolveAnomaly: (id) => set((state) => {
            const anomaly = state.anomalies.get(id);
            if (anomaly) {
              state.anomalies.set(id, { ...anomaly, status: 'resolved' });
            }
          }),

          // Filter Actions
          setFilters: (filters) => set((state) => {
            state.filters = { ...state.filters, ...filters };
            state.filteredNodeIds = computeFilteredNodes(state.nodes, state.filters);
            state.visibleEdgeIds = computeVisibleEdges(state.edges, state.filteredNodeIds);
          }),

          resetFilters: () => set((state) => {
            state.filters = DEFAULT_FILTERS;
            state.filteredNodeIds = computeFilteredNodes(state.nodes, state.filters);
            state.visibleEdgeIds = computeVisibleEdges(state.edges, state.filteredNodeIds);
          }),

          toggleNodeType: (type) => set((state) => {
            const types = state.filters.nodeTypes;
            if (types.includes(type)) {
              state.filters.nodeTypes = types.filter(t => t !== type);
            } else {
              state.filters.nodeTypes = [...types, type];
            }
            state.filteredNodeIds = computeFilteredNodes(state.nodes, state.filters);
            state.visibleEdgeIds = computeVisibleEdges(state.edges, state.filteredNodeIds);
          }),

          // UI Actions
          selectNode: (id) => set((state) => {
            state.ui.selectedNodeId = id;
          }),

          hoverNode: (id) => set((state) => {
            state.ui.hoveredNodeId = id;
          }),

          setCameraPosition: (position) => set((state) => {
            state.ui.cameraPosition = position;
          }),

          setCameraTarget: (target) => set((state) => {
            state.ui.cameraTarget = target;
          }),

          setZoom: (zoom) => set((state) => {
            state.ui.zoom = zoom;
          }),

          toggleLabels: () => set((state) => {
            state.ui.showLabels = !state.ui.showLabels;
          }),

          toggleEdges: () => set((state) => {
            state.ui.showEdges = !state.ui.showEdges;
          }),

          setLayoutType: (type) => set((state) => {
            state.ui.layoutType = type;
          }),

          // Sync Actions
          setSyncStatus: (status) => set((state) => {
            state.sync.status = status;
          }),

          setLastSyncAt: (date) => set((state) => {
            state.sync.lastSyncAt = date;
          }),

          // Preset Actions
          applyPreset: (preset) => set((state) => {
            state.activePreset = preset;
            const presetConfig = VIEW_PRESETS[preset];
            if (presetConfig) {
              state.filters.nodeTypes = presetConfig.layers;
              state.ui.layoutType = presetConfig.layout;
              state.ui.cameraPosition = presetConfig.camera.position;
              state.ui.cameraTarget = presetConfig.camera.target;
            }
          }),

          // Batch Actions
          batchUpdate: (updates) => set((state) => {
            if (updates.added) {
              for (const node of updates.added) {
                state.nodes.set(node.id, node);
              }
            }
            if (updates.modified) {
              for (const node of updates.modified) {
                const existing = state.nodes.get(node.id);
                if (existing) {
                  state.nodes.set(node.id, { ...existing, ...node });
                }
              }
            }
            if (updates.removed) {
              for (const id of updates.removed) {
                state.nodes.delete(id);
              }
            }
            state.filteredNodeIds = computeFilteredNodes(state.nodes, state.filters);
          }),

          // Reset
          reset: () => set((state) => {
            state.nodes = new Map();
            state.edges = new Map();
            state.anomalies = new Map();
            state.filters = DEFAULT_FILTERS;
            state.ui = DEFAULT_UI;
            state.sync = DEFAULT_SYNC;
            state.filteredNodeIds = [];
            state.visibleEdgeIds = [];
            state.dataHealthScore = 100;
          }),
        }))
      ),
      {
        name: 'voxel-storage',
        partialize: (state) => ({
          filters: state.filters,
          ui: {
            showLabels: state.ui.showLabels,
            showEdges: state.ui.showEdges,
            layoutType: state.ui.layoutType,
          },
          activePreset: state.activePreset,
        }),
      }
    ),
    { name: 'VoxelStore' }
  )
);

// Helper functions
function computeFilteredNodes(
  nodes: Map<string, VoxelNode>,
  filters: VoxelFilters
): string[] {
  const result: string[] = [];

  for (const [id, node] of nodes) {
    // Filter by node type
    if (!filters.nodeTypes.includes(node.type)) continue;

    // Filter by status
    if (!filters.statuses.includes(node.status)) continue;

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      if (!node.label.toLowerCase().includes(query)) continue;
    }

    // Filter by anomalies only
    if (filters.showAnomaliesOnly && (!node.anomalyIds || node.anomalyIds.length === 0)) {
      continue;
    }

    // Filter by date range
    if (filters.dateRange) {
      const nodeDate = node.updatedAt;
      if (nodeDate < filters.dateRange.start || nodeDate > filters.dateRange.end) {
        continue;
      }
    }

    result.push(id);
  }

  return result;
}

function computeVisibleEdges(
  edges: Map<string, VoxelEdge>,
  visibleNodeIds: string[]
): string[] {
  const visibleSet = new Set(visibleNodeIds);
  const result: string[] = [];

  for (const [id, edge] of edges) {
    if (visibleSet.has(edge.source) && visibleSet.has(edge.target)) {
      result.push(id);
    }
  }

  return result;
}

function computeDataHealthScore(anomalies: VoxelAnomaly[]): number {
  const activeAnomalies = anomalies.filter(a => a.status === 'active');
  if (activeAnomalies.length === 0) return 100;

  const weights = { critical: 20, high: 10, medium: 5, low: 2 };
  const totalPenalty = activeAnomalies.reduce((sum, a) => sum + weights[a.severity], 0);

  return Math.max(0, 100 - totalPenalty);
}

// View Presets Configuration
const VIEW_PRESETS: Record<ViewPreset, {
  layers: VoxelNodeType[];
  layout: VoxelUIState['layoutType'];
  camera: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } };
}> = {
  executive: {
    layers: ['risk', 'project'],
    layout: 'hierarchical',
    camera: { position: { x: 0, y: 30, z: 30 }, target: { x: 0, y: 0, z: 0 } },
  },
  rssi: {
    layers: ['asset', 'risk', 'control', 'incident', 'supplier'],
    layout: 'force',
    camera: { position: { x: 0, y: 15, z: 25 }, target: { x: 0, y: 0, z: 0 } },
  },
  auditor: {
    layers: ['control', 'audit', 'risk'],
    layout: 'hierarchical',
    camera: { position: { x: 0, y: 20, z: 20 }, target: { x: 0, y: 0, z: 0 } },
  },
  soc: {
    layers: ['incident', 'asset', 'supplier'],
    layout: 'timeline',
    camera: { position: { x: 0, y: 10, z: 30 }, target: { x: 0, y: 0, z: 0 } },
  },
  compliance: {
    layers: ['control', 'risk', 'audit'],
    layout: 'radial',
    camera: { position: { x: 0, y: 25, z: 25 }, target: { x: 0, y: 0, z: 0 } },
  },
  custom: {
    layers: ['asset', 'risk', 'control', 'incident', 'supplier', 'project', 'audit'],
    layout: 'force',
    camera: { position: { x: 0, y: 10, z: 20 }, target: { x: 0, y: 0, z: 0 } },
  },
};

// Selector hooks for optimized subscriptions
export const useVoxelNodes = () => useVoxelStore((s) => s.nodes);
export const useVoxelFilters = () => useVoxelStore((s) => s.filters);
export const useVoxelUI = () => useVoxelStore((s) => s.ui);
export const useVoxelSync = () => useVoxelStore((s) => s.sync);
export const useVoxelAnomalies = () => useVoxelStore((s) => s.anomalies);
export const useFilteredNodeIds = () => useVoxelStore((s) => s.filteredNodeIds);
export const useDataHealthScore = () => useVoxelStore((s) => s.dataHealthScore);
export const useSelectedNode = () => {
  const nodes = useVoxelStore((s) => s.nodes);
  const selectedId = useVoxelStore((s) => s.ui.selectedNodeId);
  return selectedId ? nodes.get(selectedId) : null;
};
```

## Tasks

- [x] Create `src/types/voxel.ts` with all type definitions
- [x] Create `src/stores/voxelStore.ts` with Zustand store
- [x] Implement node CRUD actions
- [x] Implement edge computation
- [x] Implement anomaly management
- [x] Implement filter actions
- [x] Implement UI state management
- [x] Add localStorage persistence for preferences
- [x] Create selector hooks for optimized subscriptions
- [x] Add VIEW_PRESETS configuration
- [ ] Write unit tests for store actions
- [ ] Test persistence across browser sessions

## Dependencies

- zustand ^4.5.0
- immer ^10.0.0

## Definition of Done

- [ ] Store created with all slices (nodes, edges, anomalies, filters, ui, sync)
- [ ] O(1) node access via Map<string, VoxelNode>
- [ ] computeEdges() function working
- [ ] Persistence working for user preferences
- [ ] Selector hooks exported for component use
- [ ] VIEW_PRESETS defined for all roles
- [ ] Unit tests passing with >80% coverage

## Notes

- Using Map instead of array for O(1) lookups
- immer middleware allows mutable-style updates
- subscribeWithSelector for fine-grained subscriptions
- persist middleware only saves user preferences, not data
- devtools enabled for Redux DevTools debugging
