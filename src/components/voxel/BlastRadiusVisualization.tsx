/**
 * Epic 30: Story 30.3 - Blast Radius 3D Visualization
 *
 * 3D visualization of blast radius simulation:
 * - Expanding rings from source node
 * - Color gradient based on impact level
 * - Affected nodes highlighted with glow
 * - Edge paths showing propagation direction
 * - Smooth animations using react-spring
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Text } from '@react-three/drei';
import { animated, useSpring } from '@react-spring/three';
import * as THREE from 'three';
import { AdditiveBlending, Vector3, Group } from 'three';
import type { VoxelNode } from '@/types/voxel';
import type { AffectedNode } from '@/services/blastRadiusService';

// ============================================================================
// Constants
// ============================================================================

const IMPACT_COLORS = {
  critical: '#ef4444',  // Red - 75%+ impact
  high: '#f97316',      // Orange - 50-75% impact
  medium: '#eab308',    // Yellow - 25-50% impact
  low: '#22c55e',       // Green - <25% impact
};

const SOURCE_COLOR = '#8b5cf6'; // Purple for source node

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color based on impact level
 */
const getImpactColor = (impact: number): string => {
  if (impact >= 0.75) return IMPACT_COLORS.critical;
  if (impact >= 0.5) return IMPACT_COLORS.high;
  if (impact >= 0.25) return IMPACT_COLORS.medium;
  return IMPACT_COLORS.low;
};

// Typed animated components
/* eslint-disable @typescript-eslint/no-explicit-any */
const A = {
  group: (animated as any).group,
  mesh: (animated as any).mesh,
  meshBasicMaterial: (animated as any).meshBasicMaterial,
};
/* eslint-enable @typescript-eslint/no-explicit-any */



// ============================================================================
// ExpandingRing Component
// ============================================================================

interface ExpandingRingProps {
  position: [number, number, number];
  depth: number;
  maxDepth: number;
  active: boolean;
  delay: number;
}

/**
 * Animated expanding ring from source node
 */
const ExpandingRing: React.FC<ExpandingRingProps> = React.memo(({
  position,
  depth,
  maxDepth,
  active,
  delay,
}) => {
  const ringRef = useRef<Group>(null);
  const maxRadius = (depth + 1) * 3;
  const progress = 1 - depth / maxDepth;
  const color = getImpactColor(progress);

  const { scale, opacity } = useSpring({
    from: { scale: 0, opacity: 0 },
    to: active
      ? async (next) => {
        await next({ scale: 0, opacity: 0.8 });
        await next({ scale: 1, opacity: 0 });
      }
      : { scale: 0, opacity: 0 },
    delay: delay,
    config: { duration: 1500 },
    loop: active,
  });

  if (!active) return null;

  return (
    <A.group position={position} ref={ringRef}>
      <A.mesh
        rotation={[-Math.PI / 2, 0, 0]}
        scale={scale.to((s: number) => [s * maxRadius, s * maxRadius, 1])}
      >
        <ringGeometry args={[0.9, 1, 64]} />
        <A.meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </A.mesh>
    </A.group>
  );
});

ExpandingRing.displayName = 'ExpandingRing';

// ============================================================================
// SourceNodeHighlight Component
// ============================================================================

interface SourceNodeHighlightProps {
  position: [number, number, number];
  size: number;
  active: boolean;
}

/**
 * Highlight effect for the source/origin node
 */
const SourceNodeHighlight: React.FC<SourceNodeHighlightProps> = React.memo(({
  position,
  size,
  active,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);



  // Pulsing animation
  useFrame(({ clock }) => {
    if (meshRef.current && active) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.1;
      meshRef.current.scale.setScalar(size * 1.2 * pulse);
    }
    if (glowRef.current && active) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.2;
      glowRef.current.scale.setScalar(size * 2.5 * pulse);
    }
  });

  if (!active) return null;

  return (
    <group position={position}>
      {/* Inner ring */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.1, size * 1.3, 32]} />
        <meshBasicMaterial
          color={SOURCE_COLOR}
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={SOURCE_COLOR}
          transparent
          opacity={0.15}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Label */}
      <Text
        position={[0, size + 1.5, 0]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        SOURCE
      </Text>
    </group>
  );
});

SourceNodeHighlight.displayName = 'SourceNodeHighlight';

