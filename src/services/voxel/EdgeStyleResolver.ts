/**
 * EdgeStyleResolver - Determines visual styling for VoxelEdges
 *
 * Centralizes all edge styling logic including:
 * - Colors based on edge type (dependency, mitigation, assignment, impact)
 * - Line width based on weight/strength
 * - Opacity and transparency settings
 * - Hover and selection states
 *
 * @see Story VOX-3.1: Edge Component Creation
 * @see Story VOX-3.4: Edge Style Variation
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import type { VoxelEdge } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface EdgeStyle {
 /** Line color (hex string) */
 color: string;
 /** Line width in pixels */
 lineWidth: number;
 /** Opacity (0-1) */
 opacity: number;
 /** Whether to show dashes */
 dashed: boolean;
 /** Dash scale (if dashed) */
 dashScale?: number;
 /** Dash size (if dashed) */
 dashSize?: number;
 /** Gap size between dashes (if dashed) */
 gapSize?: number;
}

export interface EdgeHoverStyle {
 /** Opacity boost on hover */
 opacityBoost: number;
 /** Line width multiplier on hover */
 lineWidthMultiplier: number;
}

export interface EdgeSelectionStyle {
 /** Opacity when selected */
 opacity: number;
 /** Line width multiplier when selected */
 lineWidthMultiplier: number;
 /** Glow color */
 glowColor: string;
}

// ============================================================================
// Color Palettes
// ============================================================================

/** Edge colors by type */
export const EDGE_TYPE_COLORS: Record<VoxelEdge['type'], string> = {
 dependency: '#64748B', // Slate gray - asset dependencies
 mitigation: '#8B5CF6', // Purple - control-asset connections
 assignment: '#3B82F6', // Blue - assignments
 impact: '#EF4444', // Red - risk-asset connections
};

/** Highlighted edge colors (more saturated) */
export const EDGE_TYPE_HIGHLIGHT_COLORS: Record<VoxelEdge['type'], string> = {
 dependency: '#94A3B8', // Lighter slate
 mitigation: '#A78BFA', // Lighter purple
 assignment: '#60A5FA', // Lighter blue
 impact: '#F87171', // Lighter red
};

// ============================================================================
// Line Width Calculations
// ============================================================================

/** Base line width */
const BASE_LINE_WIDTH = 1;
const MIN_LINE_WIDTH = 0.5;
const MAX_LINE_WIDTH = 4;

/**
 * Calculate line width based on edge weight (0-1 scale)
 */
export function getLineWidthFromWeight(weight: number): number {
 const normalized = Math.max(0, Math.min(1, weight));
 const width = BASE_LINE_WIDTH + normalized * (MAX_LINE_WIDTH - BASE_LINE_WIDTH);
 return Math.max(MIN_LINE_WIDTH, width);
}

// ============================================================================
// Opacity Calculations
// ============================================================================

/** Base opacity */
const BASE_OPACITY = 0.4;
const MIN_OPACITY = 0.2;
const MAX_OPACITY = 0.8;

/**
 * Calculate opacity based on edge weight (0-1 scale)
 */
export function getOpacityFromWeight(weight: number): number {
 const normalized = Math.max(0, Math.min(1, weight));
 return MIN_OPACITY + normalized * (MAX_OPACITY - MIN_OPACITY);
}

// ============================================================================
// Style Resolver
// ============================================================================

/**
 * Default edge style values
 */
export const DEFAULT_EDGE_STYLE: EdgeStyle = {
 color: EDGE_TYPE_COLORS.dependency,
 lineWidth: BASE_LINE_WIDTH,
 opacity: BASE_OPACITY,
 dashed: false,
};

/**
 * Resolve complete style for a VoxelEdge
 */
export function resolveEdgeStyle(edge: VoxelEdge): EdgeStyle {
 const color = EDGE_TYPE_COLORS[edge.type];
 const lineWidth = getLineWidthFromWeight(edge.weight);
 const opacity = getOpacityFromWeight(edge.weight);

 // Dependency edges can be dashed to distinguish from other types
 const dashed = edge.type === 'dependency' && edge.weight < 0.5;

 return {
 color,
 lineWidth,
 opacity,
 dashed,
 ...(dashed && {
 dashScale: 10,
 dashSize: 3,
 gapSize: 2,
 }),
 };
}

/**
 * Get hover style modifications
 */
export function getEdgeHoverStyle(): EdgeHoverStyle {
 return {
 opacityBoost: 0.3,
 lineWidthMultiplier: 1.5,
 };
}

/**
 * Get selection style modifications
 */
export function getEdgeSelectionStyle(): EdgeSelectionStyle {
 return {
 opacity: 0.9,
 lineWidthMultiplier: 2,
 glowColor: '#FFFFFF',
 };
}

/**
 * Get color for a specific edge type
 */
export function getEdgeTypeColor(type: VoxelEdge['type']): string {
 return EDGE_TYPE_COLORS[type];
}

/**
 * Get highlight color for a specific edge type
 */
export function getEdgeTypeHighlightColor(type: VoxelEdge['type']): string {
 return EDGE_TYPE_HIGHLIGHT_COLORS[type];
}

/**
 * Check if edge connects to a specific node
 */
export function edgeConnectsNode(edge: VoxelEdge, nodeId: string): boolean {
 return edge.source === nodeId || edge.target === nodeId;
}

/**
 * Get edge style when connected node is selected
 */
export function getConnectedEdgeStyle(edge: VoxelEdge): EdgeStyle {
 const baseStyle = resolveEdgeStyle(edge);
 const highlightColor = EDGE_TYPE_HIGHLIGHT_COLORS[edge.type];

 return {
 ...baseStyle,
 color: highlightColor,
 opacity: Math.min(baseStyle.opacity + 0.3, 0.9),
 lineWidth: baseStyle.lineWidth * 1.3,
 };
}

export default {
 resolveEdgeStyle,
 getEdgeHoverStyle,
 getEdgeSelectionStyle,
 getEdgeTypeColor,
 getEdgeTypeHighlightColor,
 getLineWidthFromWeight,
 getOpacityFromWeight,
 edgeConnectsNode,
 getConnectedEdgeStyle,
};
