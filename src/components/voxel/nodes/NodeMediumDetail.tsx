/**
 * NodeMediumDetail - Medium-fidelity node rendering for mid-range views
 *
 * Used when camera is 50-200 units from the node.
 * Features:
 * - 16 segment geometry for balanced performance
 * - Simplified PBR materials
 * - Short labels only (no type badge)
 * - Reduced emissive effects
 *
 * @see Story VOX-2.6: Node LOD System
 * @see Architecture: architecture-voxel-module-2026-01-22.md#LOD
 */

import React, { useMemo } from 'react';
import { Color } from 'three';
import type { VoxelNode as VoxelNodeType } from '@/types/voxel';
import { resolveNodeStyle, type GeometryType } from '@/services/voxel/NodeStyleResolver';
import { VoxelNodeLabel } from './VoxelNodeLabel';

// ============================================================================
// Types
// ============================================================================

export interface NodeMediumDetailProps {
 /** Node data */
 data: VoxelNodeType;
 /** Whether node is selected */
 isSelected?: boolean;
 /** Whether node is hovered */
 isHovered?: boolean;
 /** Show text label (short version) */
 showLabel?: boolean;
 /** Camera distance for label opacity */
 cameraDistance?: number;
}

// ============================================================================
// Medium-Detail Geometry Components (16 segments)
// ============================================================================

const MEDIUM_DETAIL_SEGMENTS = 16;

interface GeometryProps {
 size: number;
}

const SphereGeometry: React.FC<GeometryProps> = ({ size }) => (
 <sphereGeometry args={[size, MEDIUM_DETAIL_SEGMENTS, MEDIUM_DETAIL_SEGMENTS]} />
);

const IcosahedronGeometry: React.FC<GeometryProps> = ({ size }) => (
 <icosahedronGeometry args={[size, 1]} /> // Medium subdivision
);

const BoxGeometry: React.FC<GeometryProps> = ({ size }) => (
 <boxGeometry args={[size * 1.5, size * 1.5, size * 1.5]} />
);

const OctahedronGeometry: React.FC<GeometryProps> = ({ size }) => (
 <octahedronGeometry args={[size, 0]} /> // No subdivision
);

const CylinderGeometry: React.FC<GeometryProps> = ({ size }) => (
 <cylinderGeometry args={[size * 0.8, size * 0.8, size * 1.5, MEDIUM_DETAIL_SEGMENTS]} />
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

export const NodeMediumDetail: React.FC<NodeMediumDetailProps> = ({
 data,
 isSelected = false,
 isHovered = false,
 showLabel = false,
 cameraDistance,
}) => {
 const style = useMemo(() => resolveNodeStyle(data), [data]);
 const GeometryComponent = GEOMETRY_MAP[style.geometry];

 const color = useMemo(() => new Color(style.color), [style.color]);
 const emissiveColor = useMemo(() => new Color(style.emissive), [style.emissive]);

 // Reduced emissive intensity for medium detail
 const emissiveIntensity = useMemo(() => {
 let intensity = style.emissiveIntensity * 0.5;
 if (isSelected) intensity += 0.1;
 else if (isHovered) intensity += 0.05;
 return intensity;
 }, [style.emissiveIntensity, isSelected, isHovered]);

 return (
 <group>
 <mesh castShadow receiveShadow>
 <GeometryComponent size={style.size} />
 <meshStandardMaterial
 color={color}
 emissive={emissiveColor}
 emissiveIntensity={emissiveIntensity}
 metalness={style.metalness * 0.5} // Simplified material
 roughness={Math.min(style.roughness + 0.2, 1)} // More rough
 transparent={style.opacity < 1}
 opacity={style.opacity}
 />
 </mesh>
 {showLabel && (
 <VoxelNodeLabel
 node={data}
 offsetY={style.size + 4}
 showTypeBadge={false} // No badge at medium distance
 visibleDistance={200}
 cameraDistance={cameraDistance}
 isSelected={isSelected}
 isHovered={isHovered}
 />
 )}
 </group>
 );
};

export default NodeMediumDetail;
