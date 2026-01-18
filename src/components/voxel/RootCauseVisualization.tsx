/**
 * Epic 30: Story 30.7 - Root Cause 3D Visualization
 *
 * 3D visualization of root cause analysis:
 * - Highlight potential root cause nodes
 * - Show paths from causes to incident
 * - Color intensity based on likelihood
 * - Animated path tracing effect
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Text, Html } from '@react-three/drei';
import { animated, useSpring, config } from '@react-spring/three';
import { AdditiveBlending, Vector3, Group, CatmullRomCurve3 } from 'three';
import type { VoxelNode } from '@/types/voxel';
import type { PotentialCause, RootCauseResult } from '@/services/blastRadiusService';

// ============================================================================
// Constants
// ============================================================================

const LIKELIHOOD_COLORS = {
  veryHigh: '#ef4444',   // Red - 80%+ likelihood
  high: '#f97316',       // Orange - 60-80%
  medium: '#eab308',     // Yellow - 40-60%
  low: '#22c55e',        // Green - 20-40%
  veryLow: '#3b82f6',    // Blue - <20%
};

const INCIDENT_COLOR = '#f43f5e'; // Rose for incident node

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color based on likelihood
 */
const getLikelihoodColor = (likelihood: number): string => {
  if (likelihood >= 0.8) return LIKELIHOOD_COLORS.veryHigh;
  if (likelihood >= 0.6) return LIKELIHOOD_COLORS.high;
  if (likelihood >= 0.4) return LIKELIHOOD_COLORS.medium;
  if (likelihood >= 0.2) return LIKELIHOOD_COLORS.low;
  return LIKELIHOOD_COLORS.veryLow;
};

// ============================================================================
// IncidentNodeHighlight Component
// ============================================================================

interface IncidentNodeHighlightProps {
  position: [number, number, number];
  size: number;
  active: boolean;
}

/**
 * Highlight effect for the incident/target node
 */
const IncidentNodeHighlight: React.FC<IncidentNodeHighlightProps> = React.memo(({
  position,
  size,
  active,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Entrance animation
  const { scale } = useSpring({
    from: { scale: 0 },
    to: { scale: active ? 1 : 0 },
    config: config.wobbly,
  });

  // Pulsing animation
  useFrame(({ clock }) => {
    if (meshRef.current && active) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.15;
      meshRef.current.scale.setScalar(size * 2 * pulse);
    }
    if (ringRef.current && active) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.5;
    }
  });

  if (!active) return null;

  return (
    <animated.group position={position} scale={scale}>
      {/* Pulsing glow */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={INCIDENT_COLOR}
          transparent
          opacity={0.2}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Rotating ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.5, size * 1.7, 6]} />
        <meshBasicMaterial
          color={INCIDENT_COLOR}
          transparent
          opacity={0.7}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Inner ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.2, size * 1.4, 32]} />
        <meshBasicMaterial
          color={INCIDENT_COLOR}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Label */}
      <Text
        position={[0, size + 1.5, 0]}
        fontSize={0.5}
        color={INCIDENT_COLOR}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        INCIDENT
      </Text>
    </animated.group>
  );
});

IncidentNodeHighlight.displayName = 'IncidentNodeHighlight';

// ============================================================================
// RootCauseNodeHighlight Component
// ============================================================================

interface RootCauseNodeHighlightProps {
  cause: PotentialCause;
  active: boolean;
  delay: number;
  rank: number;
  onClick?: (nodeId: string) => void;
}

/**
 * Highlight effect for potential root cause nodes
 */