// ============================================================================
// AffectedNodeHighlight Component
// ============================================================================

interface AffectedNodeHighlightProps {
  affectedNode: AffectedNode;
  active: boolean;
  delay: number;
  onClick?: (nodeId: string) => void;
}

/**
 * Highlight effect for affected nodes
 */
const AffectedNodeHighlight: React.FC<AffectedNodeHighlightProps> = React.memo(({
  affectedNode,
  active,
  delay,
  onClick,
}) => {
  const { nodeId, node, impact, depth } = affectedNode;
  const pos = node.position;
  const position: [number, number, number] = [pos.x, pos.y, pos.z];
  const color = getImpactColor(impact);

  const nodeSize = (node.data as { size?: number })?.size || 1;

  const meshRef = useRef<THREE.Mesh>(null);

  // Entrance animation with delay
  const { scale, opacity } = useSpring({
    from: { scale: 0, opacity: 0 },
    to: { scale: active ? 1 : 0, opacity: active ? 0.8 : 0 },
    delay,
    config: { tension: 280, friction: 60 },
  });

  // Pulse based on impact
  useFrame(({ clock }) => {
    if (meshRef.current && active) {
      const speed = 2 + impact * 2;
      const pulse = 1 + Math.sin(clock.getElapsedTime() * speed) * 0.1 * impact;
      meshRef.current.scale.setScalar(nodeSize * 1.5 * pulse);
    }
  });

  if (!active) return null;

  return (
    <A.group
      position={position}
      scale={scale}
      onClick={() => onClick?.(nodeId)}
    >
      {/* Glow sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <A.meshBasicMaterial
          color={color}
          transparent
          opacity={opacity.to((o: number) => o * 0.3)}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Ring indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[nodeSize * 1.3, nodeSize * 1.5, 32]} />
        <A.meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Impact percentage label */}
      <Text
        position={[0, nodeSize + 0.8, 0]}
        fontSize={0.35}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {`${Math.round(impact * 100)}%`}
      </Text>

      {/* Depth indicator */}
      <Text
        position={[nodeSize + 0.5, 0, 0]}
        fontSize={0.25}
        color="white"
        anchorX="left"
        anchorY="middle"
      >
        {`D${depth}`}
      </Text>
    </A.group>
  );
});

AffectedNodeHighlight.displayName = 'AffectedNodeHighlight';

// ============================================================================
// ImpactPath Component
// ============================================================================

interface ImpactPathProps {
  path: string[];
  nodes: Map<string, VoxelNode>;
  active: boolean;
  delay: number;
  impact: number;
}

/**
 * Animated path showing impact propagation
 */
const ImpactPath: React.FC<ImpactPathProps> = React.memo(({
  path,
  nodes,
  active,
  delay,
  impact,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null);
  const color = getImpactColor(impact);

  // Build path points
  const points = useMemo(() => {
    const pts: Vector3[] = [];
    for (const nodeId of path) {
      const node = nodes.get(nodeId);
      if (node) {
        pts.push(new Vector3(node.position.x, node.position.y, node.position.z));
      }
    }
    return pts;
  }, [path, nodes]);

  // Animation
  const { progress } = useSpring({
    from: { progress: 0 },
    to: { progress: active ? 1 : 0 },
    delay,
    config: { duration: 800 },
  });

  // Animate dash offset
  useFrame(({ clock }) => {
    if (lineRef.current?.material && active) {
      const material = lineRef.current.material as THREE.LineDashedMaterial & { dashOffset?: number };
      if (material.dashOffset !== undefined) {
        material.dashOffset = -clock.getElapsedTime() * 2;
      }
    }
  });

  if (points.length < 2 || !active) return null;

  return (
    <A.group scale={progress}>
      <Line
        ref={lineRef}
        points={points}
        color={color}
        lineWidth={2}
        dashed
        dashSize={0.3}
        dashScale={1}
        gapSize={0.2}
        transparent
        opacity={0.6}
      />
    </A.group>
  );
});

ImpactPath.displayName = 'ImpactPath';

// ============================================================================
// Main BlastRadiusVisualization Component
// ============================================================================

