/**
 * Voxel Store Selectors
 *
 * Optimized selector hooks for accessing voxel store state.
 * These selectors are designed to minimize re-renders by selecting
 * only the specific data needed by each component.
 */

import { useVoxelStore } from './index';
import type {
  VoxelNode,
  VoxelEdge,
  VoxelAnomaly,
  VoxelFilters,
  VoxelUIState,
  VoxelSyncState,
  VoxelNodeType,
  ViewPreset,
} from '../../types/voxel';

// ============================================================================
// Node Selectors
// ============================================================================

/**
 * Select a single node by ID.
 *
 * @param id - Node ID to select
 * @returns The node or undefined if not found
 */
export const useVoxelNode = (id: string): VoxelNode | undefined =>
  useVoxelStore((state) => state.nodes.get(id));

/**
 * Select all nodes as an array.
 *
 * @returns Array of all nodes
 */
export const useVoxelNodes = (): VoxelNode[] =>
  useVoxelStore((state) => Array.from(state.nodes.values()));

/**
 * Select nodes filtered by current filter settings.
 * Applies node type, status, search query, anomaly, and date range filters.
 *
 * @returns Array of filtered nodes
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
 * Select the currently selected node.
 *
 * @returns The selected node or null
 */
export const useSelectedNode = (): VoxelNode | null =>
  useVoxelStore((state) =>
    state.ui.selectedNodeId ? state.nodes.get(state.ui.selectedNodeId) ?? null : null
  );

/**
 * Select the currently hovered node.
 *
 * @returns The hovered node or null
 */
export const useHoveredNode = (): VoxelNode | null =>
  useVoxelStore((state) =>
    state.ui.hoveredNodeId ? state.nodes.get(state.ui.hoveredNodeId) ?? null : null
  );

/**
 * Select node count grouped by type.
 *
 * @returns Record of node counts by type
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

// ============================================================================
// Edge Selectors
// ============================================================================

/**
 * Select a single edge by ID.
 *
 * @param id - Edge ID to select
 * @returns The edge or undefined if not found
 */
export const useVoxelEdge = (id: string): VoxelEdge | undefined =>
  useVoxelStore((state) => state.edges.get(id));

/**
 * Select all edges as an array.
 *
 * @returns Array of all edges
 */
export const useVoxelEdges = (): VoxelEdge[] =>
  useVoxelStore((state) => Array.from(state.edges.values()));

/**
 * Select only edges that connect visible nodes.
 * Also respects the showEdges UI setting.
 *
 * @returns Array of visible edges
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

// ============================================================================
// Anomaly Selectors
// ============================================================================

/**
 * Select a single anomaly by ID.
 *
 * @param id - Anomaly ID to select
 * @returns The anomaly or undefined if not found
 */
export const useVoxelAnomaly = (id: string): VoxelAnomaly | undefined =>
  useVoxelStore((state) => state.anomalies.get(id));

/**
 * Select all anomalies as an array.
 *
 * @returns Array of all anomalies
 */
export const useVoxelAnomalies = (): VoxelAnomaly[] =>
  useVoxelStore((state) => Array.from(state.anomalies.values()));

/**
 * Select only active (unresolved) anomalies.
 *
 * @returns Array of active anomalies
 */
export const useActiveAnomalies = (): VoxelAnomaly[] =>
  useVoxelStore((state) =>
    Array.from(state.anomalies.values()).filter((a) => a.status === 'active')
  );

/**
 * Select anomalies for a specific node.
 *
 * @param nodeId - Node ID to get anomalies for
 * @returns Array of anomalies for the node
 */
export const useNodeAnomalies = (nodeId: string): VoxelAnomaly[] =>
  useVoxelStore((state) =>
    Array.from(state.anomalies.values()).filter((a) => a.nodeId === nodeId)
  );

/**
 * Select anomaly count grouped by severity.
 * Only counts active anomalies.
 *
 * @returns Record of anomaly counts by severity
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
// Filter Selectors
// ============================================================================

/**
 * Select current filter configuration.
 *
 * @returns Current filters
 */
export const useVoxelFilters = (): VoxelFilters =>
  useVoxelStore((state) => state.filters);

// ============================================================================
// UI Selectors
// ============================================================================

/**
 * Select current UI state.
 *
 * @returns Current UI state
 */
export const useVoxelUI = (): VoxelUIState => useVoxelStore((state) => state.ui);

// ============================================================================
// Sync Selectors
// ============================================================================

/**
 * Select current sync state.
 *
 * @returns Current sync state
 */
export const useVoxelSync = (): VoxelSyncState => useVoxelStore((state) => state.sync);

// ============================================================================
// Preset Selectors
// ============================================================================

/**
 * Select current active preset.
 *
 * @returns Current preset key
 */
export const useCurrentPreset = (): ViewPreset =>
  useVoxelStore((state) => state.currentPreset);
