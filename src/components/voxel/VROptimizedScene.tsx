/**
 * Story 34.3 - VR Optimized Scene Component
 *
 * Provides a VR-optimized rendering pipeline with:
 * - Reduced polygon count for VR performance
 * - Simplified materials (no complex shaders)
 * - Reduced draw calls through instancing
 * - Fixed foveated rendering hints
 * - Target 72+ FPS for VR comfort
 */

import React, { useMemo, useCallback, useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, Controllers, Hands, VRButton } from '@react-three/xr';
import { InstancedMesh, Object3D, Color, Matrix4, Vector3, MeshBasicMaterial, SphereGeometry } from 'three';
import { Html, Environment, Stats } from '@react-three/drei';
import type { VoxelNode, VoxelNodeType } from '@/types/voxel';
import { useVRPerformance, getVRPerformanceColor, VRQualityLevel, VRQualitySettings } from '@/hooks/voxel/useVRPerformance';

// ============================================================================
// Types
// ============================================================================

export interface VROptimizedSceneProps {
  /** Nodes to render */
  nodes: VoxelNode[];
  /** Edges to render */
  edges?: Array<{ source: string; target: string }>;
  /** Callback when node is selected */
  onNodeSelect?: (node: VoxelNode | null) => void;
  /** Callback when entering VR */
  onEnterVR?: () => void;
  /** Callback when exiting VR */
  onExitVR?: () => void;
  /** Initial quality level */
  initialQuality?: VRQualityLevel;
  /** Enable auto quality adjustment */
  autoQuality?: boolean;
  /** Show performance stats overlay */
  showStats?: boolean;
  /** Target FPS */
  targetFPS?: number;
  /** Enable debug mode */
  debug?: boolean;
  /** Children */
  children?: React.ReactNode;
}

