import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import type {
  VoxelNode,
  VoxelEdge,
  VoxelAnomaly,
  VoxelFilters,
  VoxelUIState,
  VoxelSyncState,
  VoxelNodeType,
  VoxelNodeStatus,
  ViewPreset,
} from '../types/voxel';
import { VIEW_PRESETS } from './viewPresets';

// NOTE: immer is not installed. Using spread operators for immutable updates.
// To enable immer middleware, install it with: npm install immer
// Then import { immer } from 'zustand/middleware/immer' and wrap the state setter.

// ============================================================================
// State Interface
// ============================================================================

interface VoxelState {
  // Data Collections (using Map for O(1) lookups)
  nodes: Map<string, VoxelNode>;
  edges: Map<string, VoxelEdge>;
  anomalies: Map<string, VoxelAnomaly>;

  // Filters
  filters: VoxelFilters;

  // UI State
  ui: VoxelUIState;

  // Sync State
  sync: VoxelSyncState;

  // Current preset
  currentPreset: ViewPreset;
}

// ============================================================================
// Actions Interface
// ============================================================================

interface VoxelActions {
  // Node CRUD
  addNode: (node: VoxelNode) => void;
  updateNode: (id: string, updates: Partial<VoxelNode>) => void;
  removeNode: (id: string) => void;
  setNodes: (nodes: VoxelNode[]) => void;
  clearNodes: () => void;

  // Edge CRUD
  addEdge: (edge: VoxelEdge) => void;
  updateEdge: (id: string, updates: Partial<VoxelEdge>) => void;
  removeEdge: (id: string) => void;
  setEdges: (edges: VoxelEdge[]) => void;
  clearEdges: () => void;

  // Anomaly CRUD
  addAnomaly: (anomaly: VoxelAnomaly) => void;
  updateAnomaly: (id: string, updates: Partial<VoxelAnomaly>) => void;
  removeAnomaly: (id: string) => void;
  acknowledgeAnomaly: (id: string) => void;
  resolveAnomaly: (id: string) => void;
  dismissAnomaly: (id: string) => void;
  setAnomalies: (anomalies: VoxelAnomaly[]) => void;
  clearAnomalies: () => void;

  // Filter Actions
  setNodeTypeFilter: (types: VoxelNodeType[]) => void;
  toggleNodeType: (type: VoxelNodeType) => void;
  setStatusFilter: (statuses: VoxelNodeStatus[]) => void;
  toggleStatus: (status: VoxelNodeStatus) => void;
  setDateRangeFilter: (range: { start: Date; end: Date } | undefined) => void;
  setSearchQuery: (query: string) => void;
  setShowAnomaliesOnly: (show: boolean) => void;
  resetFilters: () => void;

  // UI Actions
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  setCameraPosition: (position: { x: number; y: number; z: number }) => void;
  setCameraTarget: (target: { x: number; y: number; z: number }) => void;
  setZoom: (zoom: number) => void;
  toggleLabels: () => void;
  toggleEdges: () => void;
  setLayoutType: (layout: VoxelUIState['layoutType']) => void;
  resetUI: () => void;

  // Preset Actions
  applyPreset: (preset: ViewPreset) => void;
  saveCustomPreset: () => void;

  // Sync Actions
  setSyncStatus: (status: VoxelSyncState['status']) => void;
  setLastSyncAt: (date: Date | null) => void;
  incrementPendingChanges: () => void;
  decrementPendingChanges: () => void;
  resetPendingChanges: () => void;