const RootCauseNodeHighlight: React.FC<RootCauseNodeHighlightProps> = React.memo(({
  cause,
  active,
  delay,
  rank,
  onClick,
}) => {
  const { nodeId, node, likelihood, depth, contributingFactors } = cause;
  const pos = node.position;
  const position: [number, number, number] = [pos.x, pos.y, pos.z];
  const color = getLikelihoodColor(likelihood);
  const nodeSize = (node.data as { size?: number })?.size || 1;

  const meshRef = useRef<THREE.Mesh>(null);
  const arrowRef = useRef<Group>(null);

  // Entrance animation
  const { scale, opacity } = useSpring({
    from: { scale: 0, opacity: 0 },
    to: { scale: active ? 1 : 0, opacity: active ? 1 : 0 },
    delay,
    config: { tension: 280, friction: 60 },
  });

  // Pulsing based on likelihood
  useFrame(({ clock }) => {
    if (meshRef.current && active) {
      const speed = 1.5 + likelihood * 2;
      const pulse = 1 + Math.sin(clock.getElapsedTime() * speed) * 0.1 * likelihood;
      meshRef.current.scale.setScalar(nodeSize * 1.8 * pulse);
    }
    if (arrowRef.current && active) {
      arrowRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
  });

  if (!active) return null;

  return (
    <animated.group
      position={position}
      scale={scale}
      onClick={() => onClick?.(nodeId)}
    >
      {/* Glow sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <animated.meshBasicMaterial
          color={color}
          transparent
          opacity={opacity.to((o) => o * 0.25)}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Ring indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[nodeSize * 1.3, nodeSize * 1.5, 32]} />
        <animated.meshBasicMaterial
          color={color}
          transparent
          opacity={opacity.to((o) => o * 0.8)}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Upward arrow indicator (root cause points up) */}
      <group ref={arrowRef}>
        <mesh position={[0, nodeSize + 0.5, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.3, 0.5, 4]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>

      {/* Likelihood label */}
      <Text
        position={[0, nodeSize + 1.2, 0]}
        fontSize={0.4}
        color={color}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {`${Math.round(likelihood * 100)}%`}
      </Text>

      {/* Rank badge */}
      <Text
        position={[-nodeSize - 0.5, nodeSize, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {`#${rank}`}
      </Text>

      {/* Contributing factors (HTML overlay) */}
      {contributingFactors.length > 0 && (
        <Html
          position={[nodeSize + 1, 0, 0]}
          center
          distanceFactor={15}
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-slate-900/90 rounded-lg px-2 py-1 text-[10px] text-white/70 whitespace-nowrap border border-white/10">
            {contributingFactors.slice(0, 2).join(' | ')}
          </div>
        </Html>
      )}
    </animated.group>
  );
});

RootCauseNodeHighlight.displayName = 'RootCauseNodeHighlight';

// ============================================================================
// CausalPath Component
// ============================================================================

interface CausalPathProps {
  path: string[];
  nodes: Map<string, VoxelNode>;
  likelihood: number;
  active: boolean;
  delay: number;
  animate?: boolean;
}

/**
 * Animated path showing causal chain from root cause to incident
 */
const CausalPath: React.FC<CausalPathProps> = React.memo(({
  path,
  nodes,
  likelihood,
  active,
  delay,
  animate = true,
}) => {
  const lineRef = useRef<THREE.Line>(null);
  const particleRef = useRef<THREE.Mesh>(null);
  const color = getLikelihoodColor(likelihood);

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

  // Create smooth curve for particle animation
  const curve = useMemo(() => {
    if (points.length < 2) return null;
    return new CatmullRomCurve3(points);
  }, [points]);

  // Animation
  const { progress } = useSpring({
    from: { progress: 0 },
    to: { progress: active ? 1 : 0 },
    delay,
    config: { duration: 1000 },
  });

  // Particle animation along path
  useFrame(({ clock }) => {
    if (particleRef.current && curve && active && animate) {
      const t = (clock.getElapsedTime() * 0.3) % 1;
      const point = curve.getPoint(t);
      particleRef.current.position.copy(point);
    }
    if (lineRef.current?.material && active) {
      const material = lineRef.current.material as THREE.LineDashedMaterial;
      if (material.dashOffset !== undefined) {
        material.dashOffset = -clock.getElapsedTime() * 1.5;
      }
    }
  });

  if (points.length < 2 || !active) return null;

  return (
    <animated.group scale={progress}>
      {/* Path line */}
      <Line
        ref={lineRef}
        points={points}
        color={color}
        lineWidth={2 + likelihood * 2}
        dashed
        dashSize={0.4}
        dashScale={1}
        gapSize={0.2}
        transparent
        opacity={0.5 + likelihood * 0.3}
      />

      {/* Arrow heads along path */}
      {points.slice(0, -1).map((point, i) => {
        const nextPoint = points[i + 1];
        const direction = new Vector3().subVectors(nextPoint, point).normalize();
        const midpoint = new Vector3().addVectors(point, nextPoint).multiplyScalar(0.5);

        return (
          <group key={i} position={midpoint.toArray()}>
            <mesh
              rotation={[
                Math.atan2(direction.y, Math.sqrt(direction.x ** 2 + direction.z ** 2)),
                Math.atan2(direction.x, direction.z),
                0,
              ]}
            >
              <coneGeometry args={[0.15, 0.4, 4]} />
              <meshBasicMaterial color={color} transparent opacity={0.8} />
            </mesh>
          </group>
        );
      })}

      {/* Traveling particle */}
      {animate && curve && (
        <mesh ref={particleRef}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
          />
        </mesh>
      )}
    </animated.group>
  );
});

CausalPath.displayName = 'CausalPath';

// ============================================================================
// Main RootCauseVisualization Component
// ============================================================================

interface RootCauseVisualizationProps {
  /** Incident node ID */
  incidentNodeId: string | null;
  /** Incident node data */
  incidentNode: VoxelNode | null;
  /** Potential root causes */
  potentialCauses: PotentialCause[];
  /** All nodes for path rendering */
  allNodes: Map<string, VoxelNode>;
  /** Whether analysis is active */
  isActive: boolean;
  /** Maximum causes to display */
  maxCausesDisplayed?: number;
  /** Whether to show path animations */
  showPathAnimations?: boolean;
  /** Whether to show likelihood labels */
  showLabels?: boolean;
  /** Callback when cause node is clicked */
  onCauseClick?: (nodeId: string) => void;
}

/**
 * Main root cause visualization component
 */
export const RootCauseVisualization: React.FC<RootCauseVisualizationProps> = React.memo(({
  incidentNodeId,
  incidentNode,
  potentialCauses,
  allNodes,
  isActive,
  maxCausesDisplayed = 10,
  showPathAnimations = true,
  showLabels = true,
  onCauseClick,
}) => {
  // Incident position
  const incidentPosition = useMemo<[number, number, number] | null>(() => {
    if (!incidentNode) return null;
    return [incidentNode.position.x, incidentNode.position.y, incidentNode.position.z];
  }, [incidentNode]);

  // Top causes (limited for performance)
  const topCauses = useMemo(() => {
    return potentialCauses.slice(0, maxCausesDisplayed);
  }, [potentialCauses, maxCausesDisplayed]);

  // All unique paths from causes to incident
  const allPaths = useMemo(() => {
    const paths: Array<{ path: string[]; likelihood: number }> = [];
    topCauses.forEach((cause) => {
      cause.paths.forEach((path) => {
        // Reverse path so it goes from cause to incident
        paths.push({
          path: [...path].reverse(),
          likelihood: cause.likelihood,
        });
      });
    });
    // Limit paths for performance
    return paths.slice(0, 15);
  }, [topCauses]);

  if (!isActive || !incidentPosition) return null;

  return (
    <group>
      {/* Incident node highlight */}
      <IncidentNodeHighlight
        position={incidentPosition}
        size={incidentNode ? ((incidentNode.data as { size?: number })?.size || 1) : 1}
        active={isActive}
      />

      {/* Causal paths */}
      {allPaths.map((pathData, index) => (
        <CausalPath
          key={`path-${index}`}
          path={pathData.path}
          nodes={allNodes}
          likelihood={pathData.likelihood}
          active={isActive}
          delay={200 + index * 100}
          animate={showPathAnimations && index < 5} // Only animate top 5 paths
        />
      ))}

      {/* Root cause node highlights */}
      {topCauses.map((cause, index) => (
        <RootCauseNodeHighlight
          key={cause.nodeId}
          cause={cause}
          active={isActive}
          delay={cause.depth * 150 + index * 50}
          rank={index + 1}
          onClick={onCauseClick}
        />
      ))}
    </group>
  );
});

RootCauseVisualization.displayName = 'RootCauseVisualization';

// ============================================================================
// RootCauseOverlay Component (for scene integration)
// ============================================================================

interface RootCauseOverlayProps {
  incidentNodeId: string | null;
  nodes: Map<string, VoxelNode>;
  potentialCauses: PotentialCause[];
  isActive: boolean;
  maxCausesDisplayed?: number;
  showPathAnimations?: boolean;
  showLabels?: boolean;
  onCauseClick?: (nodeId: string) => void;
}

/**
 * Overlay component that integrates with existing Voxel scene
 */
export const RootCauseOverlay: React.FC<RootCauseOverlayProps> = React.memo(({
  incidentNodeId,
  nodes,
  potentialCauses,
  isActive,
  maxCausesDisplayed,
  showPathAnimations,
  showLabels,
  onCauseClick,
}) => {
  const incidentNode = incidentNodeId ? nodes.get(incidentNodeId) || null : null;

  return (
    <RootCauseVisualization
      incidentNodeId={incidentNodeId}
      incidentNode={incidentNode}
      potentialCauses={potentialCauses}
      allNodes={nodes}
      isActive={isActive}
      maxCausesDisplayed={maxCausesDisplayed}
      showPathAnimations={showPathAnimations}
      showLabels={showLabels}
      onCauseClick={onCauseClick}
    />
  );
});

RootCauseOverlay.displayName = 'RootCauseOverlay';

export default RootCauseVisualization;
