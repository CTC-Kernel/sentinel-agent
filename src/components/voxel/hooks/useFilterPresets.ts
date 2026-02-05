/**
 * useFilterPresets - Hook for managing filter presets
 *
 * Provides predefined filter configurations for common use cases
 * like viewing only risks, viewing critical items, etc.
 *
 * @see Story VOX-5.5: Filter Visual Feedback
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import { useCallback, useMemo } from 'react';
import { useVoxelStore } from '@/stores/voxelStore';
import type { VoxelFilters, VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface FilterPreset {
 /** Unique preset ID */
 id: string;
 /** Display name */
 name: string;
 /** Description */
 description: string;
 /** Icon name (Lucide) */
 icon: string;
 /** Filter configuration */
 filters: Partial<VoxelFilters>;
}

export interface UseFilterPresetsReturn {
 /** Available presets */
 presets: FilterPreset[];
 /** Apply a preset by ID */
 applyPreset: (presetId: string) => void;
 /** Check if a preset matches current filters */
 isPresetActive: (presetId: string) => boolean;
 /** Get the currently active preset ID (if any) */
 activePresetId: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const ALL_NODE_TYPES: VoxelNodeType[] = ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'];
const ALL_STATUSES: VoxelNodeStatus[] = ['normal', 'warning', 'critical', 'inactive'];

/**
 * Predefined filter presets
 */
export const FILTER_PRESETS: FilterPreset[] = [
 {
 id: 'all',
 name: 'Show All',
 description: 'Display all nodes without filtering',
 icon: 'Eye',
 filters: {
 nodeTypes: ALL_NODE_TYPES,
 statuses: ALL_STATUSES,
 searchQuery: '',
 showAnomaliesOnly: false,
 dateRange: undefined,
 },
 },
 {
 id: 'risks-only',
 name: 'Risks Only',
 description: 'Show only risk nodes',
 icon: 'AlertTriangle',
 filters: {
 nodeTypes: ['risk'],
 statuses: ALL_STATUSES,
 },
 },
 {
 id: 'assets-only',
 name: 'Assets Only',
 description: 'Show only asset nodes',
 icon: 'Server',
 filters: {
 nodeTypes: ['asset'],
 statuses: ALL_STATUSES,
 },
 },
 {
 id: 'controls-only',
 name: 'Controls Only',
 description: 'Show only control nodes',
 icon: 'Shield',
 filters: {
 nodeTypes: ['control'],
 statuses: ALL_STATUSES,
 },
 },
 {
 id: 'critical-items',
 name: 'Critical Items',
 description: 'Show only nodes with critical status',
 icon: 'AlertOctagon',
 filters: {
 nodeTypes: ALL_NODE_TYPES,
 statuses: ['critical'],
 },
 },
 {
 id: 'warnings',
 name: 'Warnings & Critical',
 description: 'Show nodes needing attention',
 icon: 'AlertCircle',
 filters: {
 nodeTypes: ALL_NODE_TYPES,
 statuses: ['warning', 'critical'],
 },
 },
 {
 id: 'anomalies',
 name: 'Anomalies',
 description: 'Show only nodes with anomalies',
 icon: 'Zap',
 filters: {
 nodeTypes: ALL_NODE_TYPES,
 statuses: ALL_STATUSES,
 showAnomaliesOnly: true,
 },
 },
 {
 id: 'risk-control-coverage',
 name: 'Risk-Control Coverage',
 description: 'Show risks and their mitigating controls',
 icon: 'GitMerge',
 filters: {
 nodeTypes: ['risk', 'control'],
 statuses: ALL_STATUSES,
 },
 },
 {
 id: 'asset-risk-map',
 name: 'Asset-Risk Map',
 description: 'Show assets and their associated risks',
 icon: 'Map',
 filters: {
 nodeTypes: ['asset', 'risk'],
 statuses: ALL_STATUSES,
 },
 },
 {
 id: 'inactive-hidden',
 name: 'Hide Inactive',
 description: 'Hide inactive nodes',
 icon: 'EyeOff',
 filters: {
 nodeTypes: ALL_NODE_TYPES,
 statuses: ['normal', 'warning', 'critical'],
 },
 },
];

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing filter presets.
 *
 * @example
 * ```tsx
 * const { presets, applyPreset, activePresetId } = useFilterPresets();
 *
 * // Apply a preset
 * <button onClick={() => applyPreset('risks-only')}>
 * Show Risks Only
 * </button>
 *
 * // Check if preset is active
 * {activePresetId === 'risks-only' && <CheckIcon />}
 * ```
 */
export function useFilterPresets(): UseFilterPresetsReturn {
 const filters = useVoxelStore((state) => state.filters);
 const setNodeTypeFilter = useVoxelStore((state) => state.setNodeTypeFilter);
 const setStatusFilter = useVoxelStore((state) => state.setStatusFilter);
 const setSearchQuery = useVoxelStore((state) => state.setSearchQuery);
 const setShowAnomaliesOnly = useVoxelStore((state) => state.setShowAnomaliesOnly);
 const setDateRangeFilter = useVoxelStore((state) => state.setDateRangeFilter);

 /**
 * Apply a preset by ID
 */
 const applyPreset = useCallback(
 (presetId: string) => {
 const preset = FILTER_PRESETS.find((p) => p.id === presetId);
 if (!preset) return;

 const { filters: presetFilters } = preset;

 if (presetFilters.nodeTypes) {
 setNodeTypeFilter(presetFilters.nodeTypes);
 }
 if (presetFilters.statuses) {
 setStatusFilter(presetFilters.statuses);
 }
 if (presetFilters.searchQuery !== undefined) {
 setSearchQuery(presetFilters.searchQuery);
 }
 if (presetFilters.showAnomaliesOnly !== undefined) {
 setShowAnomaliesOnly(presetFilters.showAnomaliesOnly);
 }
 if (presetFilters.dateRange !== undefined) {
 setDateRangeFilter(presetFilters.dateRange);
 }
 },
 [setNodeTypeFilter, setStatusFilter, setSearchQuery, setShowAnomaliesOnly, setDateRangeFilter]
 );

 /**
 * Check if a preset matches current filters
 */
 const isPresetActive = useCallback(
 (presetId: string): boolean => {
 const preset = FILTER_PRESETS.find((p) => p.id === presetId);
 if (!preset) return false;

 const { filters: presetFilters } = preset;

 // Compare node types
 if (presetFilters.nodeTypes) {
 const currentSet = new Set(filters.nodeTypes);
 const presetSet = new Set(presetFilters.nodeTypes);
 if (currentSet.size !== presetSet.size) return false;
 for (const type of currentSet) {
 if (!presetSet.has(type)) return false;
 }
 }

 // Compare statuses
 if (presetFilters.statuses) {
 const currentSet = new Set(filters.statuses);
 const presetSet = new Set(presetFilters.statuses);
 if (currentSet.size !== presetSet.size) return false;
 for (const status of currentSet) {
 if (!presetSet.has(status)) return false;
 }
 }

 // Compare search query
 if (presetFilters.searchQuery !== undefined && filters.searchQuery !== presetFilters.searchQuery) {
 return false;
 }

 // Compare anomalies only
 if (presetFilters.showAnomaliesOnly !== undefined && filters.showAnomaliesOnly !== presetFilters.showAnomaliesOnly) {
 return false;
 }

 return true;
 },
 [filters]
 );

 /**
 * Get the currently active preset ID
 */
 const activePresetId = useMemo(() => {
 for (const preset of FILTER_PRESETS) {
 if (isPresetActive(preset.id)) {
 return preset.id;
 }
 }
 return null;
 }, [isPresetActive]);

 return {
 presets: FILTER_PRESETS,
 applyPreset,
 isPresetActive,
 activePresetId,
 };
}

export default useFilterPresets;
