/**
 * NodeStyleResolver - Determines visual styling for VoxelNodes
 *
 * Centralizes all node styling logic including:
 * - Geometry type based on entity type
 * - Colors based on type and status
 * - Size based on criticality/severity
 * - Hover and selection states
 *
 * @see Story VOX-2.1: Node Component Creation
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import type { VoxelNode, VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export type GeometryType = 'sphere' | 'icosahedron' | 'box' | 'octahedron' | 'cylinder';

export interface NodeStyle {
  /** Geometry type to use */
  geometry: GeometryType;
  /** Base color (hex string) */
  color: string;
  /** Emissive color for glow effects */
  emissive: string;
  /** Emissive intensity */
  emissiveIntensity: number;
  /** Node size (radius/scale) */
  size: number;
  /** Metalness for PBR materials */
  metalness: number;
  /** Roughness for PBR materials */
  roughness: number;
  /** Opacity (1.0 = fully opaque) */
  opacity: number;
}

export interface NodeHoverStyle {
  /** Scale multiplier on hover */
  scale: number;
  /** Emissive intensity boost on hover */
  emissiveBoost: number;
}

export interface NodeSelectionStyle {
  /** Scale multiplier when selected */
  scale: number;
  /** Outline color for selection */
  outlineColor: string;
  /** Outline thickness */
  outlineThickness: number;
}

// ============================================================================
// Color Palettes
// ============================================================================

/** Base colors by node type */
export const NODE_TYPE_COLORS: Record<VoxelNodeType, string> = {
  asset: '#3B82F6',     // Blue
  risk: '#EF4444',      // Red (default, overridden by severity)
  control: '#8B5CF6',   // Purple
  incident: '#F97316',  // Orange
  supplier: '#06B6D4',  // Cyan
  project: '#10B981',   // Emerald
  audit: '#6366F1',     // Indigo
};

/** Risk severity colors (daltonism-safe palette) */
export const RISK_SEVERITY_COLORS = {
  critical: '#EF4444', // Red
  high: '#F97316',     // Orange
  medium: '#EAB308',   // Yellow
  low: '#22C55E',      // Green
} as const;

/** Status-based color modifiers */
export const STATUS_COLORS: Record<VoxelNodeStatus, string> = {
  normal: '',          // Use base color
  warning: '#F59E0B',  // Amber overlay
  critical: '#EF4444', // Red overlay
  inactive: '#6B7280', // Gray
};

// ============================================================================
// Geometry Mapping
// ============================================================================

/** Geometry type by node type */
export const NODE_TYPE_GEOMETRIES: Record<VoxelNodeType, GeometryType> = {
  asset: 'sphere',
  risk: 'icosahedron',
  control: 'box',
  incident: 'octahedron',
  supplier: 'cylinder',
  project: 'sphere',
  audit: 'box',
};

// ============================================================================
// Size Calculations
// ============================================================================

/** Base size range */
const BASE_SIZE = 8;
const MIN_SIZE_MULTIPLIER = 0.5;
const MAX_SIZE_MULTIPLIER = 2.0;

/**
 * Calculate node size based on criticality (1-5 scale)
 */
export function getSizeFromCriticality(criticality: number): number {
  const normalized = Math.max(1, Math.min(5, criticality)) / 5;
  const multiplier = MIN_SIZE_MULTIPLIER + normalized * (MAX_SIZE_MULTIPLIER - MIN_SIZE_MULTIPLIER);
  return BASE_SIZE * multiplier;
}

/**
 * Calculate node size based on severity level
 */
export function getSizeFromSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): number {
  const severityMap = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return getSizeFromCriticality(severityMap[severity]);
}

// ============================================================================
// Style Resolver
// ============================================================================

/**
 * Default style values - exported for reference/testing
 */
export const DEFAULT_NODE_STYLE: NodeStyle = {
  geometry: 'sphere',
  color: '#3B82F6',
  emissive: '#000000',
  emissiveIntensity: 0,
  size: BASE_SIZE,
  metalness: 0.3,
  roughness: 0.7,
  opacity: 1.0,
};

/**
 * Resolve complete style for a VoxelNode
 */
export function resolveNodeStyle(node: VoxelNode): NodeStyle {
  const baseColor = NODE_TYPE_COLORS[node.type];
  const geometry = NODE_TYPE_GEOMETRIES[node.type];

  // Calculate size based on node data
  let size = BASE_SIZE;
  if (node.data?.criticality !== undefined) {
    size = getSizeFromCriticality(node.data.criticality as number);
  } else if (node.data?.severity !== undefined) {
    size = getSizeFromSeverity(node.data.severity as 'low' | 'medium' | 'high' | 'critical');
  } else {
    size = node.size || BASE_SIZE;
  }

  // Determine color (risks use severity-based colors)
  let color = baseColor;
  if (node.type === 'risk' && node.data?.severity) {
    const severity = node.data.severity as keyof typeof RISK_SEVERITY_COLORS;
    color = RISK_SEVERITY_COLORS[severity] || baseColor;
  }

  // Apply status modifications
  let opacity = 1.0;
  let emissiveIntensity = 0;
  if (node.status === 'inactive') {
    opacity = 0.5;
    color = STATUS_COLORS.inactive;
  } else if (node.status === 'warning') {
    emissiveIntensity = 0.1;
  } else if (node.status === 'critical') {
    emissiveIntensity = 0.2;
  }

  return {
    geometry,
    color,
    emissive: color,
    emissiveIntensity,
    size,
    metalness: 0.3,
    roughness: 0.7,
    opacity,
  };
}

/**
 * Get hover style modifications
 */
export function getHoverStyle(): NodeHoverStyle {
  return {
    scale: 1.05,
    emissiveBoost: 0.1,
  };
}

/**
 * Get selection style modifications
 */
export function getSelectionStyle(): NodeSelectionStyle {
  return {
    scale: 1.1,
    outlineColor: '#FFFFFF',
    outlineThickness: 2,
  };
}

/**
 * Get color for a specific node type
 */
export function getNodeTypeColor(type: VoxelNodeType): string {
  return NODE_TYPE_COLORS[type];
}

/**
 * Get geometry type for a specific node type
 */
export function getNodeTypeGeometry(type: VoxelNodeType): GeometryType {
  return NODE_TYPE_GEOMETRIES[type];
}

/**
 * Get risk color by severity
 */
export function getRiskColor(severity: keyof typeof RISK_SEVERITY_COLORS): string {
  return RISK_SEVERITY_COLORS[severity];
}

export default {
  resolveNodeStyle,
  getHoverStyle,
  getSelectionStyle,
  getNodeTypeColor,
  getNodeTypeGeometry,
  getRiskColor,
  getSizeFromCriticality,
  getSizeFromSeverity,
};