  // Bulk Actions
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialFilters: VoxelFilters = {
  nodeTypes: ['asset', 'risk', 'control', 'incident', 'supplier', 'project', 'audit'],
  statuses: ['normal', 'warning', 'critical', 'inactive'],
  dateRange: undefined,
  searchQuery: '',
  showAnomaliesOnly: false,
};

const initialUI: VoxelUIState = {
  selectedNodeId: null,
  hoveredNodeId: null,
  cameraPosition: { x: 0, y: 10, z: 20 },
  cameraTarget: { x: 0, y: 0, z: 0 },
  zoom: 1,
  showLabels: true,
  showEdges: true,
  layoutType: 'force',
};

const initialSync: VoxelSyncState = {
  status: 'offline',
  lastSyncAt: null,
  pendingChanges: 0,
};

const initialState: VoxelState = {
  nodes: new Map(),
  edges: new Map(),
  anomalies: new Map(),
  filters: initialFilters,
  ui: initialUI,
  sync: initialSync,
  currentPreset: 'custom',
};

// ============================================================================
// Store Creation
// ============================================================================

export const useVoxelStore = create<VoxelState & VoxelActions>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial State
          ...initialState,

          // ================================================================
          // Node CRUD Actions
          // ================================================================

          addNode: (node) =>
            set(
              (state) => {
                const newNodes = new Map(state.nodes);
                newNodes.set(node.id, node);
                return { nodes: newNodes };
              },
              false,
              'addNode'
            ),

          updateNode: (id, updates) =>
            set(
              (state) => {
                const existing = state.nodes.get(id);
                if (!existing) return state;
                const newNodes = new Map(state.nodes);
                newNodes.set(id, { ...existing, ...updates, updatedAt: new Date() });
                return { nodes: newNodes };
              },
              false,
              'updateNode'
            ),

          removeNode: (id) =>
            set(
              (state) => {
                const newNodes = new Map(state.nodes);
                newNodes.delete(id);
                // Also remove edges connected to this node
                const newEdges = new Map(state.edges);
                Array.from(newEdges.entries()).forEach(([edgeId, edge]) => {
                  if (edge.source === id || edge.target === id) {
                    newEdges.delete(edgeId);
                  }
                });
                return { nodes: newNodes, edges: newEdges };
              },
              false,
              'removeNode'
            ),

          setNodes: (nodes) =>
            set(
              () => {
                const newNodes = new Map<string, VoxelNode>();
                nodes.forEach((node) => newNodes.set(node.id, node));
                return { nodes: newNodes };
              },
              false,
              'setNodes'
            ),

          clearNodes: () =>
            set(() => ({ nodes: new Map(), edges: new Map() }), false, 'clearNodes'),

          // ================================================================
          // Edge CRUD Actions
          // ================================================================

          addEdge: (edge) =>
            set(
              (state) => {
                const newEdges = new Map(state.edges);
                newEdges.set(edge.id, edge);
                return { edges: newEdges };
              },
              false,
              'addEdge'
            ),

          updateEdge: (id, updates) =>
            set(
              (state) => {
                const existing = state.edges.get(id);
                if (!existing) return state;
                const newEdges = new Map(state.edges);
                newEdges.set(id, { ...existing, ...updates });
                return { edges: newEdges };
              },
              false,
              'updateEdge'
            ),

          removeEdge: (id) =>
            set(
              (state) => {
                const newEdges = new Map(state.edges);
                newEdges.delete(id);
                return { edges: newEdges };
              },
              false,
              'removeEdge'
            ),

          setEdges: (edges) =>
            set(
              () => {
                const newEdges = new Map<string, VoxelEdge>();
                edges.forEach((edge) => newEdges.set(edge.id, edge));
                return { edges: newEdges };
              },
              false,
              'setEdges'
            ),

          clearEdges: () => set(() => ({ edges: new Map() }), false, 'clearEdges'),

          // ================================================================
          // Anomaly CRUD Actions
          // ================================================================

          addAnomaly: (anomaly) =>
            set(
              (state) => {
                const newAnomalies = new Map(state.anomalies);
                newAnomalies.set(anomaly.id, anomaly);
                // Update node's anomalyIds
                const node = state.nodes.get(anomaly.nodeId);
                if (node) {
                  const newNodes = new Map(state.nodes);
                  newNodes.set(anomaly.nodeId, {
                    ...node,
                    anomalyIds: [...(node.anomalyIds || []), anomaly.id],
                  });
                  return { anomalies: newAnomalies, nodes: newNodes };
                }
                return { anomalies: newAnomalies };
              },
              false,
              'addAnomaly'
            ),

