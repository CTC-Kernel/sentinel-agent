/**
 * Voxel Store
 *
 * Combined Zustand store for the voxel 3D visualization.
 * Uses the slices pattern to organize state by domain while maintaining
 * a single store instance for optimal performance.
 *
 * Architecture:
 * - nodeSlice: VoxelNode CRUD operations
 * - edgeSlice: VoxelEdge CRUD operations
 * - anomalySlice: VoxelAnomaly CRUD and status management
 * - uiSlice: UI state (filters, selection, camera)
 * - syncSlice: Real-time sync state with Firebase
 * - presetSlice: View preset management
 *
 * Middleware:
 * - devtools: Redux DevTools integration for debugging
 * - subscribeWithSelector: Fine-grained subscriptions
 * - persist: Selective persistence of user preferences
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';

import { createNodeSlice } from './nodeSlice';
import { createEdgeSlice } from './edgeSlice';
import { createAnomalySlice } from './anomalySlice';
import { createFilterSlice, createUISlice } from './uiSlice';
import { createSyncSlice } from './syncSlice';
import { createPresetSlice } from './presetSlice';
import type { VoxelStore } from './types';
import { initialFilters, initialUI, initialSync } from './types';

// ============================================================================
// Store Creation
// ============================================================================

/**
 * Combined voxel store with all slices and middleware.
 *
 * Uses the Zustand slices pattern to combine multiple domain-specific
 * slices into a single store. This allows for modular code organization
 * while maintaining a unified state tree.
 */
export const useVoxelStore = create<VoxelStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        (...a) => ({
          // Combine all slices
          ...createNodeSlice(...a),
          ...createEdgeSlice(...a),
          ...createAnomalySlice(...a),
          ...createFilterSlice(...a),
          ...createUISlice(...a),
          ...createSyncSlice(...a),
          ...createPresetSlice(...a),

          // Global reset action
          reset: () =>
            a[0](
              () => ({
                nodes: new Map(),
                edges: new Map(),
                anomalies: new Map(),
                filters: initialFilters,
                ui: initialUI,
                sync: initialSync,
                currentPreset: 'custom' as const,
              }),
              false,
              'reset'
            ),
        }),
        {
          name: 'voxel-store',
          // Only persist user preferences (filters, UI settings, current preset)
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
          // Custom storage to handle serialization
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
// Store Actions (for non-hook usage)
// ============================================================================

/**
 * Direct access to store actions without hooks.
 * Useful for service layers, event handlers, and tests.
 *
 * Note: These are bound at module load time, which is the expected
 * Zustand pattern for external action access.
 */
export const voxelStoreActions = {
  // Node actions
  addNode: useVoxelStore.getState().addNode,
  updateNode: useVoxelStore.getState().updateNode,
  removeNode: useVoxelStore.getState().removeNode,
  setNodes: useVoxelStore.getState().setNodes,
  clearNodes: useVoxelStore.getState().clearNodes,

  // Edge actions
  addEdge: useVoxelStore.getState().addEdge,
  updateEdge: useVoxelStore.getState().updateEdge,
  removeEdge: useVoxelStore.getState().removeEdge,
  setEdges: useVoxelStore.getState().setEdges,
  clearEdges: useVoxelStore.getState().clearEdges,

  // Anomaly actions
  addAnomaly: useVoxelStore.getState().addAnomaly,
  updateAnomaly: useVoxelStore.getState().updateAnomaly,
  removeAnomaly: useVoxelStore.getState().removeAnomaly,
  acknowledgeAnomaly: useVoxelStore.getState().acknowledgeAnomaly,
  resolveAnomaly: useVoxelStore.getState().resolveAnomaly,
  dismissAnomaly: useVoxelStore.getState().dismissAnomaly,
  setAnomalies: useVoxelStore.getState().setAnomalies,
  clearAnomalies: useVoxelStore.getState().clearAnomalies,

  // Filter actions
  setNodeTypeFilter: useVoxelStore.getState().setNodeTypeFilter,
  toggleNodeType: useVoxelStore.getState().toggleNodeType,
  setStatusFilter: useVoxelStore.getState().setStatusFilter,
  toggleStatus: useVoxelStore.getState().toggleStatus,
  setDateRangeFilter: useVoxelStore.getState().setDateRangeFilter,
  setSearchQuery: useVoxelStore.getState().setSearchQuery,
  setShowAnomaliesOnly: useVoxelStore.getState().setShowAnomaliesOnly,
  resetFilters: useVoxelStore.getState().resetFilters,

  // UI actions
  selectNode: useVoxelStore.getState().selectNode,
  hoverNode: useVoxelStore.getState().hoverNode,
  setCameraPosition: useVoxelStore.getState().setCameraPosition,
  setCameraTarget: useVoxelStore.getState().setCameraTarget,
  setZoom: useVoxelStore.getState().setZoom,
  toggleLabels: useVoxelStore.getState().toggleLabels,
  toggleEdges: useVoxelStore.getState().toggleEdges,
  setLayoutType: useVoxelStore.getState().setLayoutType,
  resetUI: useVoxelStore.getState().resetUI,

  // Preset actions
  applyPreset: useVoxelStore.getState().applyPreset,
  saveCustomPreset: useVoxelStore.getState().saveCustomPreset,

  // Sync actions
  setSyncStatus: useVoxelStore.getState().setSyncStatus,
  setLastSyncAt: useVoxelStore.getState().setLastSyncAt,
  incrementPendingChanges: useVoxelStore.getState().incrementPendingChanges,
  decrementPendingChanges: useVoxelStore.getState().decrementPendingChanges,
  resetPendingChanges: useVoxelStore.getState().resetPendingChanges,

  // Global actions
  reset: useVoxelStore.getState().reset,
};

// ============================================================================
// Re-export Selectors
// ============================================================================

export {
  useVoxelNode,
  useVoxelNodes,
  useFilteredNodes,
  useSelectedNode,
  useHoveredNode,
  useNodeCountByType,
  useVoxelEdge,
  useVoxelEdges,
  useVisibleEdges,
  useVoxelAnomaly,
  useVoxelAnomalies,
  useActiveAnomalies,
  useNodeAnomalies,
  useAnomalyCountBySeverity,
  useVoxelFilters,
  useVoxelUI,
  useVoxelSync,
  useCurrentPreset,
} from './selectors';

// ============================================================================
// Re-export Types
// ============================================================================

export type {
  VoxelStore,
  NodeSlice,
  EdgeSlice,
  AnomalySlice,
  FilterSlice,
  UISlice,
  SyncSlice,
  PresetSlice,
} from './types';