export interface OptimizedNodeProps {
  nodes: VoxelNode[];
  qualitySettings: VRQualitySettings;
  selectedNodeId: string | null;
  onSelect?: (node: VoxelNode) => void;
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

const STATUS_EMISSIVE: Record<string, number> = {
  critical: 0.5,
  warning: 0.3,
  normal: 0.1,
  inactive: 0,
};

// Geometry detail levels based on quality
const GEOMETRY_SEGMENTS: Record<VRQualityLevel, number> = {
  low: 8,
  medium: 12,
  high: 16,
  ultra: 24,
};

// ============================================================================
// Optimized Instanced Nodes Component
// ============================================================================

const OptimizedInstancedNodes: React.FC<OptimizedNodeProps> = ({
  nodes,
  qualitySettings,
  selectedNodeId,
  onSelect,
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);
  const tempMatrix = useMemo(() => new Matrix4(), []);

  // Group nodes by type for better batching
  const nodesByType = useMemo(() => {
    const grouped = new Map<VoxelNodeType, VoxelNode[]>();
    nodes.forEach((node) => {
      const group = grouped.get(node.type) || [];
      group.push(node);
      grouped.set(node.type, group);
    });
    return grouped;
  }, [nodes]);

  // Geometry based on quality
  const segments = GEOMETRY_SEGMENTS[qualitySettings.level];

  // Create position map for lookups
  const nodeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    nodes.forEach((node, index) => {
      map.set(node.id, index);
    });
    return map;
  }, [nodes]);

  // Update instance matrices
  useEffect(() => {
    if (!meshRef.current) return;

    nodes.forEach((node, index) => {
      tempObject.position.set(node.position.x, node.position.y, node.position.z);
      tempObject.scale.setScalar(node.id === selectedNodeId ? 1.3 : 1);
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(index, tempObject.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [nodes, selectedNodeId, tempObject]);

  // Update colors
  useEffect(() => {
    if (!meshRef.current) return;

    const colorArray = new Float32Array(nodes.length * 3);
    nodes.forEach((node, index) => {
      const color = new Color(node.id === selectedNodeId ? '#fde047' : NODE_COLORS[node.type]);
      colorArray[index * 3] = color.r;
      colorArray[index * 3 + 1] = color.g;
      colorArray[index * 3 + 2] = color.b;
    });

    meshRef.current.geometry.setAttribute(
      'color',
      new (require('three').InstancedBufferAttribute)(colorArray, 3)
    );
  }, [nodes, selectedNodeId]);

  // Handle click
  const handleClick = useCallback(
    (event: { instanceId?: number }) => {
      if (event.instanceId !== undefined && event.instanceId < nodes.length) {
        onSelect?.(nodes[event.instanceId]);
      }
    },
    [nodes, onSelect]
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      onClick={handleClick}
      frustumCulled={true}
    >
      <sphereGeometry args={[0.5, segments, segments]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
};

// ============================================================================
// Simplified Edges Component (for VR performance)
// ============================================================================

interface OptimizedEdgesProps {
  edges: Array<{ source: string; target: string }>;
  nodePositions: Map<string, Vector3>;
  qualitySettings: VRQualitySettings;
}

const OptimizedEdges: React.FC<OptimizedEdgesProps> = ({
  edges,
  nodePositions,
  qualitySettings,
}) => {
  // Only render edges at medium quality or above
  if (qualitySettings.level === 'low') return null;

  // Limit edges based on quality
  const maxEdges = qualitySettings.level === 'ultra' ? edges.length :
                   qualitySettings.level === 'high' ? Math.min(edges.length, 500) :
                   Math.min(edges.length, 200);

  const visibleEdges = edges.slice(0, maxEdges);

  const lineSegments = useMemo(() => {
    const points: number[] = [];

    visibleEdges.forEach(({ source, target }) => {
      const sourcePos = nodePositions.get(source);
      const targetPos = nodePositions.get(target);

      if (sourcePos && targetPos) {
        points.push(sourcePos.x, sourcePos.y, sourcePos.z);
        points.push(targetPos.x, targetPos.y, targetPos.z);
      }
    });

    return new Float32Array(points);
  }, [visibleEdges, nodePositions]);

  if (lineSegments.length === 0) return null;

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={lineSegments.length / 3}
          array={lineSegments}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color="#475569"
        transparent
        opacity={0.3}
        linewidth={1}
      />
    </lineSegments>
  );
};

// ============================================================================
// VR Performance HUD
// ============================================================================

interface VRPerformanceHUDProps {
  visible: boolean;
  targetFPS: number;
}

const VRPerformanceHUD: React.FC<VRPerformanceHUDProps> = ({ visible, targetFPS }) => {
  const { stats, status, qualityLevel, recommendation, isVRReady } = useVRPerformance({
    targetFPS,
    autoAdjustQuality: true,
    logging: false,
  });

  if (!visible) return null;

  const statusColor = getVRPerformanceColor(status);

  return (
    <Html
      position={[0, 2, -3]}
      center
      distanceFactor={10}
      style={{ pointerEvents: 'none' }}
    >
      <div className="bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-lg p-3 min-w-[200px] text-white font-mono text-xs">
        {/* FPS Display */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">FPS</span>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <span className="text-lg font-bold" style={{ color: statusColor }}>
              {stats.averageFPS.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Frame Time */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Frame</span>
          <span className="text-gray-200">{stats.averageFrameTimeMs.toFixed(2)}ms</span>
        </div>

        {/* Quality Level */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Quality</span>
          <span
            className={`
              px-2 py-0.5 rounded text-xs uppercase
              ${qualityLevel === 'ultra' ? 'bg-purple-500/20 text-purple-400' : ''}
              ${qualityLevel === 'high' ? 'bg-blue-500/20 text-blue-400' : ''}
              ${qualityLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' : ''}
              ${qualityLevel === 'low' ? 'bg-red-500/20 text-red-400' : ''}
            `}
          >
            {qualityLevel}
          </span>
        </div>

        {/* Dropped Frames */}
        {stats.droppedFrames > 0 && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Dropped</span>
            <span className="text-red-400">{stats.droppedFrames}</span>
          </div>
        )}

        {/* VR Ready Status */}
        <div
          className={`
            mt-2 pt-2 border-t border-white/10 text-center text-xs
            ${isVRReady ? 'text-green-400' : 'text-red-400'}
          `}
        >
          {isVRReady ? 'VR Ready' : 'Performance Warning'}
        </div>
      </div>
    </Html>
  );
};

// ============================================================================
// VR Quality Control Panel
// ============================================================================

interface VRQualityControlProps {
  qualityLevel: VRQualityLevel;
  onQualityChange: (level: VRQualityLevel) => void;
}

const VRQualityControl: React.FC<VRQualityControlProps> = ({
  qualityLevel,
  onQualityChange,
}) => {
  const levels: VRQualityLevel[] = ['low', 'medium', 'high', 'ultra'];

  return (
    <Html position={[-2, 1, -2]} center distanceFactor={8}>
      <div className="bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-lg p-3">
        <div className="text-white text-xs font-medium mb-2">Quality</div>
        <div className="flex flex-col gap-1">
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => onQualityChange(level)}
              className={`
                px-3 py-1.5 rounded text-xs font-medium transition-colors
                ${level === qualityLevel
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }
              `}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </Html>
  );
};

// ============================================================================
// Simplified Floor (VR Optimized)
// ============================================================================

const VROptimizedFloor: React.FC<{ size?: number }> = ({ size = 50 }) => {
  return (
    <group>
      {/* Simple floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#1e293b" transparent opacity={0.95} />
      </mesh>

      {/* Simplified grid */}
      <gridHelper
        args={[size, 20, '#334155', '#1e293b']}
        position={[0, 0.01, 0]}
      />
    </group>
  );
};

// ============================================================================
// Scene Content Component (Inside Canvas)
// ============================================================================

interface VRSceneContentProps extends Omit<VROptimizedSceneProps, 'children'> {
  qualityLevel: VRQualityLevel;
  qualitySettings: VRQualitySettings;
  onQualityChange: (level: VRQualityLevel) => void;
  children?: React.ReactNode;
}

const VRSceneContent: React.FC<VRSceneContentProps> = ({
  nodes,
  edges = [],
  onNodeSelect,
  onEnterVR,
  onExitVR,
  qualityLevel,
  qualitySettings,
  onQualityChange,
  showStats = false,
  targetFPS = 72,
  debug = false,
  children,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { gl } = useThree();

  // Create node position map
  const nodePositions = useMemo(() => {
    const map = new Map<string, Vector3>();
    nodes.forEach((node) => {
      map.set(node.id, new Vector3(node.position.x, node.position.y, node.position.z));
    });
    return map;
  }, [nodes]);

  // Handle node selection
  const handleNodeSelect = useCallback(
    (node: VoxelNode) => {
      setSelectedNodeId(node.id);
      onNodeSelect?.(node);
    },
    [onNodeSelect]
  );

  // Session handlers
  const handleSessionStart = useCallback(() => {
    // Apply VR-specific renderer settings
    gl.xr.setFoveation(1); // Maximum foveation for performance
    onEnterVR?.();
  }, [gl, onEnterVR]);

  const handleSessionEnd = useCallback(() => {
    onExitVR?.();
  }, [onExitVR]);

  return (
    <XR onSessionStart={handleSessionStart} onSessionEnd={handleSessionEnd}>
      {/* Simplified lighting for VR */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 5]}
        intensity={qualitySettings.enableDynamicLights ? 0.4 : 0}
      />

      {/* Simple environment */}
      <color attach="background" args={['#0f172a']} />
      {qualitySettings.level !== 'low' && (
        <fog attach="fog" args={['#0f172a', 30, 100]} />
      )}

      {/* Floor */}
      <VROptimizedFloor />

      {/* Controllers */}
      <Controllers />
      {qualitySettings.level !== 'low' && <Hands />}

      {/* Optimized Nodes */}
      <OptimizedInstancedNodes
        nodes={nodes}
        qualitySettings={qualitySettings}
        selectedNodeId={selectedNodeId}
        onSelect={handleNodeSelect}
      />

      {/* Edges */}
      <OptimizedEdges
        edges={edges}
        nodePositions={nodePositions}
        qualitySettings={qualitySettings}
      />

      {/* Performance HUD */}
      <VRPerformanceHUD visible={showStats} targetFPS={targetFPS} />

      {/* Quality Control (debug only) */}
      {debug && (
        <VRQualityControl
          qualityLevel={qualityLevel}
          onQualityChange={onQualityChange}
        />
      )}

      {/* Additional children */}
      {children}
    </XR>
  );
};

// ============================================================================
// Loading Fallback
// ============================================================================

const VRLoadingFallback: React.FC = () => (
  <Html center>
    <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-md rounded-lg px-4 py-3">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-white text-sm">Optimizing for VR...</span>
    </div>
  </Html>
);

// ============================================================================
// Main VR Optimized Scene Component
// ============================================================================

export const VROptimizedScene: React.FC<VROptimizedSceneProps> = ({
  nodes,
  edges = [],
  onNodeSelect,
  onEnterVR,
  onExitVR,
  initialQuality = 'high',
  autoQuality = true,
  showStats = false,
  targetFPS = 72,
  debug = false,
  children,
}) => {
  const [qualityLevel, setQualityLevel] = useState<VRQualityLevel>(initialQuality);

  // Quality settings based on level
  const qualitySettings = useMemo((): VRQualitySettings => {
    const presets: Record<VRQualityLevel, VRQualitySettings> = {
      low: {
        level: 'low',
        polygonBudget: 0.25,
        textureScale: 0.5,
        shadowQuality: 0,
        enablePostProcessing: false,
        enableAA: false,
        drawDistanceScale: 0.5,
        enableDynamicLights: false,
        maxParticles: 100,
        lodBias: 0.5,
      },
      medium: {
        level: 'medium',
        polygonBudget: 0.5,
        textureScale: 0.75,
        shadowQuality: 1,
        enablePostProcessing: false,
        enableAA: true,
        drawDistanceScale: 0.75,
        enableDynamicLights: true,
        maxParticles: 500,
        lodBias: 0.75,
      },
      high: {
        level: 'high',
        polygonBudget: 0.8,
        textureScale: 1,
        shadowQuality: 2,
        enablePostProcessing: false,
        enableAA: true,
        drawDistanceScale: 1,
        enableDynamicLights: true,
        maxParticles: 1000,
        lodBias: 1,
      },
      ultra: {
        level: 'ultra',
        polygonBudget: 1,
        textureScale: 1,
        shadowQuality: 2,
        enablePostProcessing: false, // Still off for VR
        enableAA: true,
        drawDistanceScale: 1.5,
        enableDynamicLights: true,
        maxParticles: 2000,
        lodBias: 1.5,
      },
    };
    return presets[qualityLevel];
  }, [qualityLevel]);

  return (
    <div className="relative w-full h-full">
      {/* VR Button */}
      <VRButton className="absolute bottom-4 right-4 z-10 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg transition-colors" />

      {/* Quality indicator (non-VR) */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5">
        <span className="text-xs text-gray-400">Quality:</span>
        <select
          value={qualityLevel}
          onChange={(e) => setQualityLevel(e.target.value as VRQualityLevel)}
          className="bg-transparent text-white text-xs border-none outline-none cursor-pointer"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="ultra">Ultra</option>
        </select>
      </div>

      {/* Canvas */}
      <Canvas
        gl={{
          antialias: qualitySettings.enableAA,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 2, 10], fov: 75 }}
        frameloop="always"
      >
        <Suspense fallback={<VRLoadingFallback />}>
          <VRSceneContent
            nodes={nodes}
            edges={edges}
            onNodeSelect={onNodeSelect}
            onEnterVR={onEnterVR}
            onExitVR={onExitVR}
            qualityLevel={qualityLevel}
            qualitySettings={qualitySettings}
            onQualityChange={setQualityLevel}
            showStats={showStats}
            targetFPS={targetFPS}
            debug={debug}
          >
            {children}
          </VRSceneContent>
        </Suspense>

        {/* Debug stats */}
        {debug && <Stats />}
      </Canvas>
    </div>
  );
};

export default VROptimizedScene;
