/**
 * VoxelEdgeCurved - Curved edge variant using quadratic Bezier
 *
 * Alternative to straight line edges that:
 * - Creates visual separation when multiple edges exist
 * - Uses quadratic Bezier curves for smooth arcs
 * - Helpful for dense graphs with overlapping edges
 *
 * @see Story VOX-3.1: Edge Component Creation
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useMemo, useCallback, useState } from 'react';
import { QuadraticBezierLine } from '@react-three/drei';
import { Vector3 } from 'three';
import type { VoxelEdge as VoxelEdgeType } from '@/types/voxel';
import { useVoxelStore } from '@/stores/voxelStore';
import {
  resolveEdgeStyle,
  getEdgeHoverStyle,
  getConnectedEdgeStyle,
  edgeConnectsNode,
} from '@/services/voxel/EdgeStyleResolver';

// ============================================================================
// Types
// ============================================================================

export interface VoxelEdgeCurvedProps {
  /** Edge data from the store */
  data: VoxelEdgeType;
  /** Source node position */
  sourcePosition: [number, number, number];
  /** Target node position */
  targetPosition: [number, number, number];
  /** Curve offset factor (0 = straight, higher = more curved) */
  curveOffset?: number;
  /** Disable interactions */
  disabled?: boolean;
  /** Custom onClick handler */
  onClick?: (edge: VoxelEdgeType) => void;
  /** Custom onHover handler */
  onHover?: (edge: VoxelEdgeType | null) => void;
  /** Force highlight state */
  forceHighlight?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate control point for quadratic bezier curve
 * Creates an arc perpendicular to the line between source and target
 */
function calculateControlPoint(
  source: Vector3,
  target: Vector3,
  offset: number
): Vector3 {
  // Midpoint
  const mid = new Vector3().addVectors(source, target).multiplyScalar(0.5);

  // Direction from source to target
  const direction = new Vector3().subVectors(target, source).normalize();

  // Perpendicular vector (in XZ plane for horizontal arcs)
  const perpendicular = new Vector3(-direction.z, 0, direction.x);

  // If the perpendicular is near zero (vertical edge), use Y offset
  if (perpendicular.length() < 0.01) {
    perpendicular.set(1, 0, 0);
  }

  // Calculate distance for offset scaling
  const distance = source.distanceTo(target);
  const scaledOffset = offset * (distance * 0.2);

  // Control point is midpoint + perpendicular offset + slight Y lift
  return mid
    .clone()
    .add(perpendicular.multiplyScalar(scaledOffset))
    .add(new Vector3(0, scaledOffset * 0.3, 0));
}

// ============================================================================
// Component
// ============================================================================

export const VoxelEdgeCurved: React.FC<VoxelEdgeCurvedProps> = ({
  data,
  sourcePosition,
  targetPosition,
  curveOffset = 1,
  disabled = false,
  onClick,
  onHover,
  forceHighlight = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Store state
  const selectedNodeId = useVoxelStore((state) => state.ui.selectedNodeId);

  // Check if edge connects to selected node
  const isConnectedToSelected = useMemo(() => {
    if (!selectedNodeId) return false;
    return edgeConnectsNode(data, selectedNodeId);
  }, [selectedNodeId, data]);

  // Resolve styles
  const baseStyle = useMemo(() => {
    if (isConnectedToSelected || forceHighlight) {
      return getConnectedEdgeStyle(data);
    }
    return resolveEdgeStyle(data);
  }, [data, isConnectedToSelected, forceHighlight]);

  const hoverStyle = useMemo(() => getEdgeHoverStyle(), []);

  // Calculate final style values
  const finalStyle = useMemo(() => {
    let opacity = baseStyle.opacity;
    let lineWidth = baseStyle.lineWidth;

    if (isHovered) {
      opacity = Math.min(opacity + hoverStyle.opacityBoost, 1);
      lineWidth *= hoverStyle.lineWidthMultiplier;
    }

    return {
      ...baseStyle,
      opacity,
      lineWidth,
    };
  }, [baseStyle, isHovered, hoverStyle]);

  // Calculate curve points
  const { start, end, mid } = useMemo(() => {
    const source = new Vector3(...sourcePosition);
    const target = new Vector3(...targetPosition);
    const control = calculateControlPoint(source, target, curveOffset);

    return {
      start: source,
      end: target,
      mid: control,
    };
  }, [sourcePosition, targetPosition, curveOffset]);

  // Event handlers
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return;
      event.stopPropagation();

      if (onClick) {
        onClick(data);
      }
    },
    [disabled, onClick, data]
  );

  const handlePointerOver = useCallback(
    (event: React.PointerEvent) => {
      if (disabled) return;
      event.stopPropagation();
      setIsHovered(true);

      if (onHover) {
        onHover(data);
      }
    },
    [disabled, onHover, data]
  );

  const handlePointerOut = useCallback(
    (event: React.PointerEvent) => {
      event.stopPropagation();
      setIsHovered(false);

      if (onHover) {
        onHover(null);
      }
    },
    [onHover]
  );

  return (
    <QuadraticBezierLine
      start={start}
      end={end}
      mid={mid}
      color={finalStyle.color}
      lineWidth={finalStyle.lineWidth}
      transparent
      opacity={finalStyle.opacity}
      dashed={finalStyle.dashed}
      dashScale={finalStyle.dashScale}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  );
};

export default VoxelEdgeCurved;
