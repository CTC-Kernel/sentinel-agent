/**
 * Anomaly Slice
 *
 * Manages VoxelAnomaly entities in the store.
 * Handles CRUD operations and status transitions for anomalies.
 * Automatically updates related node's anomalyIds when anomalies are added/removed.
 */

import type { VoxelAnomaly } from '../../types/voxel';
import type { AnomalySlice, VoxelSliceCreator } from './types';

/**
 * Creates the anomaly slice with all anomaly-related state and actions.
 *
 * @returns Anomaly slice state and actions
 */
export const createAnomalySlice: VoxelSliceCreator<AnomalySlice> = (set, get) => ({
  anomalies: new Map(),

  /**
   * Add a new anomaly to the store.
   * Also updates the related node's anomalyIds array.
   *
   * @param anomaly - The anomaly to add
   */
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

  /**
   * Update an existing anomaly by ID.
   *
   * @param id - The anomaly ID to update
   * @param updates - Partial anomaly updates to apply
   */
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

  /**
   * Remove an anomaly by ID.
   * Also updates the related node's anomalyIds array.
   *
   * @param id - The anomaly ID to remove
   */
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

  /**
   * Mark an anomaly as acknowledged.
   *
   * @param id - The anomaly ID to acknowledge
   */
  acknowledgeAnomaly: (id) => get().updateAnomaly(id, { status: 'acknowledged' }),

  /**
   * Mark an anomaly as resolved.
   *
   * @param id - The anomaly ID to resolve
   */
  resolveAnomaly: (id) => get().updateAnomaly(id, { status: 'resolved' }),

  /**
   * Mark an anomaly as dismissed.
   *
   * @param id - The anomaly ID to dismiss
   */
  dismissAnomaly: (id) => get().updateAnomaly(id, { status: 'dismissed' }),

  /**
   * Replace all anomalies in the store.
   * Creates a new Map from the provided array.
   *
   * @param anomalies - Array of anomalies to set
   */
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

  /**
   * Clear all anomalies.
   */
  clearAnomalies: () =>
    set(() => ({ anomalies: new Map() }), false, 'clearAnomalies'),
});