          updateAnomaly: (id, updates) =>
            set(
              (state) => {
                const existing = state.anomalies.get(id);
                if (!existing) return state;
                const newAnomalies = new Map(state.anomalies);
                newAnomalies.set(id, { ...existing, ...updates });
                return { anomalies: newAnomalies };
              },
              false,
              'updateAnomaly'
            ),

          removeAnomaly: (id) =>
            set(
              (state) => {
                const anomaly = state.anomalies.get(id);
                if (!anomaly) return state;
                const newAnomalies = new Map(state.anomalies);
                newAnomalies.delete(id);
                // Update node's anomalyIds
                const node = state.nodes.get(anomaly.nodeId);
                if (node) {
                  const newNodes = new Map(state.nodes);
                  newNodes.set(anomaly.nodeId, {
                    ...node,
                    anomalyIds: (node.anomalyIds || []).filter((aid) => aid !== id),
                  });
                  return { anomalies: newAnomalies, nodes: newNodes };
                }
                return { anomalies: newAnomalies };
              },
              false,
              'removeAnomaly'
            ),

          acknowledgeAnomaly: (id) =>
            get().updateAnomaly(id, { status: 'acknowledged' }),

          resolveAnomaly: (id) => get().updateAnomaly(id, { status: 'resolved' }),

          dismissAnomaly: (id) => get().updateAnomaly(id, { status: 'dismissed' }),

          setAnomalies: (anomalies) =>
            set(
              () => {
                const newAnomalies = new Map<string, VoxelAnomaly>();
                anomalies.forEach((anomaly) => newAnomalies.set(anomaly.id, anomaly));
                return { anomalies: newAnomalies };
              },
              false,
              'setAnomalies'
            ),

          clearAnomalies: () =>
            set(() => ({ anomalies: new Map() }), false, 'clearAnomalies'),

          // ================================================================
          // Filter Actions
          // ================================================================

          setNodeTypeFilter: (types) =>
            set(
              (state) => ({ filters: { ...state.filters, nodeTypes: types } }),
              false,
              'setNodeTypeFilter'
            ),

          toggleNodeType: (type) =>
            set(
              (state) => {
                const current = state.filters.nodeTypes;
                const newTypes = current.includes(type)
                  ? current.filter((t) => t !== type)
                  : [...current, type];
                return { filters: { ...state.filters, nodeTypes: newTypes } };
              },
              false,
              'toggleNodeType'
            ),

          setStatusFilter: (statuses) =>
            set(
              (state) => ({ filters: { ...state.filters, statuses } }),
              false,
              'setStatusFilter'
            ),

          toggleStatus: (status) =>
            set(
              (state) => {
                const current = state.filters.statuses;
                const newStatuses = current.includes(status)
                  ? current.filter((s) => s !== status)
                  : [...current, status];
                return { filters: { ...state.filters, statuses: newStatuses } };
              },
              false,
              'toggleStatus'
            ),

          setDateRangeFilter: (range) =>
            set(
              (state) => ({ filters: { ...state.filters, dateRange: range } }),
              false,
              'setDateRangeFilter'
            ),

          setSearchQuery: (query) =>
            set(
              (state) => ({ filters: { ...state.filters, searchQuery: query } }),
              false,
              'setSearchQuery'
            ),

          setShowAnomaliesOnly: (show) =>
            set(
              (state) => ({ filters: { ...state.filters, showAnomaliesOnly: show } }),
              false,
              'setShowAnomaliesOnly'
            ),

          resetFilters: () =>
            set(() => ({ filters: initialFilters }), false, 'resetFilters'),

          // ================================================================
          // UI Actions
          // ================================================================

          selectNode: (id) =>
            set(
              (state) => ({ ui: { ...state.ui, selectedNodeId: id } }),
              false,
              'selectNode'
            ),

          hoverNode: (id) =>
            set(
              (state) => ({ ui: { ...state.ui, hoveredNodeId: id } }),
              false,
              'hoverNode'
            ),

