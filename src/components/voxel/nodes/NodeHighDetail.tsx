/**
 * NodeHighDetail - High-fidelity node rendering for close-up views
 *
 * Used when camera is within 50 units of the node.
 * Features:
 * - 32 segment geometry for smooth appearance
 * - Full PBR materials with metalness/roughness
 * - Labels enabled
 * - Emissive glow effects
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

export interface NodeHighDetailProps {
 /** Node data */
 data: VoxelNodeType;
 /** Whether node is selected */
 isSelected?: boolean;
 /** Whether node is hovered */
 isHovered?: boolean;
 /** Show text label */
 showLabel?: boolean;
 /** Camera distance for label opacity */
 cameraDistance?: number;
}

// ============================================================================
// High-Detail Geometry Components (32 segments)
// ============================================================================

const HIGH_DETAIL_SEGMENTS = 32;

interface GeometryProps {
 size: number;
}

const SphereGeometry: React.FC<GeometryProps> = ({ size }) => (
 <sphereGeometry args={[size, HIGH_DETAIL_SEGMENTS, HIGH_DETAIL_SEGMENTS]} />
);

const IcosahedronGeometry: React.FC<GeometryProps> = ({ size }) => (
 <icosahedronGeometry args={[size, 2]} /> // Higher subdivision
);

const BoxGeometry: React.FC<GeometryProps> = ({ size }) => (
 <boxGeometry args={[size * 1.5, size * 1.5, size * 1.5]} />
);

const OctahedronGeometry: React.FC<GeometryProps> = ({ size }) => (
 <octahedronGeometry args={[size, 1]} /> // Higher subdivision
);

const CylinderGeometry: React.FC<GeometryProps> = ({ size }) => (
 <cylinderGeometry args={[size * 0.8, size * 0.8, size * 1.5, HIGH_DETAIL_SEGMENTS]} />
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

export const NodeHighDetail: React.FC<NodeHighDetailProps> = ({
 data,
 isSelected = false,
 isHovered = false,
 showLabel = true,
 cameraDistance,
}) => {
 const style = useMemo(() => resolveNodeStyle(data), [data]);
 const GeometryComponent = GEOMETRY_MAP[style.geometry];

 const color = useMemo(() => new Color(style.color), [style.color]);
 const emissiveColor = useMemo(() => new Color(style.emissive), [style.emissive]);

 // Calculate emissive intensity based on state
 const emissiveIntensity = useMemo(() => {
 let intensity = style.emissiveIntensity;
 if (isSelected) intensity += 0.15;
 else if (isHovered) intensity += 0.1;
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
 metalness={style.metalness}
 roughness={style.roughness}
 transparent={style.opacity < 1}
 opacity={style.opacity}
 />
 </mesh>
 {showLabel && (
 <VoxelNodeLabel
 node={data}
 offsetY={style.size + 4}
 showTypeBadge
 visibleDistance={50}
 cameraDistance={cameraDistance}
 isSelected={isSelected}
 isHovered={isHovered}
 />
 )}
 </group>
 );
};

export default NodeHighDetail;
