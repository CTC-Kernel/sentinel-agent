/**
 * Story 34.4 - AR Scene Component
 *
 * AR session with camera passthrough for mobile devices.
 * Features:
 * - Place Voxel graph in real world
 * - Hit test for surface detection
 * - Pinch to scale, drag to move
 * - Tap node for details
 */

import React, { useState, useCallback, useMemo, Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { XR, ARButton, Interactive } from '@react-three/xr'; // Removed unused imports
import { Vector3, Quaternion, Group } from 'three'; // Removed Color
import { Html, Text, Billboard } from '@react-three/drei';
import type { VoxelNode, VoxelNodeType } from '@/types/voxel';
import { ARPlacement } from './ARPlacement';
// import { PlacementControls } from './ARPlacement';

// ============================================================================
// Types
// ============================================================================

export interface ARSceneProps {
  /** Nodes to render in AR */
  nodes: VoxelNode[];
  /** Callback when node is selected */
  onNodeSelect?: (node: VoxelNode | null) => void;
  /** Callback when AR session starts */
  onSessionStart?: () => void;
  /** Callback when AR session ends */
  onSessionEnd?: () => void;
  /** Initial scene scale */
  initialScale?: number;
  /** Minimum scale */
  minScale?: number;
  /** Maximum scale */
  maxScale?: number;
  /** Enable node interaction */
  enableNodeInteraction?: boolean;
  /** Show node labels */
  showNodeLabels?: boolean;
  /** Custom AR overlay element ID */
  overlayId?: string;
  /** Children */
  children?: React.ReactNode;
}

export interface ARNodeProps {
  /** Node data */
  node: VoxelNode;
  /** Whether node is selected */
  isSelected: boolean;
  /** Callback when tapped */
  onTap?: (node: VoxelNode) => void;
  /** Show label */
  showLabel: boolean;
  /** Scale factor */
  scaleFactor: number;
}

// ============================================================================
// Constants
// ============================================================================

const NODE_COLORS: Record<VoxelNodeType, string> = {
  asset: '#3b82f6',
  risk: '#ef4444',
  control: '#22c55e',
  incident: '#f43f5e',
  supplier: '#8b5cf6',
  project: '#f59e0b',
  audit: '#06b6d4',
};

const STATUS_COLORS: Record<string, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  normal: '#22c55e',
  inactive: '#6b7280',
};

// ============================================================================
// AR Node Component
// ============================================================================

