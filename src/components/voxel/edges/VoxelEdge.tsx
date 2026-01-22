/**
 * VoxelEdge - 3D edge component for visualizing connections
 *
 * Renders a line between two nodes with:
 * - Type-based coloring (dependency, mitigation, assignment, impact)
 * - Weight-based thickness and opacity
 * - Hover and selection states
 * - Optional dashed styling for weak connections
 *
 * @see Story VOX-3.1: Edge Component Creation
 * @see Story VOX-3.4: Edge Style Variation
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Line } from '@react-three/drei';
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

export interface VoxelEdgeProps {
  /** Edge data from the store */
  data: VoxelEdgeType;
  /** Source node position */
  sourcePosition: [number, number, number];
  /** Target node position */
  targetPosition: [number, number, number];
  /** Disable interactions */
  disabled?: boolean;
  /** Custom onClick handler */
  onClick?: (edge: VoxelEdgeType) => void;
  /** Custom onHover handler */
  onHover?: (edge: VoxelEdgeType | null) => void;
  /** Force highlight state (e.g., when connected node is selected) */
  forceHighlight?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const VoxelEdge: React.FC<VoxelEdgeProps> = ({
  data,
  sourcePosition,
  targetPosition,
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

  // Line points
  const points = useMemo(() => {
    return [
      new Vector3(...sourcePosition),
      new Vector3(...targetPosition),
    ];
  }, [sourcePosition, targetPosition]);

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
    <Line
      points={points}
      color={finalStyle.color}
      lineWidth={finalStyle.lineWidth}
      transparent
      opacity={finalStyle.opacity}
      dashed={finalStyle.dashed}
      dashScale={finalStyle.dashScale}
      dashSize={finalStyle.dashSize}
      gapSize={finalStyle.gapSize}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      userData={{ edgeId: data.id, edgeType: data.type }}
    />
  );
};

export default VoxelEdge;