          setCameraPosition: (position) =>
            set(
              (state) => ({ ui: { ...state.ui, cameraPosition: position } }),
              false,
              'setCameraPosition'
            ),

          setCameraTarget: (target) =>
            set(
              (state) => ({ ui: { ...state.ui, cameraTarget: target } }),
              false,
              'setCameraTarget'
            ),

          setZoom: (zoom) =>
            set((state) => ({ ui: { ...state.ui, zoom } }), false, 'setZoom'),

          toggleLabels: () =>
            set(
              (state) => ({ ui: { ...state.ui, showLabels: !state.ui.showLabels } }),
              false,
              'toggleLabels'
            ),

          toggleEdges: () =>
            set(
              (state) => ({ ui: { ...state.ui, showEdges: !state.ui.showEdges } }),
              false,
              'toggleEdges'
            ),

          setLayoutType: (layout) =>
            set(
              (state) => ({ ui: { ...state.ui, layoutType: layout } }),
              false,
              'setLayoutType'
            ),

          resetUI: () => set(() => ({ ui: initialUI }), false, 'resetUI'),

          // ================================================================
          // Preset Actions
          // ================================================================

          applyPreset: (preset) =>
            set(
              (state) => {
                const config = VIEW_PRESETS[preset];
                return {
                  currentPreset: preset,
                  filters: {
                    ...state.filters,
                    nodeTypes: config.layers,
                  },
                  ui: {
                    ...state.ui,
                    layoutType: config.layout,
                    cameraPosition: config.camera.position,
                    cameraTarget: config.camera.target,
                  },
                };
              },
              false,
              'applyPreset'
            ),

          saveCustomPreset: () =>
            set(() => ({ currentPreset: 'custom' }), false, 'saveCustomPreset'),

          // ================================================================
          // Sync Actions
          // ================================================================

          setSyncStatus: (status) =>
            set(
              (state) => ({ sync: { ...state.sync, status } }),
              false,
              'setSyncStatus'
            ),

          setLastSyncAt: (date) =>
            set(
              (state) => ({ sync: { ...state.sync, lastSyncAt: date } }),
              false,
              'setLastSyncAt'
            ),

          incrementPendingChanges: () =>
            set(
              (state) => ({
                sync: { ...state.sync, pendingChanges: state.sync.pendingChanges + 1 },
              }),
              false,
              'incrementPendingChanges'
            ),

          decrementPendingChanges: () =>
            set(
              (state) => ({
                sync: {
                  ...state.sync,
                  pendingChanges: Math.max(0, state.sync.pendingChanges - 1),
                },
              }),
              false,
              'decrementPendingChanges'
            ),

          resetPendingChanges: () =>
            set(
              (state) => ({ sync: { ...state.sync, pendingChanges: 0 } }),
              false,
              'resetPendingChanges'
            ),

          // ================================================================
          // Bulk Actions
          // ================================================================

          reset: () => set(() => ({ ...initialState }), false, 'reset'),
        }),
        {
          name: 'voxel-store',
          // Only persist preferences (filters, UI settings, current preset)
          // Do not persist nodes, edges, anomalies (they come from Firebase)
          partialize: (state) => ({
            filters: state.filters,
            ui: {
              showLabels: state.ui.showLabels,
              showEdges: state.ui.showEdges,
              layoutType: state.ui.layoutType,
              cameraPosition: state.ui.cameraPosition,
              cameraTarget: state.ui.cameraTarget,
              zoom: state.ui.zoom,
            },
            currentPreset: state.currentPreset,
          }),
          // Custom storage to handle Map serialization if needed in the future
          storage: {
            getItem: (name) => {
              const str = localStorage.getItem(name);
              if (!str) return null;
              return JSON.parse(str);
            },
            setItem: (name, value) => {
              localStorage.setItem(name, JSON.stringify(value));
            },
            removeItem: (name) => {
              localStorage.removeItem(name);
            },
          },
        }
      )
    ),
    { name: 'VoxelStore' }
  )
);

