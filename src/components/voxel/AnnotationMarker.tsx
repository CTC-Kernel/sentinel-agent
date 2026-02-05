/**
 * Epic 33: Story 33.3 - Annotation Marker (3D)
 *
 * 3D marker component for annotations in the Voxel scene.
 * Features:
 * - Pin/flag icon at annotation position
 * - Color based on annotation type
 * - Hover tooltip preview
 * - Click to open full annotation
 * - Pulse animation for unread annotations
 * - Connection line to nearest node
 */

import React, { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html, Text, Line, Billboard } from '@react-three/drei';
import { animated, useSpring, config } from '@react-spring/three';
import { Group, Vector3, AdditiveBlending, Mesh, MeshBasicMaterial } from 'three';
import type { VoxelAnnotation, Position3D } from '../../types/voxelAnnotation';
import {
 ANNOTATION_TYPE_COLORS,
 ANNOTATION_TYPE_LABELS,
 ANNOTATION_STATUS_COLORS,
} from '../../types/voxelAnnotation';

// ============================================================================
// Types
// ============================================================================

interface AnnotationMarkerProps {
 /** The annotation to display */
 annotation: VoxelAnnotation;

 /** Whether this annotation is selected */
 isSelected?: boolean;

 /** Whether this annotation is unread by current user */
 isUnread?: boolean;

 /** Nearest node position (for connection line) */
 nearestNodePosition?: Position3D;

 /** Current user ID (for unread detection) */
 currentUserId?: string;

 /** Callback when marker is clicked */
 onClick?: (annotation: VoxelAnnotation) => void;

 /** Callback when marker is hovered */
 onHover?: (annotation: VoxelAnnotation | null) => void;

 /** Scale factor for the marker */
 scale?: number;
}

// ============================================================================
// Constants
// ============================================================================

const MARKER_SIZE = 0.5;
const PIN_HEIGHT = 1.2;
const PULSE_SPEED = 2;
const HOVER_SCALE = 1.3;
const SELECTED_SCALE = 1.5;

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Pin head geometry with type-based color
 */
const PinHead: React.FC<{
 color: string;
 isSelected: boolean;
 isHovered: boolean;
 opacity?: number;
}> = React.memo(({ color, isSelected, isHovered, opacity = 1 }) => {
 const emissiveIntensity = isSelected ? 1.5 : isHovered ? 1.2 : 0.8;

 return (
 <group position={[0, PIN_HEIGHT, 0]}>
 {/* Main sphere */}
 <mesh>
 <sphereGeometry args={[MARKER_SIZE, 24, 24]} />
 <meshPhysicalMaterial
 color={color}
 emissive={color}
 emissiveIntensity={emissiveIntensity}
 metalness={0.3}
 roughness={0.2}
 transmission={0.4}
 thickness={1}
 transparent
 opacity={opacity}
 />
 </mesh>

 {/* Inner glow */}
 <mesh scale={0.6}>
 <sphereGeometry args={[MARKER_SIZE, 16, 16]} />
 <meshBasicMaterial
 color="white"
 transparent
 opacity={0.5}
 />
 </mesh>
 </group>
 );
});

PinHead.displayName = 'PinHead';

/**
 * Pin stem geometry
 */
const PinStem: React.FC<{ color: string }> = React.memo(({ color }) => {
 return (
 <mesh position={[0, PIN_HEIGHT / 2, 0]}>
 <cylinderGeometry args={[0.08, 0.12, PIN_HEIGHT, 8]} />
 <meshPhysicalMaterial
 color={color}
 metalness={0.5}
 roughness={0.3}
 transparent
 opacity={0.9}
 />
 </mesh>
 );
});

PinStem.displayName = 'PinStem';

/**
 * Pulsing ring for unread annotations
 */
