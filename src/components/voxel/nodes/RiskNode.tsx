/**
 * RiskNode - Risk-specific 3D node component
 *
 * Renders risks as icosahedrons (multi-faceted polyhedrons) with
 * color based on severity level.
 *
 * Visual Design:
 * - Geometry: Icosahedron (20 faces)
 * - Colors by severity:
 *   - Critical: Red (#EF4444)
 *   - High: Orange (#F97316)
 *   - Medium: Yellow (#EAB308)
 *   - Low: Green (#22C55E)
 *
 * @see Story VOX-2.3: Risk Node Rendering
 * @see Story VOX-2.4: Risk Color by Severity
 * @see FR7: Users can see Risks represented as distinct 3D nodes
 * @see FR8: Users can see risk node color reflect severity
 */

import React from 'react';
import type { VoxelNode as VoxelNodeType } from '@/types/voxel';
import { VoxelNode, type VoxelNodeProps } from './VoxelNode';

export interface RiskNodeProps extends Omit<VoxelNodeProps, 'data'> {
  /** Risk node data */
  data: VoxelNodeType;
}

/**
 * RiskNode renders risks as icosahedrons with severity-based colors.
 * The icosahedron geometry provides visual distinction from asset spheres.
 */
export const RiskNode: React.FC<RiskNodeProps> = ({ data, ...props }) => {
  // Validate node type
  if (data.type !== 'risk') {
    console.warn(`RiskNode received non-risk node type: ${data.type}`);
  }

  return <VoxelNode data={data} {...props} />;
};

export default RiskNode;
