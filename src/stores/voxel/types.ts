/**
 * Voxel Store Types
 *
 * Shared types used across all voxel store slices.
 * This file defines the combined store type and slice interfaces.
 */

import type { StateCreator } from 'zustand';
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
} from '../../types/voxel';

// ============================================================================
// Initial State Constants
// ============================================================================

/**
 * Default filter configuration
 */
export const initialFilters: VoxelFilters = {
 nodeTypes: ['asset', 'risk', 'control', 'incident', 'supplier', 'project', 'audit'],
 statuses: ['normal', 'warning', 'critical', 'inactive'],
 dateRange: undefined,
 searchQuery: '',
 showAnomaliesOnly: false,
};

/**
 * Default UI state configuration
 */
export const initialUI: VoxelUIState = {
 selectedNodeId: null,
 hoveredNodeId: null,
 cameraPosition: { x: 0, y: 10, z: 20 },
 cameraTarget: { x: 0, y: 0, z: 0 },
 zoom: 1,
 showLabels: true,
 showEdges: true,
 layoutType: 'force',
};

/**
 * Default sync state configuration
 */
export const initialSync: VoxelSyncState = {
 status: 'offline',
 lastSyncAt: null,
 pendingChanges: 0,
};

// ============================================================================
// Slice Interfaces
// ============================================================================

/**
 * Node slice state and actions
 */
export interface NodeSlice {
 /** Map of all nodes indexed by ID */
 nodes: Map<string, VoxelNode>;
 /** Add a new node to the store */
 addNode: (node: VoxelNode) => void;
 /** Update an existing node by ID */
 updateNode: (id: string, updates: Partial<VoxelNode>) => void;
 /** Remove a node and its connected edges */
 removeNode: (id: string) => void;
 /** Replace all nodes */
 setNodes: (nodes: VoxelNode[]) => void;
 /** Clear all nodes and edges */
 clearNodes: () => void;
}

/**
 * Edge slice state and actions
 */
export interface EdgeSlice {
 /** Map of all edges indexed by ID */
 edges: Map<string, VoxelEdge>;
 /** Add a new edge to the store */
 addEdge: (edge: VoxelEdge) => void;
 /** Update an existing edge by ID */
 updateEdge: (id: string, updates: Partial<VoxelEdge>) => void;
 /** Remove an edge by ID */
 removeEdge: (id: string) => void;
 /** Replace all edges */
 setEdges: (edges: VoxelEdge[]) => void;
 /** Clear all edges */
 clearEdges: () => void;
}

/**
 * Anomaly slice state and actions
 */
export interface AnomalySlice {
 /** Map of all anomalies indexed by ID */
 anomalies: Map<string, VoxelAnomaly>;
 /** Add a new anomaly and update related node */
 addAnomaly: (anomaly: VoxelAnomaly) => void;
 /** Update an existing anomaly */
 updateAnomaly: (id: string, updates: Partial<VoxelAnomaly>) => void;
 /** Remove an anomaly and update related node */
 removeAnomaly: (id: string) => void;
 /** Mark an anomaly as acknowledged */
 acknowledgeAnomaly: (id: string) => void;
 /** Mark an anomaly as resolved */
 resolveAnomaly: (id: string) => void;
 /** Mark an anomaly as dismissed */
 dismissAnomaly: (id: string) => void;
 /** Replace all anomalies */
 setAnomalies: (anomalies: VoxelAnomaly[]) => void;
 /** Clear all anomalies */
 clearAnomalies: () => void;
}

/**
 * Filter slice state and actions
 */
export interface FilterSlice {
 /** Current filter configuration */
 filters: VoxelFilters;
 /** Set node type filter */
 setNodeTypeFilter: (types: VoxelNodeType[]) => void;
 /** Toggle a node type in filter */
 toggleNodeType: (type: VoxelNodeType) => void;
 /** Set status filter */
 setStatusFilter: (statuses: VoxelNodeStatus[]) => void;
 /** Toggle a status in filter */
 toggleStatus: (status: VoxelNodeStatus) => void;
 /** Set date range filter */
 setDateRangeFilter: (range: { start: Date; end: Date } | undefined) => void;
 /** Set search query */
 setSearchQuery: (query: string) => void;
 /** Set show anomalies only flag */
 setShowAnomaliesOnly: (show: boolean) => void;
 /** Reset all filters to defaults */
 resetFilters: () => void;
}

/**
 * UI slice state and actions
 */
export interface UISlice {
 /** Current UI state */
 ui: VoxelUIState;
 /** Select a node by ID */
 selectNode: (id: string | null) => void;
 /** Hover a node by ID */
 hoverNode: (id: string | null) => void;
 /** Set camera position */
 setCameraPosition: (position: { x: number; y: number; z: number }) => void;
 /** Set camera target */
 setCameraTarget: (target: { x: number; y: number; z: number }) => void;
 /** Set zoom level */
 setZoom: (zoom: number) => void;
 /** Toggle labels visibility */
 toggleLabels: () => void;
 /** Toggle edges visibility */
 toggleEdges: () => void;
 /** Set layout type */
 setLayoutType: (layout: VoxelUIState['layoutType']) => void;
 /** Reset UI to defaults */
 resetUI: () => void;
}

/**
 * Sync slice state and actions
 */
export interface SyncSlice {
 /** Current sync state */
 sync: VoxelSyncState;
 /** Set sync status */
 setSyncStatus: (status: VoxelSyncState['status']) => void;
 /** Set last sync timestamp */
 setLastSyncAt: (date: Date | null) => void;
 /** Increment pending changes count */
 incrementPendingChanges: () => void;
 /** Decrement pending changes count */
 decrementPendingChanges: () => void;
 /** Reset pending changes to zero */
 resetPendingChanges: () => void;
}

/**
 * Preset slice state and actions
 */
export interface PresetSlice {
 /** Current active preset */
 currentPreset: ViewPreset;
 /** Apply a preset configuration */
 applyPreset: (preset: ViewPreset) => void;
 /** Save current configuration as custom preset */
 saveCustomPreset: () => void;
}

/**
 * Reset action (bulk operation)
 */
export interface ResetSlice {
 /** Reset entire store to initial state */
 reset: () => void;
}

// ============================================================================
// Combined Store Type
// ============================================================================

/**
 * Combined voxel store type including all slices
 */
export type VoxelStore = NodeSlice &
 EdgeSlice &
 AnomalySlice &
 FilterSlice &
 UISlice &
 SyncSlice &
 PresetSlice &
 ResetSlice;

/**
 * State creator type for slices.
 * Uses the devtools middleware signature for action naming support.
 */
export type VoxelSliceCreator<T> = StateCreator<
 VoxelStore,
 [['zustand/devtools', never], ['zustand/subscribeWithSelector', never], ['zustand/persist', unknown]],
 [],
 T
>;
