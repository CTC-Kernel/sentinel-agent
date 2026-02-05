/**
 * ControlNode - Control-specific 3D node component
 *
 * Renders controls as purple cubes/boxes, providing clear visual
 * distinction from assets (spheres) and risks (icosahedrons).
 *
 * Visual Design:
 * - Geometry: Box (cube)
 * - Color: Purple (#8B5CF6)
 * - Size: Based on control effectiveness or fixed
 *
 * @see Story VOX-2.5: Control Node Rendering
 * @see FR9: Users can see Controls represented as distinct 3D nodes
 */

import React from 'react';
import type { VoxelNode as VoxelNodeType } from '@/types/voxel';
import { VoxelNode, type VoxelNodeProps } from './VoxelNode';
import { ErrorLogger } from '@/services/errorLogger';

export interface ControlNodeProps extends Omit<VoxelNodeProps, 'data'> {
 /** Control node data */
 data: VoxelNodeType;
}

/**
 * ControlNode renders controls as purple cubes.
 * The box geometry provides clear visual distinction from other node types.
 */
export const ControlNode: React.FC<ControlNodeProps> = ({ data, ...props }) => {
 // Validate node type
 if (data.type !== 'control') {
 ErrorLogger.warn(`ControlNode received non-control node type: ${data.type}`, 'ControlNode');
 }

 return <VoxelNode data={data} {...props} />;
};

export default ControlNode;
