/**
 * Stores Index
 *
 * Central export point for all Zustand stores used in the application.
 */

// Voxel Store - 3D visualization state management
export {
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
} from './voxelStore';

// View Presets Configuration
export { VIEW_PRESETS, getPresetConfig, getAvailablePresets, isValidPreset } from './viewPresets';
