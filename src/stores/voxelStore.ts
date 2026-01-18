/**
 * Voxel Store
 *
 * Re-exports from the modular voxel store implementation.
 * This file maintains backwards compatibility with existing imports.
 *
 * @deprecated Import directly from '@/stores/voxel' for new code.
 *
 * The store has been refactored into domain-specific slices:
 * - nodeSlice: VoxelNode CRUD operations
 * - edgeSlice: VoxelEdge CRUD operations
 * - anomalySlice: VoxelAnomaly management
 * - uiSlice: UI state and filters
 * - syncSlice: Real-time sync state
 * - presetSlice: View preset management
 *
 * See src/stores/voxel/index.ts for the combined store implementation.
 */

// Re-export everything from the modular implementation
export {
  // Main store hook
  useVoxelStore,

  // Selector hooks
  useVoxelNode,
  useVoxelNodes,
  useFilteredNodes,
  useVoxelEdge,
  useVoxelEdges,
  useVisibleEdges,
  useVoxelAnomaly,
  useVoxelAnomalies,
  useActiveAnomalies,
  useNodeAnomalies,
  useSelectedNode,
  useHoveredNode,
  useVoxelFilters,
  useVoxelUI,
  useVoxelSync,
  useCurrentPreset,
  useNodeCountByType,
  useAnomalyCountBySeverity,

  // Direct actions (non-hook)
  voxelStoreActions,

  // Types
  type VoxelStore,
  type NodeSlice,
  type EdgeSlice,
  type AnomalySlice,
  type FilterSlice,
  type UISlice,
  type SyncSlice,
  type PresetSlice,
} from './voxel';
