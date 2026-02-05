/**
 * SelectionGlow - Visual halo effect for selected nodes
 *
 * Renders a glowing ring/halo around selected nodes to provide
 * clear visual feedback. Uses emissive material with pulsing animation.
 *
 * @see Story VOX-4.4: Node Click Selection
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, RingGeometry, MeshBasicMaterial, DoubleSide, Color } from 'three';

// ============================================================================
// Types
// ============================================================================

export interface SelectionGlowProps {
 /** Base size to calculate ring radius */
 size: number;
 /** Color of the glow effect */
 color?: string;
 /** Glow intensity (opacity) */
 intensity?: number;
 /** Enable pulsing animation */
 animate?: boolean;
 /** Animation speed (pulses per second) */
 pulseSpeed?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default glow color (bright cyan) */
const DEFAULT_GLOW_COLOR = '#00D9FF';

/** Default glow intensity */
const DEFAULT_INTENSITY = 0.6;

/** Default pulse speed */
const DEFAULT_PULSE_SPEED = 1.5;

// ============================================================================
// Component
// ============================================================================

/**
 * SelectionGlow renders a glowing ring around selected nodes.
 *
 * The ring uses a pulsing animation for visual emphasis and
 * scales based on the node's size.
 *
 * @example
 * ```tsx
 * <group position={nodePosition}>
 * <NodeMesh />
 * {isSelected && <SelectionGlow size={nodeSize} />}
 * </group>
 * ```
 */
export const SelectionGlow: React.FC<SelectionGlowProps> = ({
 size,
 color = DEFAULT_GLOW_COLOR,
 intensity = DEFAULT_INTENSITY,
 animate = true,
 pulseSpeed = DEFAULT_PULSE_SPEED,
}) => {
 const ringRef = useRef<Mesh>(null);
 const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
 typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
 );

 // Check for reduced motion preference
 useEffect(() => {
 const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

 const handler = (event: MediaQueryListEvent) => {
 setPrefersReducedMotion(event.matches);
 };

 mediaQuery.addEventListener('change', handler);
 return () => mediaQuery.removeEventListener('change', handler);
 }, []);

 // Ring geometry parameters
 const ringRadius = size * 0.8;
 const tubeRadius = size * 0.1;

 // Create geometry
 const geometry = useMemo(() => {
 return new RingGeometry(ringRadius - tubeRadius, ringRadius + tubeRadius, 64);
 }, [ringRadius, tubeRadius]);

 // Create material with glow color
 const material = useMemo(() => {
 return new MeshBasicMaterial({
 color: new Color(color),
 transparent: true,
 opacity: intensity,
 side: DoubleSide,
 });
 }, [color, intensity]);

 // Pulsing animation
 useFrame((state) => {
 if (!animate || prefersReducedMotion || !ringRef.current) return;

 const time = state.clock.getElapsedTime();
 const pulse = Math.sin(time * pulseSpeed * Math.PI) * 0.3 + 0.7;

 const mat = ringRef.current.material as MeshBasicMaterial;
 mat.opacity = intensity * pulse;

 // Subtle scale animation
 const scale = 1 + Math.sin(time * pulseSpeed * Math.PI) * 0.05;
 ringRef.current.scale.setScalar(scale);
 });

 return (
 <mesh
 ref={ringRef}
 geometry={geometry}
 material={material}
 rotation={[-Math.PI / 2, 0, 0]}
 position={[0, 0.1, 0]}
 />
 );
};

/**
 * HoverGlow - Subtle glow effect for hovered nodes
 *
 * Similar to SelectionGlow but with reduced intensity for hover state.
 */
export interface HoverGlowProps {
 /** Base size to calculate ring radius */
 size: number;
 /** Color of the glow effect */
 color?: string;
}

export const HoverGlow: React.FC<HoverGlowProps> = ({
 size,
 color = '#FFFFFF',
}) => {
 const ringRadius = size * 0.7;
 const tubeRadius = size * 0.05;

 const geometry = useMemo(() => {
 return new RingGeometry(ringRadius - tubeRadius, ringRadius + tubeRadius, 32);
 }, [ringRadius, tubeRadius]);

 const material = useMemo(() => {
 return new MeshBasicMaterial({
 color: new Color(color),
 transparent: true,
 opacity: 0.3,
 side: DoubleSide,
 });
 }, [color]);

 return (
 <mesh
 geometry={geometry}
 material={material}
 rotation={[-Math.PI / 2, 0, 0]}
 position={[0, 0.05, 0]}
 />
 );
};

export default SelectionGlow;
