/**
 * Story 34.2 - VR Scene Component
 *
 * Wraps the Voxel scene with @react-three/xr XR component,
 * providing VR controller support, teleport locomotion, and
 * grab-and-inspect node interactions.
 */

import React, { useCallback, useState, useMemo, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, Controllers, Hands, VRButton } from '@react-three/xr';
import { Environment, Sky, Stars, Html, OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { VoxelNode } from '@/types/voxel';
import { VRControllers, VRInteractiveNode } from './VRControllers';

// ============================================================================
// Types
// ============================================================================

export interface VRSceneProps {
 /** Nodes to render in VR */
 nodes: VoxelNode[];
 /** Node renderer component */
 NodeComponent: React.ComponentType<{ node: VoxelNode; isSelected?: boolean; isHighlighted?: boolean }>;
 /** Callback when node is selected */
 onNodeSelect?: (node: VoxelNode | null) => void;
 /** Callback when entering VR */
 onEnterVR?: () => void;
 /** Callback when exiting VR */
 onExitVR?: () => void;
 /** Environment preset */
 environment?: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby';
 /** Show sky background */
 showSky?: boolean;
 /** Show stars (for night mode) */
 showStars?: boolean;
 /** Enable teleport locomotion */
 enableTeleport?: boolean;
 /** Enable hand tracking */
 enableHandTracking?: boolean;
 /** Floor height */
 floorHeight?: number;
 /** Scene scale */
 sceneScale?: number;
 /** Initial camera position */
 initialPosition?: [number, number, number];
 /** Children to render inside the scene */
 children?: React.ReactNode;
}

export interface VRSceneOverlayProps {
 /** Selected node for info display */
 selectedNode: VoxelNode | null;
 /** Callback to close overlay */
 onClose?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FLOOR_HEIGHT = 0;
const DEFAULT_SCENE_SCALE = 1;
const DEFAULT_INITIAL_POSITION: [number, number, number] = [0, 1.6, 5];

// ============================================================================
// VR Floor Component
// ============================================================================

interface VRFloorProps {
 height: number;
 size?: number;
 enableTeleport?: boolean;
 onTeleport?: (position: Vector3) => void;
}

const VRFloor: React.FC<VRFloorProps> = ({
 height,
 size = 100,
 enableTeleport = true,
 onTeleport,
}) => {
 const [hoverPosition, setHoverPosition] = useState<Vector3 | null>(null);

 const handlePointerMove = useCallback((event: { point: Vector3 }) => {
 if (enableTeleport) {
 setHoverPosition(event.point.clone());
 }
 }, [enableTeleport]);

 const handlePointerOut = useCallback(() => {
 setHoverPosition(null);
 }, []);

 const handleClick = useCallback((event: { point: Vector3 }) => {
 if (enableTeleport && onTeleport) {
 onTeleport(new Vector3(event.point.x, height + 1.6, event.point.z));
 }
 }, [enableTeleport, onTeleport, height]);

 return (
 <group>
 {/* Floor mesh */}
 <mesh
 rotation={[-Math.PI / 2, 0, 0]}
 position={[0, height, 0]}
 receiveShadow
 onPointerMove={handlePointerMove}
 onPointerOut={handlePointerOut}
 onClick={handleClick}
 >
 <planeGeometry args={[size, size, 32, 32]} />
 <meshStandardMaterial
 color="#1e293b"
 metalness={0.1}
 roughness={0.8}
 transparent
 opacity={0.9}
 />
 </mesh>

 {/* Grid lines */}
 <gridHelper
 args={[size, size / 2, '#334155', '#1e293b']}
 position={[0, height + 0.01, 0]}
 />

 {/* Teleport indicator */}
 {enableTeleport && hoverPosition && (
 <mesh position={[hoverPosition.x, height + 0.02, hoverPosition.z]} rotation={[-Math.PI / 2, 0, 0]}>
 <ringGeometry args={[0.3, 0.5, 32]} />
 <meshBasicMaterial color="#4ecdc4" transparent opacity={0.5} />
 </mesh>
 )}
 </group>
 );
};

// ============================================================================
// VR Node Info Panel (HTML overlay in VR)
// ============================================================================

const VRNodeInfoPanel: React.FC<{ node: VoxelNode; onClose?: () => void }> = ({ node, onClose }) => {
 const data = node.data as Record<string, unknown>;
 const name = (data?.name || data?.title || node.label || 'Unknown') as string;
 const description = (data?.description || '') as string;

 return (
 <Html
 center
 distanceFactor={10}
 position={[node.position.x, node.position.y + 2, node.position.z]}
 style={{ pointerEvents: 'auto' }}
 >
 <div className="bg-card/95 backdrop-blur-md border border-border rounded-3xl p-4 min-w-[250px] max-w-[350px] shadow-2xl">
 {/* Header */}
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <div
 className={`
 w-3 h-3 rounded-full
 ${node.status === 'critical' ? 'bg-red-500' : ''}
 ${node.status === 'warning' ? 'bg-amber-500' : ''}
 ${node.status === 'normal' ? 'bg-green-500' : ''}
 ${node.status === 'inactive' ? 'bg-muted/500' : ''}
 `}
 />
 <span className="text-xs text-muted-foreground uppercase">{node.type}</span>
 </div>
 {onClose && (
 <button
 onClick={onClose}
 className="text-muted-foreground hover:text-foreground transition-colors"
 >
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
 <path d="M18 6L6 18M6 6l12 12" />
 </svg>
 </button>
 )}
 </div>

 {/* Name */}
 <h3 className="text-white font-medium text-lg mb-1">{name}</h3>

 {/* Description */}
 {description && (
 <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{description}</p>
 )}

 {/* Status */}
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Status</span>
 <span
 className={`
 px-2 py-0.5 rounded-full text-xs font-medium
 ${node.status === 'critical' ? 'bg-red-500/20 text-red-400' : ''}
 ${node.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : ''}
 ${node.status === 'normal' ? 'bg-green-500/20 text-green-400' : ''}
 ${node.status === 'inactive' ? 'bg-muted/500/20 text-muted-foreground' : ''}
 `}
 >
 {node.status}
 </span>
 </div>

 {/* Connections */}
 <div className="flex items-center justify-between text-sm mt-2">
 <span className="text-muted-foreground">Connections</span>
 <span className="text-muted-foreground">{node.connections?.length || 0}</span>
 </div>
 </div>
 </Html>
 );
};

// ============================================================================
// Loading Fallback
// ============================================================================

const LoadingFallback: React.FC = () => (
 <Html center>
 <div className="flex items-center gap-3 bg-card/90 backdrop-blur-md border border-border/40 rounded-lg px-4 py-3">
 <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
 <span className="text-foreground text-sm">Loading VR Scene...</span>
 </div>
 </Html>
);

// ============================================================================
// Main VR Scene Component
// ============================================================================

export const VRScene: React.FC<VRSceneProps> = ({
 nodes,
 NodeComponent,
 onNodeSelect,
 onEnterVR,
 onExitVR,
 environment = 'night',
 showSky = false,
 showStars = true,
 enableTeleport = true,
 enableHandTracking = true,
 floorHeight = DEFAULT_FLOOR_HEIGHT,
 sceneScale = DEFAULT_SCENE_SCALE,
 initialPosition = DEFAULT_INITIAL_POSITION,
 children,
}) => {
 const [selectedNode, setSelectedNode] = useState<VoxelNode | null>(null);
 const [hoveredNode, setHoveredNode] = useState<VoxelNode | null>(null);
 const playerRef = useRef<{ position: Vector3 }>(null);

 // Create node map for quick lookups
 const nodeMap = useMemo(() => {
 const map = new Map<string, VoxelNode>();
 nodes.forEach((node) => map.set(node.id, node));
 return map;
 }, [nodes]);

 // Handle node selection
 const handleNodeSelect = useCallback(
 (node: VoxelNode | null) => {
 setSelectedNode(node);
 onNodeSelect?.(node);
 },
 [onNodeSelect]
 );

 // Handle node hover
 const handleNodeHover = useCallback((node: VoxelNode | null) => {
 setHoveredNode(node);
 }, []);

 // Handle teleport
 const handleTeleport = useCallback((position: Vector3) => {
 if (playerRef.current) {
 playerRef.current.position.copy(position);
 }
 }, []);

 // Handle session events
 const handleSessionStart = useCallback(() => {
 onEnterVR?.();
 }, [onEnterVR]);

 const handleSessionEnd = useCallback(() => {
 onExitVR?.();
 }, [onExitVR]);

 // Close info panel
 const handleCloseInfoPanel = useCallback(() => {
 setSelectedNode(null);
 onNodeSelect?.(null);
 }, [onNodeSelect]);

 return (
 <div className="relative w-full h-full">
 {/* VR Entry Button */}
 <VRButton
 className="absolute bottom-4 right-4 z-decorator px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-3xl shadow-lg transition-colors"
 enterOnly={false}
 exitOnly={false}
 />

 {/* Main Canvas */}
 <Canvas
 shadows
 camera={{ position: initialPosition, fov: 75 }}
 gl={{ antialias: true, alpha: false }}
 >
 <XR
 onSessionStart={handleSessionStart}
 onSessionEnd={handleSessionEnd}
 >
 <Suspense fallback={<LoadingFallback />}>
 {/* Lighting */}
 <ambientLight intensity={0.3} />
 <directionalLight
 position={[10, 20, 10]}
 intensity={0.5}
 castShadow
 shadow-mapSize={[2048, 2048]}
 />
 <pointLight position={[-10, 10, -10]} intensity={0.3} color="#4ecdc4" />

 {/* Environment */}
 {showSky && <Sky sunPosition={[100, 20, 100]} />}
 {showStars && <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />}
 <Environment preset={environment} background={!showSky && !showStars} />

 {/* Floor */}
 <VRFloor
 height={floorHeight}
 enableTeleport={enableTeleport}
 onTeleport={handleTeleport}
 />

 {/* Controllers */}
 <Controllers />
 {enableHandTracking && <Hands />}

 {/* Custom VR Controllers with interaction */}
 <VRControllers
 onNodeSelect={handleNodeSelect}
 onNodeHover={handleNodeHover}
 onTeleport={handleTeleport}
 enableTeleport={enableTeleport}
 enableHaptics={true}
 nodeMap={nodeMap}
 />

 {/* Nodes */}
 <group scale={sceneScale}>
 {nodes.map((node) => (
 <VRInteractiveNode
  key={node.id || 'unknown'}
  nodeId={node.id}
  node={node}
  onSelect={handleNodeSelect}
  onHover={handleNodeHover}
  enableGrab={true}
 >
  <group position={[node.position.x, node.position.y, node.position.z]}>
  <NodeComponent
  node={node}
  isSelected={selectedNode?.id === node.id}
  isHighlighted={hoveredNode?.id === node.id}
  />
  </group>
 </VRInteractiveNode>
 ))}
 </group>

 {/* Selected Node Info Panel */}
 {selectedNode && (
 <VRNodeInfoPanel
 node={selectedNode}
 onClose={handleCloseInfoPanel}
 />
 )}

 {/* Additional children */}
 {children}

 {/* Orbit controls for non-VR mode */}
 <OrbitControls
 enablePan={true}
 enableZoom={true}
 enableRotate={true}
 maxPolarAngle={Math.PI / 2}
 />
 </Suspense>
 </XR>
 </Canvas>
 </div>
 );
};

// ============================================================================
// VR Scene Wrapper (for easy integration)
// ============================================================================

export interface VRSceneWrapperProps extends Omit<VRSceneProps, 'NodeComponent'> {
 /** Custom node renderer, or uses default */
 renderNode?: React.ComponentType<{ node: VoxelNode; isSelected?: boolean; isHighlighted?: boolean }>;
}

const DefaultNodeRenderer: React.FC<{ node: VoxelNode; isSelected?: boolean; isHighlighted?: boolean }> = ({
 node,
 isSelected,
 isHighlighted,
}) => {
 const color = useMemo(() => {
 switch (node.type) {
 case 'asset': return '#3b82f6';
 case 'risk': return '#ef4444';
 case 'control': return '#22c55e';
 case 'incident': return '#f43f5e';
 case 'supplier': return '#8b5cf6';
 case 'project': return '#f59e0b';
 case 'audit': return '#06b6d4';
 default: return '#ffffff';
 }
 }, [node.type]);

 const statusColor = useMemo(() => {
 switch (node.status) {
 case 'critical': return '#ef4444';
 case 'warning': return '#f59e0b';
 case 'normal': return '#22c55e';
 case 'inactive': return '#6b7280';
 default: return '#ffffff';
 }
 }, [node.status]);

 return (
 <group scale={isSelected ? 1.3 : isHighlighted ? 1.15 : 1}>
 <mesh castShadow>
 <sphereGeometry args={[0.5, 32, 32]} />
 <meshPhysicalMaterial
 color={isSelected ? '#fde047' : color}
 emissive={isSelected ? '#fbbf24' : color}
 emissiveIntensity={isSelected ? 0.5 : 0.2}
 metalness={0.3}
 roughness={0.4}
 />
 </mesh>

 {/* Status ring */}
 <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
 <ringGeometry args={[0.6, 0.7, 32]} />
 <meshBasicMaterial color={statusColor} transparent opacity={0.7} />
 </mesh>
 </group>
 );
};

export const VRSceneWrapper: React.FC<VRSceneWrapperProps> = ({
 renderNode = DefaultNodeRenderer,
 ...props
}) => {
 return <VRScene {...props} NodeComponent={renderNode} />;
};

export default VRScene;
