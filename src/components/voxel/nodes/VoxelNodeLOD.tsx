/**
 * VoxelNodeLOD - Level of Detail wrapper for VoxelNode
 *
 * Automatically switches between high, medium, and low detail
 * node representations based on camera distance.
 *
 * Distance thresholds:
 * - < 50 units: High detail (32 segments, labels, glow)
 * - 50-200 units: Medium detail (16 segments, no labels)
 * - > 200 units: Low detail (8 segments, flat color)
 *
 * @see Story VOX-2.6: Node LOD System
 * @see Architecture: architecture-voxel-module-2026-01-22.md#LOD
 */

import React, { useMemo, useCallback, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Detailed } from '@react-three/drei';
import { Vector3 } from 'three';
import type { VoxelNode as VoxelNodeType } from '@/types/voxel';
import { useVoxelStore } from '@/stores/voxelStore';
import { NodeHighDetail } from './NodeHighDetail';
import { NodeMediumDetail } from './NodeMediumDetail';
import { NodeLowDetail } from './NodeLowDetail';

// ============================================================================
// Types
// ============================================================================

export interface VoxelNodeLODProps {
  /** Node data from the store */
  data: VoxelNodeType;
  /** Override position (useful for layout engines) */
  position?: [number, number, number];
  /** Disable interactions */
  disabled?: boolean;
  /** Custom onClick handler */
  onClick?: (node: VoxelNodeType) => void;
  /** Custom onHover handler */
  onHover?: (node: VoxelNodeType | null) => void;
  /** Show labels at appropriate LOD levels */
  showLabels?: boolean;
  /** Custom LOD distances [high, medium] (default: [50, 200]) */
  lodDistances?: [number, number];
}

// ============================================================================
// LOD Distance Constants
// ============================================================================

const DEFAULT_LOD_DISTANCES: [number, number] = [50, 200];

// ============================================================================
// Component
// ============================================================================

export const VoxelNodeLOD: React.FC<VoxelNodeLODProps> = ({
  data,
  position: overridePosition,
  disabled = false,
  onClick,
  onHover,
  showLabels = true,
  lodDistances = DEFAULT_LOD_DISTANCES,
}) => {
  const [cameraDistance, setCameraDistance] = useState<number>(0);
  const { camera } = useThree();

  // Store actions
  const selectNode = useVoxelStore((state) => state.selectNode);
  const hoverNode = useVoxelStore((state) => state.hoverNode);
  const selectedNodeId = useVoxelStore((state) => state.ui.selectedNodeId);
  const hoveredNodeId = useVoxelStore((state) => state.ui.hoveredNodeId);

  // Derived state
  const isSelected = selectedNodeId === data.id;
  const isHovered = hoveredNodeId === data.id;

  // Position
  const nodePosition = useMemo<[number, number, number]>(() => {
    if (overridePosition) return overridePosition;
    return [data.position.x, data.position.y, data.position.z];
  }, [overridePosition, data.position]);

  // Track camera distance for labels
  useFrame(() => {
    const meshPosition = new Vector3(...nodePosition);
    const distance = camera.position.distanceTo(meshPosition);
    setCameraDistance(distance);
  });

  // Event handlers
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return;
      event.stopPropagation();

      if (onClick) {
        onClick(data);
      } else {
        selectNode(data.id);
      }
    },
    [disabled, onClick, data, selectNode]
  );

  const handlePointerOver = useCallback(
    (event: React.PointerEvent) => {
      if (disabled) return;
      event.stopPropagation();

      if (onHover) {
        onHover(data);
      } else {
        hoverNode(data.id);
      }
    },
    [disabled, onHover, data, hoverNode]
  );

  const handlePointerOut = useCallback(
    (event: React.PointerEvent) => {
      event.stopPropagation();

      if (onHover) {
        onHover(null);
      } else {
        hoverNode(null);
      }
    },
    [onHover, hoverNode]
  );

  // LOD distances array for Detailed component
  const distances = useMemo(() => [0, ...lodDistances], [lodDistances]);

  return (
    <group
      position={nodePosition}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      userData={{ nodeId: data.id, nodeType: data.type }}
    >
      <Detailed distances={distances}>
        {/* High detail: < 50 units */}
        <NodeHighDetail
          data={data}
          isSelected={isSelected}
          isHovered={isHovered}
          showLabel={showLabels}
          cameraDistance={cameraDistance}
        />
        {/* Medium detail: 50-200 units */}
        <NodeMediumDetail
          data={data}
          isSelected={isSelected}
          isHovered={isHovered}
          showLabel={false} // No labels at medium distance by default
          cameraDistance={cameraDistance}
        />
        {/* Low detail: > 200 units */}
        <NodeLowDetail
          data={data}
          isSelected={isSelected}
        />
      </Detailed>
    </group>
  );
};

export default VoxelNodeLOD;
