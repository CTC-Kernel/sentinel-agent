/**
 * Voxel Theme Constants
 *
 * Centralized color and style constants for the 3D visualization module.
 * Uses CSS variables for dark/light mode support.
 *
 * AUDIT FIX: All hardcoded hex colors moved here with CSS variable alternatives.
 * For WebGL/Three.js contexts that require hex colors, use the HEX versions.
 * For React DOM elements, use the CSS variable versions.
 *
 * @see architecture-voxel-module-2026-01-22.md
 */

import type { VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';

// ============================================================================
// CSS Variable-based colors (for React DOM elements)
// ============================================================================

/**
 * Node type colors using CSS variables - for DOM elements
 */
export const VOXEL_NODE_TYPE_COLORS_CSS = {
  asset: 'hsl(var(--chart-series-1))',      // Blue
  risk: 'hsl(var(--chart-critical))',        // Red
  control: 'hsl(var(--chart-series-3))',     // Purple
  audit: 'hsl(var(--chart-high))',           // Orange
  project: 'hsl(var(--chart-low))',          // Green
  incident: 'hsl(var(--chart-series-5))',    // Amber
  supplier: 'hsl(var(--chart-series-4))',    // Cyan/Indigo
} as const satisfies Record<VoxelNodeType, string>;

/**
 * Status colors using CSS variables - for DOM elements
 */
export const VOXEL_STATUS_COLORS_CSS = {
  normal: 'hsl(var(--chart-low))',           // Green
  warning: 'hsl(var(--chart-medium))',       // Yellow/Amber
  critical: 'hsl(var(--chart-critical))',    // Red
  inactive: 'hsl(var(--muted-foreground))',  // Gray
} as const satisfies Record<VoxelNodeStatus, string>;

/**
 * Edge/connection type colors using CSS variables
 */
export const VOXEL_EDGE_COLORS_CSS = {
  impact: 'hsl(var(--chart-critical))',      // Red
  mitigation: 'hsl(var(--chart-low))',       // Green
  dependency: 'hsl(var(--chart-series-1))',  // Blue
  assignment: 'hsl(var(--chart-series-3))',  // Purple
} as const;

// ============================================================================
// Hex colors (for Three.js/WebGL contexts)
// ============================================================================

/**
 * Node type colors as hex - for Three.js materials
 * Light mode optimized values
 */
export const VOXEL_NODE_TYPE_COLORS_HEX = {
  asset: 0x3B82F6,     // Blue
  risk: 0xEF4444,      // Red
  control: 0x8B5CF6,   // Purple
  audit: 0xF59E0B,     // Orange/Amber
  project: 0x10B981,   // Green
  incident: 0xF97316,  // Orange
  supplier: 0x6366F1,  // Indigo
} as const satisfies Record<VoxelNodeType, number>;

/**
 * Status colors as hex - for Three.js materials
 */
export const VOXEL_STATUS_COLORS_HEX = {
  normal: 0x22C55E,    // Green
  warning: 0xF59E0B,   // Amber
  critical: 0xEF4444,  // Red
  inactive: 0x64748B,  // Slate gray
} as const satisfies Record<VoxelNodeStatus, number>;

/**
 * Edge colors as hex - for Three.js line materials
 */
export const VOXEL_EDGE_COLORS_HEX = {
  impact: 0xEF4444,    // Red
  mitigation: 0x22C55E, // Green
  dependency: 0x3B82F6, // Blue
  assignment: 0x8B5CF6, // Purple
} as const;

// ============================================================================
// UI Panel Styles (for overlay components)
// ============================================================================

/**
 * Glass panel styles for Voxel overlays
 * Uses CSS variables internally
 */
export const VOXEL_PANEL_STYLES = {
  /** Standard glass panel background */
  background: 'var(--glass-bg-intense, rgba(15, 23, 42, 0.95))',
  /** Backdrop blur for glass effect */
  backdropFilter: 'blur(20px)',
  /** Panel border */
  border: '1px solid var(--glass-border, rgba(148, 163, 184, 0.1))',
  /** Panel shadow */
  boxShadow: 'var(--shadow-xl, 0 4px 24px rgba(0, 0, 0, 0.3))',
} as const;

/**
 * Get inline styles for a Voxel glass panel
 */
export function getVoxelPanelStyles(): React.CSSProperties {
  return {
    background: VOXEL_PANEL_STYLES.background,
    backdropFilter: VOXEL_PANEL_STYLES.backdropFilter,
    WebkitBackdropFilter: VOXEL_PANEL_STYLES.backdropFilter,
    border: VOXEL_PANEL_STYLES.border,
    boxShadow: VOXEL_PANEL_STYLES.boxShadow,
  };
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Get CSS variable color for a node type
 */
export function getNodeTypeColorCSS(type: VoxelNodeType): string {
  return VOXEL_NODE_TYPE_COLORS_CSS[type] || 'hsl(var(--muted-foreground))';
}

/**
 * Get hex color for a node type (for Three.js)
 */
export function getNodeTypeColorHex(type: VoxelNodeType): number {
  return VOXEL_NODE_TYPE_COLORS_HEX[type] || 0x64748B;
}

/**
 * Get CSS variable color for a status
 */
export function getStatusColorCSS(status: VoxelNodeStatus): string {
  return VOXEL_STATUS_COLORS_CSS[status] || 'hsl(var(--muted-foreground))';
}

/**
 * Get hex color for a status (for Three.js)
 */
export function getStatusColorHex(status: VoxelNodeStatus): number {
  return VOXEL_STATUS_COLORS_HEX[status] || 0x64748B;
}

/**
 * Convert hex number to CSS hex string
 */
export function hexToString(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

// ============================================================================
// Annotation/Marker Colors
// ============================================================================

export const VOXEL_ANNOTATION_COLORS = [
  { hex: 0x3B82F6, css: 'hsl(var(--chart-series-1))', label: 'Blue' },
  { hex: 0x8B5CF6, css: 'hsl(var(--chart-series-3))', label: 'Purple' },
  { hex: 0xEF4444, css: 'hsl(var(--chart-critical))', label: 'Red' },
  { hex: 0xF59E0B, css: 'hsl(var(--chart-high))', label: 'Amber' },
  { hex: 0x22C55E, css: 'hsl(var(--chart-low))', label: 'Green' },
  { hex: 0x06B6D4, css: 'hsl(var(--info))', label: 'Cyan' },
  { hex: 0xEC4899, css: 'hsl(270 60% 55%)', label: 'Pink' },
  { hex: 0x6B7280, css: 'hsl(var(--muted-foreground))', label: 'Gray' },
] as const;

// ============================================================================
// AR/VR Scene Colors
// ============================================================================

export const VOXEL_AR_VR_COLORS = {
  /** Grid color */
  grid: 0x475569,
  /** Ambient light color */
  ambientLight: 0xFFFFFF,
  /** Directional light color */
  directionalLight: 0xFFFFFF,
  /** Controller beam color */
  controllerBeam: 0x4ECDC4,
  /** Selection highlight */
  selectionHighlight: 0xFDE047,
  /** Success indicator */
  success: 0x22C55E,
  /** Error indicator */
  error: 0xEF4444,
} as const;
