/**
 * NodeLowDetail - Low-fidelity node rendering for distant views
 *
 * Used when camera is beyond 200 units from the node.
 * Features:
 * - 8 segment geometry for maximum performance
 * - Basic flat material (MeshBasicMaterial)
 * - No labels
 * - No emissive effects
 * - Point-like appearance
 *
 * @see Story VOX-2.6: Node LOD System
 * @see Architecture: architecture-voxel-module-2026-01-22.md#LOD
 */

import React, { useMemo } from 'react';
import { Color } from 'three';
import type { VoxelNode as VoxelNodeType } from '@/types/voxel';
import { resolveNodeStyle, type GeometryType } from '@/services/voxel/NodeStyleResolver';

// ============================================================================
// Types
// ============================================================================

export interface NodeLowDetailProps {
 /** Node data */
 data: VoxelNodeType;
 /** Whether node is selected (affects visibility) */
 isSelected?: boolean;
}

// ============================================================================
// Low-Detail Geometry Components (8 segments, simplified shapes)
// ============================================================================

const LOW_DETAIL_SEGMENTS = 8;

interface GeometryProps {
 size: number;
}

// All geometries simplified to basic shapes for distant view
const SphereGeometry: React.FC<GeometryProps> = ({ size }) => (
 <sphereGeometry args={[size, LOW_DETAIL_SEGMENTS, LOW_DETAIL_SEGMENTS]} />
);

const IcosahedronGeometry: React.FC<GeometryProps> = ({ size }) => (
 <icosahedronGeometry args={[size, 0]} /> // Minimal subdivision
);

const BoxGeometry: React.FC<GeometryProps> = ({ size }) => (
 <boxGeometry args={[size * 1.5, size * 1.5, size * 1.5]} />
);

const OctahedronGeometry: React.FC<GeometryProps> = ({ size }) => (
 <octahedronGeometry args={[size, 0]} />
);

const CylinderGeometry: React.FC<GeometryProps> = ({ size }) => (
 <cylinderGeometry args={[size * 0.8, size * 0.8, size * 1.5, LOW_DETAIL_SEGMENTS]} />
);

const GEOMETRY_MAP: Record<GeometryType, React.FC<GeometryProps>> = {
 sphere: SphereGeometry,
 icosahedron: IcosahedronGeometry,
 box: BoxGeometry,
 octahedron: OctahedronGeometry,
 cylinder: CylinderGeometry,
};

// ============================================================================
// Component
// ============================================================================

export const NodeLowDetail: React.FC<NodeLowDetailProps> = ({
 data,
 isSelected = false,
}) => {
 const style = useMemo(() => resolveNodeStyle(data), [data]);
 const GeometryComponent = GEOMETRY_MAP[style.geometry];

 const color = useMemo(() => new Color(style.color), [style.color]);

 // Selected nodes get slight brightness boost even at low detail
 const displayColor = useMemo(() => {
 if (isSelected) {
 const brightColor = color.clone();
 brightColor.multiplyScalar(1.2);
 return brightColor;
 }
 return color;
 }, [color, isSelected]);

 return (
 <mesh>
 <GeometryComponent size={style.size * 0.8} /> {/* Slightly smaller at distance */}
 <meshBasicMaterial
 color={displayColor}
 transparent={style.opacity < 1}
 opacity={style.opacity}
 />
 </mesh>
 );
};

export default NodeLowDetail;
