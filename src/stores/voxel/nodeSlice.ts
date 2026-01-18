/**
 * Node Slice
 *
 * Manages VoxelNode entities in the store.
 * Handles CRUD operations for nodes with O(1) Map-based lookups.
 */

import type { VoxelNode } from '../../types/voxel';
import type { NodeSlice, VoxelSliceCreator } from './types';

/**
 * Creates the node slice with all node-related state and actions.
 *
 * @returns Node slice state and actions
 */
export const createNodeSlice: VoxelSliceCreator<NodeSlice> = (set, _get) => ({
  nodes: new Map(),

  /**
   * Add a new node to the store.
   * If a node with the same ID exists, it will be overwritten.
   *
   * @param node - The node to add
   */
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

  /**
   * Update an existing node by ID.
   * Automatically updates the `updatedAt` timestamp.
   *
   * @param id - The node ID to update
   * @param updates - Partial node updates to apply
   */
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

  /**
   * Remove a node by ID.
   * Also removes all edges connected to the node.
   *
   * @param id - The node ID to remove
   */
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

  /**
   * Replace all nodes in the store.
   * Creates a new Map from the provided array.
   *
   * @param nodes - Array of nodes to set
   */
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

  /**
   * Clear all nodes and their connected edges.
   */
  clearNodes: () =>
    set(() => ({ nodes: new Map(), edges: new Map() }), false, 'clearNodes'),
});
