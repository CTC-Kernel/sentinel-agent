/**
 * RiskPulse - Visual pulsing effect for critical risk nodes
 *
 * Renders a subtle pulsing glow around critical risk nodes to draw
 * attention without being distracting. Respects prefers-reduced-motion.
 *
 * @see Story VOX-9.2: Alertes Visuelles (Pulse)
 * @see FR46: Users can see critical risks pulse/glow
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, RingGeometry, MeshBasicMaterial, DoubleSide, Color } from 'three';
import { usePrefersReducedMotion } from '@/hooks/voxel';

// ============================================================================
// Types
// ============================================================================

export interface RiskPulseProps {
 /** Base size to calculate pulse radius */
 size: number;
 /** Pulse color (default: red for critical) */
 color?: string;
 /** Enable/disable the pulse animation */
 enabled?: boolean;
 /** Pulse cycle duration in seconds (default: 2s) */
 cycleDuration?: number;
 /** Scale range for pulse (min, max) */
 scaleRange?: [number, number];
 /** Opacity range for pulse (min, max) */
 opacityRange?: [number, number];
}

// ============================================================================
// Constants
// ============================================================================

/** Default pulse color (critical red) */
const DEFAULT_COLOR = '#EF4444';

/** Default cycle duration (2 seconds for subtle effect) */
const DEFAULT_CYCLE_DURATION = 2;

/** Default scale range (1.0 to 1.1 - subtle) */
const DEFAULT_SCALE_RANGE: [number, number] = [1.0, 1.1];

/** Default opacity range for fade effect */
const DEFAULT_OPACITY_RANGE: [number, number] = [0.2, 0.5];

// ============================================================================
// Component
// ============================================================================

/**
 * RiskPulse renders a pulsing ring around critical risk nodes.
 *
 * The pulse uses a sinusoidal animation for smooth scaling and
 * opacity changes. Animation is disabled when user prefers reduced motion.
 *
 * @example
 * ```tsx
 * <group position={nodePosition}>
 * <NodeMesh />
 * {isCritical && <RiskPulse size={nodeSize} />}
 * </group>
 * ```
 */
export const RiskPulse: React.FC<RiskPulseProps> = ({
 size,
 color = DEFAULT_COLOR,
 enabled = true,
 cycleDuration = DEFAULT_CYCLE_DURATION,
 scaleRange = DEFAULT_SCALE_RANGE,
 opacityRange = DEFAULT_OPACITY_RANGE,
}) => {
 const ringRef = useRef<Mesh>(null);
 const prefersReducedMotion = usePrefersReducedMotion();

 // Ring geometry parameters - outer ring for glow effect
 const innerRadius = size * 0.85;
 const outerRadius = size * 1.15;

 // Create geometry
 const geometry = useMemo(() => {
 return new RingGeometry(innerRadius, outerRadius, 48);
 }, [innerRadius, outerRadius]);

 // Create material with pulse color
 const material = useMemo(() => {
 return new MeshBasicMaterial({
 color: new Color(color),
 transparent: true,
 opacity: opacityRange[0],
 side: DoubleSide,
 });
 }, [color, opacityRange]);

 // Pulsing animation
 useFrame((state) => {
 if (!enabled || prefersReducedMotion || !ringRef.current) return;

 const time = state.clock.getElapsedTime();
 // Use sine wave for smooth oscillation (0 to 1 over cycleDuration)
 const phase = (Math.sin((time * Math.PI * 2) / cycleDuration) + 1) / 2;

 // Calculate current scale and opacity based on phase
 const [minScale, maxScale] = scaleRange;
 const [minOpacity, maxOpacity] = opacityRange;

 const currentScale = minScale + phase * (maxScale - minScale);
 const currentOpacity = minOpacity + phase * (maxOpacity - minOpacity);

 ringRef.current.scale.setScalar(currentScale);
 const mat = ringRef.current.material as MeshBasicMaterial;
 mat.opacity = currentOpacity;
 });

 // Don't render if disabled or reduced motion preferred
 if (!enabled) return null;

 // For reduced motion, show static ring at lower opacity
 const staticOpacity = prefersReducedMotion ? opacityRange[0] : opacityRange[1];

 return (
 <mesh
 ref={ringRef}
 geometry={geometry}
 material={material}
 rotation={[-Math.PI / 2, 0, 0]} // Face up
 position={[0, -0.05, 0]} // Slightly below node
 scale={prefersReducedMotion ? [scaleRange[0], scaleRange[0], scaleRange[0]] : undefined}
 >
 {prefersReducedMotion && (
 <meshBasicMaterial
 color={new Color(color)}
 transparent
 opacity={staticOpacity}
 side={DoubleSide}
 />
 )}
 </mesh>
 );
};

/**
 * CriticalRiskPulse - Preset for critical risk nodes
 *
 * Uses red color and standard 2-second cycle.
 */
export interface CriticalRiskPulseProps {
 size: number;
 enabled?: boolean;
}

export const CriticalRiskPulse: React.FC<CriticalRiskPulseProps> = ({
 size,
 enabled = true,
}) => (
 <RiskPulse
 size={size}
 color="#EF4444"
 enabled={enabled}
 cycleDuration={2}
 scaleRange={[1.0, 1.1]}
 opacityRange={[0.15, 0.4]}
 />
);

/**
 * WarningPulse - Preset for warning status nodes
 *
 * Uses amber color and slower 3-second cycle.
 */
export interface WarningPulseProps {
 size: number;
 enabled?: boolean;
}

export const WarningPulse: React.FC<WarningPulseProps> = ({ size, enabled = true }) => (
 <RiskPulse
 size={size}
 color="#F59E0B"
 enabled={enabled}
 cycleDuration={3}
 scaleRange={[1.0, 1.05]}
 opacityRange={[0.1, 0.25]}
 />
);

export default RiskPulse;
