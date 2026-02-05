/**
 * Edge Slice
 *
 * Manages VoxelEdge entities in the store.
 * Handles CRUD operations for edges (connections between nodes).
 */

import type { VoxelEdge } from '../../types/voxel';
import type { EdgeSlice, VoxelSliceCreator } from './types';

/**
 * Creates the edge slice with all edge-related state and actions.
 *
 * @returns Edge slice state and actions
 */
export const createEdgeSlice: VoxelSliceCreator<EdgeSlice> = (set) => ({
 edges: new Map(),

 /**
 * Add a new edge to the store.
 * If an edge with the same ID exists, it will be overwritten.
 *
 * @param edge - The edge to add
 */
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

 /**
 * Update an existing edge by ID.
 *
 * @param id - The edge ID to update
 * @param updates - Partial edge updates to apply
 */
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

 /**
 * Remove an edge by ID.
 *
 * @param id - The edge ID to remove
 */
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

 /**
 * Replace all edges in the store.
 * Creates a new Map from the provided array.
 *
 * @param edges - Array of edges to set
 */
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

 /**
 * Clear all edges.
 */
 clearEdges: () => set(() => ({ edges: new Map() }), false, 'clearEdges'),
});