const UnreadPulse: React.FC<{
 color: string;
 visible: boolean;
}> = React.memo(({ color, visible }) => {
 const meshRef = useRef<Mesh>(null);
 const materialRef = useRef<MeshBasicMaterial>(null);

 useFrame(({ clock }) => {
 if (!visible || !meshRef.current || !materialRef.current) return;

 const t = clock.getElapsedTime() * PULSE_SPEED;
 const pulseScale = 1 + Math.sin(t) * 0.3;
 const pulseOpacity = 0.6 - Math.sin(t) * 0.3;

 meshRef.current.scale.setScalar(pulseScale);
 materialRef.current.opacity = Math.max(0, pulseOpacity);
 });

 if (!visible) return null;

 return (
 <mesh
 ref={meshRef}
 rotation={[-Math.PI / 2, 0, 0]}
 position={[0, 0.05, 0]}
 >
 <ringGeometry args={[MARKER_SIZE * 1.5, MARKER_SIZE * 2, 32]} />
 <meshBasicMaterial
 ref={materialRef}
 color={color}
 transparent
 opacity={0.6}
 blending={AdditiveBlending}
 />
 </mesh>
 );
});

UnreadPulse.displayName = 'UnreadPulse';

/**
 * Reply count badge
 */
const ReplyBadge: React.FC<{
 count: number;
 position: [number, number, number];
}> = React.memo(({ count, position }) => {
 if (count === 0) return null;

 const displayCount = count > 9 ? '9+' : String(count);

 return (
 <Billboard position={position}>
 <mesh>
 <circleGeometry args={[0.25, 16]} />
 <meshBasicMaterial color="#ef4444" />
 </mesh>
 <Text
 position={[0, 0, 0.01]}
 fontSize={0.2}
 color="white"
 anchorX="center"
 anchorY="middle"
 font="https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff"
 >
 {displayCount}
 </Text>
 </Billboard>
 );
});

ReplyBadge.displayName = 'ReplyBadge';

/**
 * Hover tooltip with annotation preview
 */
const AnnotationTooltip: React.FC<{
 annotation: VoxelAnnotation;
 visible: boolean;
}> = React.memo(({ annotation, visible }) => {
 if (!visible) return null;

 const typeLabel = ANNOTATION_TYPE_LABELS[annotation.type];
 const contentPreview = annotation.content.length > 80
 ? annotation.content.substring(0, 77) + '...'
 : annotation.content;

 return (
 <Html
 position={[0, PIN_HEIGHT + MARKER_SIZE + 0.5, 0]}
 center
 distanceFactor={15}
 style={{ pointerEvents: 'none' }}
 >
 <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl px-4 py-3 shadow-xl border border-slate-700/50 max-w-[240px]">
 <div className="flex items-center gap-2 mb-2">
 <span
 className="w-2.5 h-2.5 rounded-full"
 style={{ backgroundColor: annotation.color }}
 />
 <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
 {typeLabel}
 </span>
 </div>
 <p className="text-sm text-white leading-relaxed">
 {contentPreview}
 </p>
 <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
 <span>{annotation.author.displayName}</span>
 {annotation.replyCount > 0 && (
 <span>{annotation.replyCount} réponse(s)</span>
 )}
 </div>
 </div>
 </Html>
 );
});

AnnotationTooltip.displayName = 'AnnotationTooltip';

/**
 * Connection line to nearest node
 */
const ConnectionLine: React.FC<{
 start: Position3D;
 end: Position3D;
 color: string;
 visible: boolean;
}> = React.memo(({ start, end, color, visible }) => {
 const points = useMemo(() => [
 new Vector3(start.x, start.y, start.z),
 new Vector3(end.x, end.y, end.z),
 ], [start, end]);

 if (!visible) return null;

 return (
 <Line
 points={points}
 color={color}
 lineWidth={2}
 dashed
 dashSize={0.2}
 dashScale={1}
 gapSize={0.1}
 />
 );
});

ConnectionLine.displayName = 'ConnectionLine';

// ============================================================================
// Static Components
// ============================================================================

const AnimatedGroup = animated('group');

// ============================================================================
// Main Component
// ============================================================================