const ARNode: React.FC<ARNodeProps> = ({
  node,
  isSelected,
  onTap,
  showLabel,
  scaleFactor,
}) => {
  const meshRef = useRef<Group>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Calculate colors
  const color = useMemo(() => {
    if (isSelected) return '#fde047';
    return NODE_COLORS[node.type] || '#ffffff';
  }, [node.type, isSelected]);

  const statusColor = STATUS_COLORS[node.status] || '#ffffff';

  // Get node label
  const label = useMemo(() => {
    const data = node.data as Record<string, unknown>;
    const name = (data?.name || data?.title || node.label || 'Node') as string;
    return name.length > 15 ? `${name.slice(0, 12)}...` : name;
  }, [node]);

  // Subtle animation for selected nodes
  useFrame((_, delta) => {
    if (meshRef.current && (isSelected || isHovered)) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  // Handle tap
  const handleSelect = useCallback(() => {
    onTap?.(node);
  }, [node, onTap]);

  // Node size based on scale
  const nodeSize = 0.05 * scaleFactor;
  const labelSize = 0.02 * scaleFactor;

  return (
    <Interactive onSelect={handleSelect}>
      <group
        ref={meshRef}
        position={[
          node.position.x * 0.1 * scaleFactor,
          node.position.y * 0.1 * scaleFactor,
          node.position.z * 0.1 * scaleFactor,
        ]}
        scale={isSelected ? 1.3 : isHovered ? 1.15 : 1}
        onPointerOver={() => setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
      >
        {/* Main node sphere */}
        <mesh castShadow>
          <sphereGeometry args={[nodeSize, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isSelected ? 0.5 : 0.2}
            metalness={0.3}
            roughness={0.6}
          />
        </mesh>

        {/* Status ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -nodeSize * 1.2, 0]}>
          <ringGeometry args={[nodeSize * 1.1, nodeSize * 1.3, 24]} />
          <meshBasicMaterial
            color={statusColor}
            transparent
            opacity={0.7}
            side={2}
          />
        </mesh>

        {/* Label */}
        {showLabel && (isSelected || isHovered) && (
          <Billboard position={[0, nodeSize * 2.5, 0]}>
            <Text
              fontSize={labelSize}
              color="white"
              anchorX="center"
              anchorY="middle"
              outlineWidth={labelSize * 0.1}
              outlineColor="black"
            >
              {label}
            </Text>
          </Billboard>
        )}

        {/* Selection glow */}
        {isSelected && (
          <mesh>
            <sphereGeometry args={[nodeSize * 1.8, 16, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.15}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
    </Interactive>
  );
};

// ============================================================================
// AR Node Info Panel
// ============================================================================

interface ARNodeInfoPanelProps {
  node: VoxelNode;
  position: Vector3;
  onClose: () => void;
  scaleFactor: number;
}

const ARNodeInfoPanel: React.FC<ARNodeInfoPanelProps> = ({
  node,
  position,
  onClose,
  scaleFactor,
}) => {
  const data = node.data as Record<string, unknown>;
  const name = (data?.name || data?.title || node.label || 'Unknown') as string;
  const description = (data?.description || '') as string;

  return (
    <Html
      position={[
        position.x + 0.15 * scaleFactor,
        position.y + 0.1 * scaleFactor,
        position.z,
      ]}
      center
      distanceFactor={2}
      style={{ pointerEvents: 'auto' }}
    >
      <div className="bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-xl p-3 min-w-[200px] max-w-[280px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[node.status] }}
            />
            <span className="text-xs text-gray-400 uppercase font-medium">{node.type}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Name */}
        <h3 className="text-white font-semibold text-base mb-1 line-clamp-1">{name}</h3>

        {/* Description */}
        {description && (
          <p className="text-gray-400 text-xs mb-2 line-clamp-2">{description}</p>
        )}

        {/* Details */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span
              className="font-medium"
              style={{ color: STATUS_COLORS[node.status] }}
            >
              {node.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Connections</span>
            <span className="text-gray-300">{node.connections?.length || 0}</span>
          </div>
        </div>
      </div>
    </Html>
  );
};

// ============================================================================
// AR Edges Component (simplified for performance)
// ============================================================================

interface AREdgesProps {
  nodes: VoxelNode[];
  scaleFactor: number;
}

const AREdges: React.FC<AREdgesProps> = ({ nodes, scaleFactor }) => {
  // Create edge lines from node connections
  const linePoints = useMemo(() => {
    const points: number[] = [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    nodes.forEach((node) => {
      node.connections?.forEach((targetId) => {
        const target = nodeMap.get(targetId);
        if (target) {
          // Source position
          points.push(
            node.position.x * 0.1 * scaleFactor,
            node.position.y * 0.1 * scaleFactor,
            node.position.z * 0.1 * scaleFactor
          );
          // Target position
          points.push(
            target.position.x * 0.1 * scaleFactor,
            target.position.y * 0.1 * scaleFactor,
            target.position.z * 0.1 * scaleFactor
          );
        }
      });
    });

    return new Float32Array(points);
  }, [nodes, scaleFactor]);

  if (linePoints.length === 0) return null;

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={linePoints.length / 3}
          array={linePoints}
          itemSize={3}
          args={[linePoints, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#475569" transparent opacity={0.4} linewidth={1} />
    </lineSegments>
  );
};

// ============================================================================
// AR Scene Content
// ============================================================================

interface ARSceneContentProps {
  nodes: VoxelNode[];
  onNodeSelect?: (node: VoxelNode | null) => void;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
  initialScale: number;
  minScale: number;
  maxScale: number;
  enableNodeInteraction: boolean;
  showNodeLabels: boolean;
  children?: React.ReactNode;
}

const ARSceneContent: React.FC<ARSceneContentProps> = ({
  nodes,
  onNodeSelect,
  onSessionStart,
  onSessionEnd,
  initialScale,
  minScale,
  maxScale,
  enableNodeInteraction,
  showNodeLabels,
  children,
}) => {
  const [selectedNode, setSelectedNode] = useState<VoxelNode | null>(null);
  const [placedScale, setPlacedScale] = useState(initialScale);
  // const [isPlaced, setIsPlaced] = useState(false);
  // const [placementPosition, setPlacementPosition] = useState(new Vector3());

  // Handle node tap
  const handleNodeTap = useCallback(
    (node: VoxelNode) => {
      if (!enableNodeInteraction) return;

      if (selectedNode?.id === node.id) {
        setSelectedNode(null);
        onNodeSelect?.(null);
      } else {
        setSelectedNode(node);
        onNodeSelect?.(node);
      }
    },
    [enableNodeInteraction, selectedNode, onNodeSelect]
  );

  // Handle placement
  const handlePlace = useCallback((_position: Vector3, _rotation: Quaternion, scale: number) => {
    setPlacedScale(scale);
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Close info panel
  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Session handlers
  const handleSessionStart = useCallback(() => {
    onSessionStart?.();
  }, [onSessionStart]);

  const handleSessionEnd = useCallback(() => {
    setSelectedNode(null);
    onSessionEnd?.();
  }, [onSessionEnd]);

  return (
    <XR onSessionStart={handleSessionStart} onSessionEnd={handleSessionEnd}>
      {/* Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={0.5} />

      {/* AR Placement wrapper */}
      <ARPlacement
        onPlace={handlePlace}
        onReset={handleReset}
        initialScale={initialScale}
        minScale={minScale}
        maxScale={maxScale}
        showScaleIndicator={true}
        enableHaptics={true}
      >
        {/* Voxel graph content */}
        <group>
          {/* Edges */}
          <AREdges nodes={nodes} scaleFactor={placedScale} />

          {/* Nodes */}
          {nodes.map((node) => (
            <ARNode
              key={node.id}
              node={node}
              isSelected={selectedNode?.id === node.id}
              onTap={handleNodeTap}
              showLabel={showNodeLabels}
              scaleFactor={placedScale}
            />
          ))}

          {/* Selected node info panel */}
          {selectedNode && (
            <ARNodeInfoPanel
              node={selectedNode}
              position={
                new Vector3(
                  selectedNode.position.x * 0.1 * placedScale,
                  selectedNode.position.y * 0.1 * placedScale,
                  selectedNode.position.z * 0.1 * placedScale
                )
              }
              onClose={handleClosePanel}
              scaleFactor={placedScale}
            />
          )}
        </group>
      </ARPlacement>

      {/* Additional children */}
      {children}
    </XR>
  );
};

// ============================================================================
// Loading Fallback
// ============================================================================

const ARLoadingFallback: React.FC = () => (
  <Html center>
    <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-md rounded-lg px-4 py-3">
      <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-white text-sm">Initializing AR...</span>
    </div>
  </Html>
);

// ============================================================================
// AR Instructions Overlay
// ============================================================================

const ARInstructions: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 pointer-events-none">
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/20 rounded-xl p-4 max-w-md mx-auto">
        <h3 className="text-white font-semibold text-sm mb-2">AR Mode Instructions</h3>
        <ul className="text-gray-300 text-xs space-y-1.5">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-xs">1</span>
            Point camera at a flat surface
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-xs">2</span>
            Tap "Place Here" when reticle turns green
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-xs">3</span>
            Pinch to scale, drag to reposition
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-xs">4</span>
            Tap nodes to view details
          </li>
        </ul>
      </div>
    </div>
  );
};

// ============================================================================
// Main AR Scene Component
// ============================================================================

export const ARScene: React.FC<ARSceneProps> = ({
  nodes,
  onNodeSelect,
  onSessionStart,
  onSessionEnd,
  initialScale = 0.5,
  minScale = 0.1,
  maxScale = 2,
  enableNodeInteraction = true,
  showNodeLabels = true,
  overlayId = 'ar-overlay',
  children,
}) => {
  const [showInstructions, setShowInstructions] = useState(true);

  // Hide instructions after delay
  useEffect(() => {
    const timer = setTimeout(() => setShowInstructions(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* AR Entry Button */}
      <ARButton
        className="absolute bottom-4 right-4 z-10 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl shadow-lg transition-colors"
        sessionInit={{
          requiredFeatures: ['hit-test'],
          optionalFeatures: ['dom-overlay', 'anchors', 'plane-detection'],
          domOverlay: { root: document.getElementById(overlayId) || document.body },
        }}
      />

      {/* AR DOM Overlay root */}
      <div id={overlayId} className="fixed inset-0 pointer-events-none z-40" />

      {/* Instructions overlay */}
      <ARInstructions visible={showInstructions} />

      {/* Info text when not in AR */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-purple-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
            <circle cx="12" cy="10" r="3" strokeDasharray="2,2" />
          </svg>
          <span className="text-white text-sm font-medium">AR Preview</span>
        </div>
        <p className="text-gray-400 text-xs mt-1">
          Tap the button below to place in your environment
        </p>
      </div>

      {/* Canvas */}
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
        }}
        camera={{ position: [0, 1.6, 3], fov: 75 }}
      >
        <Suspense fallback={<ARLoadingFallback />}>
          <ARSceneContent
            nodes={nodes}
            onNodeSelect={onNodeSelect}
            onSessionStart={onSessionStart}
            onSessionEnd={onSessionEnd}
            initialScale={initialScale}
            minScale={minScale}
            maxScale={maxScale}
            enableNodeInteraction={enableNodeInteraction}
            showNodeLabels={showNodeLabels}
          >
            {children}
          </ARSceneContent>
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ARScene;
