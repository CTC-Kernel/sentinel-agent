/**
 * VoxelNodeRenderer - Renders all visible nodes in the scene
 *
 * Manages the rendering of multiple VoxelNodes based on the current
 * filter state. Optimizes rendering by only showing filtered nodes.
 *
 * @see Story VOX-2.1: Node Component Creation
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useMemo } from 'react';
import type { VoxelNode as VoxelNodeType } from '@/types/voxel';
import { useFilteredNodes } from '@/stores/voxelStore';
import { VoxelNode } from './VoxelNode';

export interface VoxelNodeRendererProps {
  /** Override nodes to render (bypasses store) */
  nodes?: VoxelNodeType[];
  /** Disable all node interactions */
  disabled?: boolean;
  /** Custom click handler for all nodes */
  onNodeClick?: (node: VoxelNodeType) => void;
  /** Custom hover handler for all nodes */
  onNodeHover?: (node: VoxelNodeType | null) => void;
}

/**
 * VoxelNodeRenderer renders all visible nodes based on current filters.
 * Uses the voxelStore's filtered nodes selector for optimized rendering.
 */
export const VoxelNodeRenderer: React.FC<VoxelNodeRendererProps> = ({
  nodes: overrideNodes,
  disabled = false,
  onNodeClick,
  onNodeHover,
}) => {
  // Get filtered nodes from store if not overridden
  const storeNodes = useFilteredNodes();

  // Use override nodes or store nodes
  const nodesToRender = useMemo(() => {
    if (overrideNodes) return overrideNodes;
    return storeNodes;
  }, [overrideNodes, storeNodes]);

  return (
    <group name="voxel-nodes">
      {nodesToRender.map((node) => (
        <VoxelNode
          key={node.id}
          data={node}
          disabled={disabled}
          onClick={onNodeClick}
          onHover={onNodeHover}
        />
      ))}
    </group>
  );
};

export default VoxelNodeRenderer;