export const AnnotationMarker: React.FC<AnnotationMarkerProps> = React.memo(({
 annotation,
 isSelected = false,
 isUnread = false,
 nearestNodePosition,
 currentUserId,
 onClick,
 onHover,
 scale = 1,
}) => {
 const groupRef = useRef<Group>(null);
 const [isHovered, setIsHovered] = useState(false);

 // Determine if annotation is unread for current user
 const unread = useMemo(() => {
 if (isUnread) return true;
 if (!currentUserId) return false;
 return !annotation.readBy.includes(currentUserId);
 }, [isUnread, currentUserId, annotation.readBy]);

 // Get color based on annotation type
 const markerColor = annotation.color || ANNOTATION_TYPE_COLORS[annotation.type];

 // Calculate target scale based on state
 const targetScale = isSelected ? SELECTED_SCALE : isHovered ? HOVER_SCALE : 1;

 // Spring animation for smooth transitions
 const { animatedScale } = useSpring({
 animatedScale: targetScale * scale,
 config: config.wobbly,
 });

 // Handle click
 const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
 e.stopPropagation();
 onClick?.(annotation);
 }, [onClick, annotation]);

 // Handle pointer enter
 const handlePointerEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
 e.stopPropagation();
 setIsHovered(true);
 onHover?.(annotation);
 if (typeof document !== 'undefined') {
 document.body.style.cursor = 'pointer';
 }
 }, [onHover, annotation]);

 // Handle pointer leave
 const handlePointerLeave = useCallback(() => {
 setIsHovered(false);
 onHover?.(null);
 if (typeof document !== 'undefined') {
 document.body.style.cursor = 'auto';
 }
 }, [onHover]);

 // Gentle rotation animation for selected markers
 useFrame(({ clock }) => {
 if (groupRef.current && isSelected) {
 groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.1;
 }
 });

 return (
 <group position={[annotation.position.x, annotation.position.y, annotation.position.z]}>
 {/* Connection line to node */}
 {nearestNodePosition && (
 <ConnectionLine
 start={{ x: 0, y: 0, z: 0 }}
 end={{
 x: nearestNodePosition.x - annotation.position.x,
 y: nearestNodePosition.y - annotation.position.y,
 z: nearestNodePosition.z - annotation.position.z,
 }}
 color={markerColor}
 visible={isSelected || isHovered}
 />
 )}

 {/* Main marker group */}
 <AnimatedGroup
 ref={groupRef}
 scale={animatedScale}
 onClick={handleClick}
 onPointerEnter={handlePointerEnter}
 onPointerLeave={handlePointerLeave}
 >
 {/* Unread pulse effect */}
 <UnreadPulse color={markerColor} visible={unread} />

 {/* Pin stem */}
 <PinStem color={markerColor} />

 {/* Pin head */}
 <PinHead
 color={markerColor}
 isSelected={isSelected}
 isHovered={isHovered}
 />

 {/* Reply count badge */}
 <ReplyBadge
 count={annotation.replyCount}
 position={[MARKER_SIZE * 0.7, PIN_HEIGHT + MARKER_SIZE * 0.7, 0]}
 />

 {/* Selection ring */}
 {isSelected && (
 <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
 <ringGeometry args={[MARKER_SIZE * 1.8, MARKER_SIZE * 2.2, 32]} />
 <meshBasicMaterial
 color={markerColor}
 transparent
 opacity={0.8}
 blending={AdditiveBlending}
 />
 </mesh>
 )}

 {/* Issue status indicator */}
 {annotation.type === 'issue' && annotation.status !== 'open' && (
 <Billboard position={[-MARKER_SIZE * 0.7, PIN_HEIGHT + MARKER_SIZE * 0.7, 0]}>
 <mesh>
 <circleGeometry args={[0.2, 16]} />
 <meshBasicMaterial color={ANNOTATION_STATUS_COLORS[annotation.status]} />
 </mesh>
 </Billboard>
 )}
 </AnimatedGroup>

 {/* Tooltip on hover */}
 <AnnotationTooltip annotation={annotation} visible={isHovered} />

 {/* Type label when selected */}
 {isSelected && (
 <Billboard position={[0, -0.5, 0]}>
 <Text
 fontSize={0.3}
 color="white"
 anchorX="center"
 anchorY="middle"
 outlineWidth={0.02}
 outlineColor="black"
 font="https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff"
 >
 {ANNOTATION_TYPE_LABELS[annotation.type]}
 </Text>
 </Billboard>
 )}
 </group>
 );
});

AnnotationMarker.displayName = 'AnnotationMarker';

export default AnnotationMarker;
