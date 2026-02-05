/**
 * AssetNode - Asset-specific 3D node component
 *
 * Renders assets as blue spheres with size based on criticality.
 * Provides semantic wrapper around VoxelNode for asset entities.
 *
 * Visual Design:
 * - Geometry: Sphere (16 segments)
 * - Color: Blue (#3B82F6)
 * - Size: Based on criticality (1-5 → 4-16 units)
 *
 * @see Story VOX-2.1: Asset Node Rendering
 * @see FR5: Users can see Assets represented as 3D nodes
 */

import React from 'react';
import type { VoxelNode as VoxelNodeType } from '@/types/voxel';
import { VoxelNode, type VoxelNodeProps } from './VoxelNode';
import { ErrorLogger } from '@/services/errorLogger';

export interface AssetNodeProps extends Omit<VoxelNodeProps, 'data'> {
 /** Asset node data */
 data: VoxelNodeType;
}

/**
 * AssetNode renders assets as blue spheres.
 * Size scales with criticality from the asset data.
 */
export const AssetNode: React.FC<AssetNodeProps> = ({ data, ...props }) => {
 // Validate node type
 if (data.type !== 'asset') {
 ErrorLogger.warn(`AssetNode received non-asset node type: ${data.type}`, 'AssetNode');
 }

 return <VoxelNode data={data} {...props} />;
};

export default AssetNode;
