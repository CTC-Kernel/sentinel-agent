/**
 * Voxel Store Selectors
 *
 * Optimized selector hooks for accessing voxel store state.
 * These selectors are designed to minimize re-renders by selecting
 * only the specific data needed by each component.
 *
 * Uses useShallow for array/object returns to prevent infinite loops.
 */

import { useMemo } from 'react';
import { useVoxelStore } from './index';
import { useShallow } from 'zustand/react/shallow';
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
 * Uses useShallow to prevent infinite re-render loops.
 *
 * @returns Array of all nodes
 */
export const useVoxelNodes = (): VoxelNode[] => {
  const nodesMap = useVoxelStore((state) => state.nodes);
  return useMemo(() => Array.from(nodesMap.values()), [nodesMap]);
};

/**
 * Select nodes filtered by current filter settings.
 * Applies node type, status, search query, anomaly, and date range filters.
 * Uses useMemo to prevent infinite re-render loops.
 *
 * @returns Array of filtered nodes
 */
export const useFilteredNodes = (): VoxelNode[] => {
  const nodesMap = useVoxelStore((state) => state.nodes);
  const filters = useVoxelStore(useShallow((state) => state.filters));

  return useMemo(() => {
    return Array.from(nodesMap.values()).filter((node) => {
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
  }, [nodesMap, filters]);
};

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
 * Uses useMemo to prevent infinite re-render loops.
 *
 * @returns Record of node counts by type
 */
export const useNodeCountByType = (): Record<VoxelNodeType, number> => {
  const nodesMap = useVoxelStore((state) => state.nodes);

  return useMemo(() => {
    const counts: Record<VoxelNodeType, number> = {
      asset: 0,
      risk: 0,
      control: 0,
      incident: 0,
      supplier: 0,
      project: 0,
      audit: 0,
    };
    Array.from(nodesMap.values()).forEach((node) => {
      counts[node.type]++;
    });
    return counts;
  }, [nodesMap]);
};

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
 * Uses useMemo to prevent infinite re-render loops.
 *
 * @returns Array of all edges
 */
export const useVoxelEdges = (): VoxelEdge[] => {
  const edgesMap = useVoxelStore((state) => state.edges);
  return useMemo(() => Array.from(edgesMap.values()), [edgesMap]);
};

/**
 * Select only edges that connect visible nodes.
 * Also respects the showEdges UI setting.
 * Uses useMemo to prevent infinite re-render loops.
 *
 * @returns Array of visible edges
 */
export const useVisibleEdges = (): VoxelEdge[] => {
  const nodesMap = useVoxelStore((state) => state.nodes);
  const edgesMap = useVoxelStore((state) => state.edges);
  const showEdges = useVoxelStore((state) => state.ui.showEdges);
  const nodeTypes = useVoxelStore(useShallow((state) => state.filters.nodeTypes));

  return useMemo(() => {
    if (!showEdges) return [];
    const visibleNodeIds = new Set(
      Array.from(nodesMap.values())
        .filter((node) => nodeTypes.includes(node.type))
        .map((node) => node.id)
    );
    return Array.from(edgesMap.values()).filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [nodesMap, edgesMap, showEdges, nodeTypes]);
};

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
 * Uses useMemo to prevent infinite re-render loops.
 *
 * @returns Array of all anomalies
 */
export const useVoxelAnomalies = (): VoxelAnomaly[] => {
  const anomaliesMap = useVoxelStore((state) => state.anomalies);
  return useMemo(() => Array.from(anomaliesMap.values()), [anomaliesMap]);
};

/**
 * Select only active (unresolved) anomalies.
 * Uses useMemo to prevent infinite re-render loops.
 *
 * @returns Array of active anomalies
 */
export const useActiveAnomalies = (): VoxelAnomaly[] => {
  const anomaliesMap = useVoxelStore((state) => state.anomalies);
  return useMemo(
    () => Array.from(anomaliesMap.values()).filter((a) => a.status === 'active'),
    [anomaliesMap]
  );
};

/**
 * Select anomalies for a specific node.
 * Uses useMemo to prevent infinite re-render loops.
 *
 * @param nodeId - Node ID to get anomalies for
 * @returns Array of anomalies for the node
 */
export const useNodeAnomalies = (nodeId: string): VoxelAnomaly[] => {
  const anomaliesMap = useVoxelStore((state) => state.anomalies);
  return useMemo(
    () => Array.from(anomaliesMap.values()).filter((a) => a.nodeId === nodeId),
    [anomaliesMap, nodeId]
  );
};

/**
 * Select anomaly count grouped by severity.
 * Only counts active anomalies.
 * Uses useMemo to prevent infinite re-render loops.
 *
 * @returns Record of anomaly counts by severity
 */
export const useAnomalyCountBySeverity = (): Record<VoxelAnomaly['severity'], number> => {
  const anomaliesMap = useVoxelStore((state) => state.anomalies);

  return useMemo(() => {
    const counts: Record<VoxelAnomaly['severity'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    Array.from(anomaliesMap.values()).forEach((anomaly) => {
      if (anomaly.status === 'active') {
        counts[anomaly.severity]++;
      }
    });
    return counts;
  }, [anomaliesMap]);
};

// ============================================================================
// Filter Selectors
// ============================================================================

/**
 * Select current filter configuration.
 * Uses useShallow to prevent unnecessary re-renders.
 *
 * @returns Current filters
 */
export const useVoxelFilters = (): VoxelFilters =>
  useVoxelStore(useShallow((state) => state.filters));

// ============================================================================
// UI Selectors
// ============================================================================

/**
 * Select current UI state.
 * Uses useShallow to prevent unnecessary re-renders.
 *
 * @returns Current UI state
 */
export const useVoxelUI = (): VoxelUIState =>
  useVoxelStore(useShallow((state) => state.ui));

// ============================================================================
// Sync Selectors
// ============================================================================

/**
 * Select current sync state.
 * Uses useShallow to prevent unnecessary re-renders.
 *
 * @returns Current sync state
 */
export const useVoxelSync = (): VoxelSyncState =>
  useVoxelStore(useShallow((state) => state.sync));

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
