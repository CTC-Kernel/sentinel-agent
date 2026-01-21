/**
 * Story 36-3: IT/OT Voxel Mapping - Segment Zone Utilities
 *
 * Utility functions for segment zone calculations.
 * Separated from SegmentZones.tsx to fix fast refresh warnings.
 */

import type { NetworkSegment } from '../../types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface SegmentZone {
  /** Segment type */
  segment: NetworkSegment;
  /** Zone center position */
  position: { x: number; y: number; z: number };
  /** Zone size (width, height, depth) */
  size: { width: number; height: number; depth: number };
  /** Number of nodes in this segment */
  nodeCount: number;
  /** Whether segment is visible */
  visible: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate segment zones from node positions
 */
export function calculateSegmentZones(
  nodes: Array<{ networkSegment?: NetworkSegment; position: { x: number; y: number; z: number } }>,
  padding: number = 5
): SegmentZone[] {
  const segmentNodes: Record<NetworkSegment, typeof nodes> = {
    IT: [],
    OT: [],
    DMZ: [],
  };

  // Group nodes by segment
  nodes.forEach((node) => {
    const segment = node.networkSegment || 'IT';
    segmentNodes[segment].push(node);
  });

  // Calculate zone bounds for each segment
  const zones: SegmentZone[] = [];

  (['IT', 'OT', 'DMZ'] as NetworkSegment[]).forEach((segment) => {
    const segmentNodeList = segmentNodes[segment];
    if (segmentNodeList.length === 0) {
      // Empty zone - create small placeholder
      zones.push({
        segment,
        position: { x: segment === 'IT' ? -20 : segment === 'OT' ? 20 : 0, y: 0, z: 0 },
        size: { width: 10, height: 10, depth: 10 },
        nodeCount: 0,
        visible: false,
      });
      return;
    }

    // Calculate bounding box
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    segmentNodeList.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y);
      minZ = Math.min(minZ, node.position.z);
      maxZ = Math.max(maxZ, node.position.z);
    });

    // Add padding
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const depth = maxZ - minZ + padding * 2;

    zones.push({
      segment,
      position: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      },
      size: {
        width: Math.max(width, 10),
        height: Math.max(height, 10),
        depth: Math.max(depth, 10),
      },
      nodeCount: segmentNodeList.length,
      visible: true,
    });
  });

  return zones;
}

/**
 * Apply segment-based positioning to nodes
 * Separates IT and OT nodes into distinct zones
 */
export function applySegmentLayout(
  nodes: Array<{
    id: string;
    networkSegment?: NetworkSegment;
    position: { x: number; y: number; z: number };
  }>,
  spacing: number = 30
): typeof nodes {
  return nodes.map((node) => {
    const segment = node.networkSegment || 'IT';
    let xOffset = 0;

    switch (segment) {
      case 'IT':
        xOffset = -spacing;
        break;
      case 'OT':
        xOffset = spacing;
        break;
      case 'DMZ':
        xOffset = 0;
        break;
    }

    return {
      ...node,
      position: {
        ...node.position,
        x: node.position.x + xOffset,
      },
    };
  });
}
