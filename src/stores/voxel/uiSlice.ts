/**
 * UI Slice
 *
 * Manages UI-related state including filters, selection, camera, and view settings.
 * Combines both filter actions and UI view actions for cohesive user interaction state.
 */

// VoxelUIState, VoxelNodeType, VoxelNodeStatus types are accessed via state inference
import type { FilterSlice, UISlice, VoxelSliceCreator } from './types';
import { initialFilters, initialUI } from './types';

/**
 * Creates the filter slice with all filter-related state and actions.
 *
 * @returns Filter slice state and actions
 */
export const createFilterSlice: VoxelSliceCreator<FilterSlice> = (set) => ({
 filters: initialFilters,

 /**
 * Set the node type filter.
 *
 * @param types - Array of node types to show
 */
 setNodeTypeFilter: (types) =>
 set(
 (state) => ({ filters: { ...state.filters, nodeTypes: types } }),
 false,
 'setNodeTypeFilter'
 ),

 /**
 * Toggle a node type in the filter.
 * If the type is currently included, it will be removed; otherwise added.
 *
 * @param type - The node type to toggle
 */
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

 /**
 * Set the status filter.
 *
 * @param statuses - Array of statuses to show
 */
 setStatusFilter: (statuses) =>
 set(
 (state) => ({ filters: { ...state.filters, statuses } }),
 false,
 'setStatusFilter'
 ),

 /**
 * Toggle a status in the filter.
 * If the status is currently included, it will be removed; otherwise added.
 *
 * @param status - The status to toggle
 */
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

 /**
 * Set the date range filter.
 *
 * @param range - Date range object or undefined to clear
 */
 setDateRangeFilter: (range) =>
 set(
 (state) => ({ filters: { ...state.filters, dateRange: range } }),
 false,
 'setDateRangeFilter'
 ),

 /**
 * Set the search query filter.
 *
 * @param query - Search string
 */
 setSearchQuery: (query) =>
 set(
 (state) => ({ filters: { ...state.filters, searchQuery: query } }),
 false,
 'setSearchQuery'
 ),

 /**
 * Set whether to show only nodes with anomalies.
 *
 * @param show - True to show only anomaly nodes
 */
 setShowAnomaliesOnly: (show) =>
 set(
 (state) => ({ filters: { ...state.filters, showAnomaliesOnly: show } }),
 false,
 'setShowAnomaliesOnly'
 ),

 /**
 * Reset all filters to their default values.
 */
 resetFilters: () => set(() => ({ filters: initialFilters }), false, 'resetFilters'),
});

/**
 * Creates the UI slice with all UI view-related state and actions.
 *
 * @returns UI slice state and actions
 */
export const createUISlice: VoxelSliceCreator<UISlice> = (set) => ({
 ui: initialUI,

 /**
 * Select a node by ID.
 *
 * @param id - Node ID to select, or null to deselect
 */
 selectNode: (id) =>
 set(
 (state) => ({ ui: { ...state.ui, selectedNodeId: id } }),
 false,
 'selectNode'
 ),

 /**
 * Set the hovered node by ID.
 *
 * @param id - Node ID being hovered, or null when not hovering
 */
 hoverNode: (id) =>
 set(
 (state) => ({ ui: { ...state.ui, hoveredNodeId: id } }),
 false,
 'hoverNode'
 ),

 /**
 * Set the camera position in 3D space.
 *
 * @param position - Camera position coordinates
 */
 setCameraPosition: (position) =>
 set(
 (state) => ({ ui: { ...state.ui, cameraPosition: position } }),
 false,
 'setCameraPosition'
 ),

 /**
 * Set the camera target (look-at point) in 3D space.
 *
 * @param target - Camera target coordinates
 */
 setCameraTarget: (target) =>
 set(
 (state) => ({ ui: { ...state.ui, cameraTarget: target } }),
 false,
 'setCameraTarget'
 ),

 /**
 * Set the zoom level.
 *
 * @param zoom - Zoom multiplier
 */
 setZoom: (zoom) =>
 set((state) => ({ ui: { ...state.ui, zoom } }), false, 'setZoom'),

 /**
 * Toggle node labels visibility.
 */
 toggleLabels: () =>
 set(
 (state) => ({ ui: { ...state.ui, showLabels: !state.ui.showLabels } }),
 false,
 'toggleLabels'
 ),

 /**
 * Toggle edges visibility.
 */
 toggleEdges: () =>
 set(
 (state) => ({ ui: { ...state.ui, showEdges: !state.ui.showEdges } }),
 false,
 'toggleEdges'
 ),

 /**
 * Set the layout algorithm type.
 *
 * @param layout - Layout type to apply
 */
 setLayoutType: (layout) =>
 set(
 (state) => ({ ui: { ...state.ui, layoutType: layout } }),
 false,
 'setLayoutType'
 ),

 /**
 * Reset UI to default values.
 */
 resetUI: () => set(() => ({ ui: initialUI }), false, 'resetUI'),
});
