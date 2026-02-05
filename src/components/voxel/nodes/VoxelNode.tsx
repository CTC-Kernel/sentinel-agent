/**
 * VoxelNode - Base 3D node component for all entity types
 *
 * Renders a single node in the 3D scene with:
 * - Type-specific geometry (sphere, icosahedron, box, etc.)
 * - Dynamic styling based on status and data
 * - Hover and selection interactions
 * - Animation support with reduced motion respect
 *
 * @see Story VOX-2.1: Node Component Creation
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, Color, MeshStandardMaterial, Vector3 } from 'three';
import type { VoxelNode as VoxelNodeType } from '@/types/voxel';
import { useVoxelStore } from '@/stores/voxelStore';
import {
 resolveNodeStyle,
 getHoverStyle,
 getSelectionStyle,
 type GeometryType,
} from '@/services/voxel/NodeStyleResolver';
import { VoxelNodeLabel } from './VoxelNodeLabel';

// ============================================================================
// Types
// ============================================================================

export interface VoxelNodeProps {
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
 /** Show text label above node */
 showLabel?: boolean;
 /** Show type badge in label */
 showTypeBadge?: boolean;
 /** Distance threshold for label visibility (in 3D units) */
 labelVisibleDistance?: number;
}

// ============================================================================
// Geometry Components
// ============================================================================

interface GeometryProps {
 size: number;
}

const SphereGeometry: React.FC<GeometryProps> = ({ size }) => (
 <sphereGeometry args={[size, 16, 16]} />
);

const IcosahedronGeometry: React.FC<GeometryProps> = ({ size }) => (
 <icosahedronGeometry args={[size, 0]} />
);

const BoxGeometry: React.FC<GeometryProps> = ({ size }) => (
 <boxGeometry args={[size * 1.5, size * 1.5, size * 1.5]} />
);

const OctahedronGeometry: React.FC<GeometryProps> = ({ size }) => (
 <octahedronGeometry args={[size, 0]} />
);

const CylinderGeometry: React.FC<GeometryProps> = ({ size }) => (
 <cylinderGeometry args={[size * 0.8, size * 0.8, size * 1.5, 16]} />
);

const GEOMETRY_MAP: Record<GeometryType, React.FC<GeometryProps>> = {
 sphere: SphereGeometry,
 icosahedron: IcosahedronGeometry,
 box: BoxGeometry,
 octahedron: OctahedronGeometry,
 cylinder: CylinderGeometry,
};

// ============================================================================
// Reduced Motion Hook
// ============================================================================

function usePrefersReducedMotion(): boolean {
 const [prefersReduced, setPrefersReduced] = useState(false);

 React.useEffect(() => {
 if (typeof window === 'undefined') return;

 const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
 setPrefersReduced(mediaQuery.matches);

 const handler = (event: MediaQueryListEvent) => {
 setPrefersReduced(event.matches);
 };

 mediaQuery.addEventListener('change', handler);
 return () => mediaQuery.removeEventListener('change', handler);
 }, []);

 return prefersReduced;
}

// ============================================================================
// Main Component
// ============================================================================

export const VoxelNode: React.FC<VoxelNodeProps> = ({
 data,
 position: overridePosition,
 disabled = false,
 onClick,
 onHover,
 showLabel = false,
 showTypeBadge = false,
 labelVisibleDistance = 200,
}) => {
 const meshRef = useRef<Mesh>(null);
 const [isHovered, setIsHovered] = useState(false);
 const [cameraDistance, setCameraDistance] = useState<number | undefined>(undefined);
 const prefersReducedMotion = usePrefersReducedMotion();
 const { camera } = useThree();

 // Store actions
 const selectNode = useVoxelStore((state) => state.selectNode);
 const hoverNode = useVoxelStore((state) => state.hoverNode);
 const selectedNodeId = useVoxelStore((state) => state.ui.selectedNodeId);
 const hoveredNodeId = useVoxelStore((state) => state.ui.hoveredNodeId);

 // Derived state
 const isSelected = selectedNodeId === data.id;
 const isStoreHovered = hoveredNodeId === data.id;

 // Resolve styles
 const style = useMemo(() => resolveNodeStyle(data), [data]);
 const hoverStyle = useMemo(() => getHoverStyle(), []);
 const selectionStyle = useMemo(() => getSelectionStyle(), []);

 // Position
 const nodePosition = useMemo<[number, number, number]>(() => {
 if (overridePosition) return overridePosition;
 return [data.position.x, data.position.y, data.position.z];
 }, [overridePosition, data.position]);

 // Calculate target scale
 const targetScale = useMemo(() => {
 if (isSelected) return selectionStyle.scale;
 if (isHovered || isStoreHovered) return hoverStyle.scale;
 return 1.0;
 }, [isSelected, isHovered, isStoreHovered, hoverStyle.scale, selectionStyle.scale]);

 // Calculate emissive intensity
 const targetEmissive = useMemo(() => {
 if (isSelected) return style.emissiveIntensity + 0.15;
 if (isHovered || isStoreHovered) return style.emissiveIntensity + hoverStyle.emissiveBoost;
 return style.emissiveIntensity;
 }, [isSelected, isHovered, isStoreHovered, style.emissiveIntensity, hoverStyle.emissiveBoost]);

 // Animation frame for smooth transitions
 useFrame(() => {
 if (!meshRef.current) return;

 // Calculate camera distance for label visibility
 if (showLabel) {
 const meshPosition = new Vector3(...nodePosition);
 const distance = camera.position.distanceTo(meshPosition);
 setCameraDistance(distance);
 }

 if (prefersReducedMotion) return;

 // Smooth scale transition
 const currentScale = meshRef.current.scale.x;
 const newScale = currentScale + (targetScale - currentScale) * 0.1;
 meshRef.current.scale.setScalar(newScale);

 // Smooth emissive transition
 const material = meshRef.current.material as MeshStandardMaterial;
 if (material.emissiveIntensity !== undefined) {
 material.emissiveIntensity += (targetEmissive - material.emissiveIntensity) * 0.1;
 }
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
 setIsHovered(true);

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
 setIsHovered(false);

 if (onHover) {
 onHover(null);
 } else {
 hoverNode(null);
 }
 },
 [onHover, hoverNode]
 );

 // Get geometry component
 const GeometryComponent = GEOMETRY_MAP[style.geometry];

 // Color objects
 const color = useMemo(() => new Color(style.color), [style.color]);
 const emissiveColor = useMemo(() => new Color(style.emissive), [style.emissive]);

 return (
 <group position={nodePosition}>
 <mesh
 ref={meshRef}
 onClick={handleClick}
 onPointerOver={handlePointerOver}
 onPointerOut={handlePointerOut}
 castShadow
 receiveShadow
 userData={{ nodeId: data.id, nodeType: data.type }}
 >
 <GeometryComponent size={style.size} />
 <meshStandardMaterial
 color={color}
 emissive={emissiveColor}
 emissiveIntensity={prefersReducedMotion ? targetEmissive : style.emissiveIntensity}
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
 showTypeBadge={showTypeBadge}
 visibleDistance={labelVisibleDistance}
 cameraDistance={cameraDistance}
 isSelected={isSelected}
 isHovered={isHovered || isStoreHovered}
 />
 )}
 </group>
 );
};

export default VoxelNode;
