/**
 * Story 36-3: IT/OT Voxel Mapping - Shared Constants and Utilities
 *
 * This file contains shared constants, types, and utility functions
 * used across voxel components. Separated to fix fast refresh warnings.
 */

import type { NetworkSegment, OTCriticality } from '../../types/voxel';

// ============================================================================
// Types
// ============================================================================

export type ConnectionType = 'it-to-ot' | 'ot-to-it' | 'it-to-dmz' | 'dmz-to-ot' | 'same-segment';

// ============================================================================
// Network Segment Constants
// ============================================================================

/** Network segment colors */
export const SEGMENT_COLORS: Record<NetworkSegment, string> = {
  IT: '#3B82F6',   // Blue
  OT: '#F97316',   // Orange
  DMZ: '#EAB308', // Yellow
};

/** OT criticality size multipliers */
export const CRITICALITY_SIZES: Record<OTCriticality, number> = {
  safety: 1.5,
  production: 1.2,
  operations: 1.0,
  monitoring: 0.8,
};

/** OT criticality glow intensities */
export const CRITICALITY_GLOW: Record<OTCriticality, number> = {
  safety: 1.5,
  production: 1.0,
  operations: 0.6,
  monitoring: 0.4,
};

// ============================================================================
// Connection Type Utilities
// ============================================================================

/**
 * Determine connection type based on source and target segments
 */
export function getConnectionType(
  sourceSegment: NetworkSegment,
  targetSegment: NetworkSegment
): ConnectionType {
  if (sourceSegment === targetSegment) return 'same-segment';
  if (sourceSegment === 'IT' && targetSegment === 'OT') return 'it-to-ot';
  if (sourceSegment === 'OT' && targetSegment === 'IT') return 'ot-to-it';
  if (sourceSegment === 'IT' && targetSegment === 'DMZ') return 'it-to-dmz';
  if (sourceSegment === 'DMZ' && targetSegment === 'OT') return 'dmz-to-ot';
  return 'same-segment';
}

/**
 * Check if connection crosses segment boundaries
 */
export function isCrossSegmentConnection(
  sourceSegment?: NetworkSegment,
  targetSegment?: NetworkSegment
): boolean {
  if (!sourceSegment || !targetSegment) return false;
  return sourceSegment !== targetSegment;
}