interface BlastRadiusVisualizationProps {
  /** Source node ID */
  sourceNodeId: string | null;
  /** Source node data */
  sourceNode: VoxelNode | null;
  /** List of affected nodes */
  affectedNodes: AffectedNode[];
  /** All nodes for path rendering */
  allNodes: Map<string, VoxelNode>;
  /** Impact paths */
  paths: string[][];
  /** Maximum depth reached */
  maxDepth: number;
  /** Whether simulation is active */
  isActive: boolean;
  /** Whether to show expanding rings */
  showRings?: boolean;
  /** Whether to show impact paths */
  showPaths?: boolean;
  /** Whether to show impact labels */
  showLabels?: boolean;
  /** Callback when affected node is clicked */
  onNodeClick?: (nodeId: string) => void;
}

/**
 * Main blast radius visualization component
 */
export const BlastRadiusVisualization: React.FC<BlastRadiusVisualizationProps> = React.memo(({
  sourceNode,
  affectedNodes,
  allNodes,
  paths,
  maxDepth,
  isActive,
  showRings = true,
  showPaths = true,
  // showLabels = true,
  onNodeClick,
}) => {
  // Source position
  const sourcePosition = useMemo<[number, number, number] | null>(() => {
    if (!sourceNode) return null;
    return [sourceNode.position.x, sourceNode.position.y, sourceNode.position.z];
  }, [sourceNode]);



  // Top paths (limit for performance)
  const topPaths = useMemo(() => {
    return paths.slice(0, 20);
  }, [paths]);

  if (!isActive || !sourcePosition) return null;

  return (
    <group>
      {/* Source node highlight */}
      <SourceNodeHighlight
        position={sourcePosition}
        size={sourceNode ? ((sourceNode.data as { size?: number })?.size || 1) : 1}
        active={isActive}
      />

      {/* Expanding rings */}
      {showRings && Array.from({ length: Math.min(maxDepth, 5) }, (_, i) => (
        <ExpandingRing
          key={`ring-${i || 'unknown'}`}
          position={sourcePosition}
          depth={i}
          maxDepth={maxDepth}
          active={isActive}
          delay={i * 300}
        />
      ))}

      {/* Impact paths */}
      {showPaths && topPaths.map((path, index) => {
        const lastNode = affectedNodes.find((n) => n.nodeId === path[path.length - 1]);
        return (
          <ImpactPath
            key={`path-${index || 'unknown'}`}
            path={path}
            nodes={allNodes}
            active={isActive}
            delay={100 + index * 50}
            impact={lastNode?.impact || 0.5}
          />
        );
      })}

      {/* Affected node highlights */}
      {affectedNodes.map((node, index) => (
        <AffectedNodeHighlight
          key={node.nodeId || 'unknown'}
          affectedNode={node}
          active={isActive}
          delay={node.depth * 200 + (index % 10) * 30}
          onClick={onNodeClick}
        />
      ))}
    </group>
  );
});

BlastRadiusVisualization.displayName = 'BlastRadiusVisualization';

// ============================================================================
// BlastRadiusOverlay Component (for scene integration)
// ============================================================================

interface BlastRadiusOverlayProps {
  sourceNodeId: string | null;
  nodes: Map<string, VoxelNode>;
  affectedNodes: AffectedNode[];
  paths: string[][];
  maxDepth: number;
  isActive: boolean;
  showRings?: boolean;
  showPaths?: boolean;
  showLabels?: boolean;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * Overlay component that integrates with existing Voxel scene
 */
export const BlastRadiusOverlay: React.FC<BlastRadiusOverlayProps> = React.memo(({
  sourceNodeId,
  nodes,
  affectedNodes,
  paths,
  maxDepth,
  isActive,
  showRings = true,
  showPaths = true,
  showLabels = true,
  onNodeClick,
}) => {
  const sourceNode = sourceNodeId ? nodes.get(sourceNodeId) || null : null;

  return (
    <BlastRadiusVisualization
      sourceNodeId={sourceNodeId}
      sourceNode={sourceNode}
      affectedNodes={affectedNodes}
      allNodes={nodes}
      paths={paths}
      maxDepth={maxDepth}
      isActive={isActive}
      showRings={showRings}
      showPaths={showPaths}
      showLabels={showLabels}
      onNodeClick={onNodeClick}
    />
  );
});

BlastRadiusOverlay.displayName = 'BlastRadiusOverlay';

export default BlastRadiusVisualization;