// ============================================================================
// Optimized Selector Hooks
// ============================================================================

/**
 * Select a single node by ID
 */
export const useVoxelNode = (id: string): VoxelNode | undefined =>
  useVoxelStore((state) => state.nodes.get(id));

/**
 * Select all nodes as an array
 */
export const useVoxelNodes = (): VoxelNode[] =>
  useVoxelStore((state) => Array.from(state.nodes.values()));

/**
 * Select nodes filtered by current filters
 */
export const useFilteredNodes = (): VoxelNode[] =>
  useVoxelStore((state) => {
    const { nodes, filters } = state;
    return Array.from(nodes.values()).filter((node) => {
      // Filter by node type
      if (!filters.nodeTypes.includes(node.type)) return false;

      // Filter by status
      if (!filters.statuses.includes(node.status)) return false;

      // Filter by search query
      if (
        filters.searchQuery &&
        !node.label.toLowerCase().includes(filters.searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Filter by anomalies only
      if (filters.showAnomaliesOnly && (!node.anomalyIds || node.anomalyIds.length === 0)) {
        return false;
      }

      // Filter by date range
      if (filters.dateRange) {
        const nodeDate = new Date(node.createdAt);
        if (nodeDate < filters.dateRange.start || nodeDate > filters.dateRange.end) {
          return false;
        }
      }

      return true;
    });
  });

/**
 * Select a single edge by ID
 */
export const useVoxelEdge = (id: string): VoxelEdge | undefined =>
  useVoxelStore((state) => state.edges.get(id));

/**
 * Select all edges as an array
 */
export const useVoxelEdges = (): VoxelEdge[] =>
  useVoxelStore((state) => Array.from(state.edges.values()));

/**
 * Select edges for visible nodes only
 */
export const useVisibleEdges = (): VoxelEdge[] =>
  useVoxelStore((state) => {
    if (!state.ui.showEdges) return [];
    const visibleNodeIds = new Set(
      Array.from(state.nodes.values())
        .filter((node) => state.filters.nodeTypes.includes(node.type))
        .map((node) => node.id)
    );
    return Array.from(state.edges.values()).filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  });

/**
 * Select a single anomaly by ID
 */
export const useVoxelAnomaly = (id: string): VoxelAnomaly | undefined =>
  useVoxelStore((state) => state.anomalies.get(id));

/**
 * Select all anomalies as an array
 */
export const useVoxelAnomalies = (): VoxelAnomaly[] =>
  useVoxelStore((state) => Array.from(state.anomalies.values()));

/**
 * Select active anomalies only
 */
export const useActiveAnomalies = (): VoxelAnomaly[] =>
  useVoxelStore((state) =>
    Array.from(state.anomalies.values()).filter((a) => a.status === 'active')
  );

/**
 * Select anomalies for a specific node
 */
export const useNodeAnomalies = (nodeId: string): VoxelAnomaly[] =>
  useVoxelStore((state) =>
    Array.from(state.anomalies.values()).filter((a) => a.nodeId === nodeId)
  );

/**
 * Select the currently selected node
 */
export const useSelectedNode = (): VoxelNode | null =>
  useVoxelStore((state) =>
    state.ui.selectedNodeId ? state.nodes.get(state.ui.selectedNodeId) ?? null : null
  );

/**
 * Select the currently hovered node
 */
export const useHoveredNode = (): VoxelNode | null =>
  useVoxelStore((state) =>
    state.ui.hoveredNodeId ? state.nodes.get(state.ui.hoveredNodeId) ?? null : null
  );

/**
 * Select current filters
 */
export const useVoxelFilters = (): VoxelFilters =>
  useVoxelStore((state) => state.filters);

/**
 * Select current UI state
 */
export const useVoxelUI = (): VoxelUIState => useVoxelStore((state) => state.ui);

/**
 * Select current sync state
 */
export const useVoxelSync = (): VoxelSyncState => useVoxelStore((state) => state.sync);

/**
 * Select current preset
 */
export const useCurrentPreset = (): ViewPreset =>
  useVoxelStore((state) => state.currentPreset);

/**
 * Select node count by type
 */
export const useNodeCountByType = (): Record<VoxelNodeType, number> =>
  useVoxelStore((state) => {
    const counts: Record<VoxelNodeType, number> = {
      asset: 0,
      risk: 0,
      control: 0,
      incident: 0,
      supplier: 0,
      project: 0,
      audit: 0,
    };
    Array.from(state.nodes.values()).forEach((node) => {
      counts[node.type]++;
    });
    return counts;
  });

/**
 * Select anomaly count by severity
 */
export const useAnomalyCountBySeverity = (): Record<VoxelAnomaly['severity'], number> =>
  useVoxelStore((state) => {
    const counts: Record<VoxelAnomaly['severity'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    Array.from(state.anomalies.values()).forEach((anomaly) => {
      if (anomaly.status === 'active') {
        counts[anomaly.severity]++;
      }
    });
    return counts;
  });

// ============================================================================
// Store Actions (for external use without hooks)
// ============================================================================

export const voxelStoreActions = {
  addNode: useVoxelStore.getState().addNode,
  updateNode: useVoxelStore.getState().updateNode,
  removeNode: useVoxelStore.getState().removeNode,
  setNodes: useVoxelStore.getState().setNodes,
  clearNodes: useVoxelStore.getState().clearNodes,
  addEdge: useVoxelStore.getState().addEdge,
  updateEdge: useVoxelStore.getState().updateEdge,
  removeEdge: useVoxelStore.getState().removeEdge,
  setEdges: useVoxelStore.getState().setEdges,
  clearEdges: useVoxelStore.getState().clearEdges,
  addAnomaly: useVoxelStore.getState().addAnomaly,
  updateAnomaly: useVoxelStore.getState().updateAnomaly,
  removeAnomaly: useVoxelStore.getState().removeAnomaly,
  acknowledgeAnomaly: useVoxelStore.getState().acknowledgeAnomaly,
  resolveAnomaly: useVoxelStore.getState().resolveAnomaly,
  dismissAnomaly: useVoxelStore.getState().dismissAnomaly,
  setAnomalies: useVoxelStore.getState().setAnomalies,
  clearAnomalies: useVoxelStore.getState().clearAnomalies,
  setNodeTypeFilter: useVoxelStore.getState().setNodeTypeFilter,
  toggleNodeType: useVoxelStore.getState().toggleNodeType,
  setStatusFilter: useVoxelStore.getState().setStatusFilter,
  toggleStatus: useVoxelStore.getState().toggleStatus,
  setDateRangeFilter: useVoxelStore.getState().setDateRangeFilter,
  setSearchQuery: useVoxelStore.getState().setSearchQuery,
  setShowAnomaliesOnly: useVoxelStore.getState().setShowAnomaliesOnly,
  resetFilters: useVoxelStore.getState().resetFilters,
  selectNode: useVoxelStore.getState().selectNode,
  hoverNode: useVoxelStore.getState().hoverNode,
  setCameraPosition: useVoxelStore.getState().setCameraPosition,
  setCameraTarget: useVoxelStore.getState().setCameraTarget,
  setZoom: useVoxelStore.getState().setZoom,
  toggleLabels: useVoxelStore.getState().toggleLabels,
  toggleEdges: useVoxelStore.getState().toggleEdges,
  setLayoutType: useVoxelStore.getState().setLayoutType,
  resetUI: useVoxelStore.getState().resetUI,
  applyPreset: useVoxelStore.getState().applyPreset,
  saveCustomPreset: useVoxelStore.getState().saveCustomPreset,
  setSyncStatus: useVoxelStore.getState().setSyncStatus,
  setLastSyncAt: useVoxelStore.getState().setLastSyncAt,
  incrementPendingChanges: useVoxelStore.getState().incrementPendingChanges,
  decrementPendingChanges: useVoxelStore.getState().decrementPendingChanges,
  resetPendingChanges: useVoxelStore.getState().resetPendingChanges,
  reset: useVoxelStore.getState().reset,
};
