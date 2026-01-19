/**
 * Epic 29: Story 29.5 - Anomaly Visualization 3D
 *
 * 3D visual indicators for anomalous nodes:
 * - Pulsing red outline for anomalous nodes
 * - Connection lines showing circular dependencies
 * - Severity-based color coding
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Text } from '@react-three/drei';
import { animated, useSpring, config } from '@react-spring/three';
import * as THREE from 'three';
import { AdditiveBlending, Group, Vector3 } from 'three';
import type { VoxelAnomaly, VoxelAnomalySeverity, VoxelNode } from '../../types/voxel';

// Fix for strict type checking on animated.meshBasicMaterial
// Fix for strict type checking on animated.meshBasicMaterial
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnimatedMeshBasicMaterial = (animated as any).meshBasicMaterial;

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_COLORS: Record<VoxelAnomalySeverity, string> = {
  critical: '#ef4444', // Red
  high: '#f97316',     // Orange
  medium: '#eab308',   // Yellow
  low: '#3b82f6',      // Blue
};

// const SEVERITY_EMISSIVE: Record<VoxelAnomalySeverity, string> = { ... };

const PULSE_SPEEDS: Record<VoxelAnomalySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1.5,
};

// ============================================================================
// AnomalyPulseRing Component
// ============================================================================

interface AnomalyPulseRingProps {
  position: [number, number, number];
  severity: VoxelAnomalySeverity;
  size: number;
  visible?: boolean;
}

/**
 * Pulsing ring effect for anomalous nodes
 */
export const AnomalyPulseRing: React.FC<AnomalyPulseRingProps> = React.memo(({
  position,
  severity,
  size,
  visible = true,
}) => {
  const ringRef = useRef<Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const pulseSpeed = PULSE_SPEEDS[severity];
  const color = SEVERITY_COLORS[severity];

  // Animated scale for pulse effect
  const [{ scale, opacity }] = useSpring(() => ({
    from: { scale: 1, opacity: 0.8 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    to: async (next: any) => {
      while (visible) {
        await next({ scale: 1.5, opacity: 0 });
        await next({ scale: 1, opacity: 0.8 });
      }
    },
    config: { duration: 1000 / pulseSpeed },
    loop: true,
  }), [visible, pulseSpeed]);

  if (!visible) return null;

  // @ts-expect-error: react-spring types for mesh
  const AnimatedMesh = animated.mesh as unknown as React.FC<{
    rotation: [number, number, number];
    position: [number, number, number];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scale: any;
    children: React.ReactNode;
  }>;

  return (
    <group position={position} ref={ringRef}>
      {/* Inner solid ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -size * 0.4, 0]}>
        <ringGeometry args={[size * 1.2, size * 1.3, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Outer pulsing ring */}
      <AnimatedMesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -size * 0.4, 0]}
        scale={scale}
      >
        <ringGeometry args={[size * 1.3, size * 1.5, 32]} />
        <AnimatedMeshBasicMaterial
          ref={materialRef}
          color={color}
          transparent
          opacity={opacity}
          blending={AdditiveBlending}
        />
      </AnimatedMesh>
    </group>
  );
});

AnomalyPulseRing.displayName = 'AnomalyPulseRing';

// ============================================================================
// AnomalyGlow Component
// ============================================================================

interface AnomalyGlowProps {
  position: [number, number, number];
  severity: VoxelAnomalySeverity;
  size: number;
}

/**
 * Glowing sphere effect for anomaly indication
 */
export const AnomalyGlow: React.FC<AnomalyGlowProps> = React.memo(({
  position,
  severity,
  size,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = SEVERITY_COLORS[severity];
  // const emissive = SEVERITY_EMISSIVE[severity];
  const speed = PULSE_SPEEDS[severity];

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      const pulse = 0.8 + Math.sin(t * speed * 2) * 0.2;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[size * 1.8, 16, 16]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.15}
        blending={AdditiveBlending}
      />
    </mesh>
  );
});

AnomalyGlow.displayName = 'AnomalyGlow';

// ============================================================================
// CycleDependencyLines Component
// ============================================================================

interface CycleDependencyLinesProps {
  nodes: Map<string, VoxelNode>;
  cyclePath: string[];
  severity: VoxelAnomalySeverity;
}

/**
 * Connection lines showing circular dependency paths
 */
export const CycleDependencyLines: React.FC<CycleDependencyLinesProps> = React.memo(({
  nodes,
  cyclePath,
  severity,
}) => {
  const lineRef = useRef<THREE.Line>(null);
  const color = SEVERITY_COLORS[severity];

  // Calculate points for the cycle path
  const points = useMemo(() => {
    const pathPoints: Vector3[] = [];

    for (const nodeId of cyclePath) {
      const node = nodes.get(nodeId);
      if (node && node.position) {
        const pos = node.position;
        pathPoints.push(new Vector3(pos.x, pos.y, pos.z));
      }
    }

    return pathPoints;
  }, [nodes, cyclePath]);

  // Animate line dash offset
  useFrame(({ clock }) => {
    if (lineRef.current?.material) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const material = lineRef.current.material as any;
      if (material.dashOffset !== undefined) {
        material.dashOffset = -clock.getElapsedTime() * 2;
      }
    }
  });

  if (points.length < 2) return null;

  return (
    <Line
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={lineRef as any}
      points={points}
      color={color}
      lineWidth={3}
      dashed
      dashSize={0.5}
      dashScale={1}
      gapSize={0.3}
    />
  );
});

CycleDependencyLines.displayName = 'CycleDependencyLines';

// ============================================================================
// AnomalyBadge Component
// ============================================================================

interface AnomalyBadgeProps {
  position: [number, number, number];
  count: number;
  severity: VoxelAnomalySeverity;
  size: number;
}

/**
 * 3D badge showing anomaly count on a node
 */
export const AnomalyBadge: React.FC<AnomalyBadgeProps> = React.memo(({
  position,
  count,
  severity,
  size,
}) => {
  const color = SEVERITY_COLORS[severity];
  const badgePosition: [number, number, number] = [
    position[0] + size * 0.8,
    position[1] + size * 0.8,
    position[2],
  ];

  const [{ scale }] = useSpring(() => ({
    from: { scale: 0 },
    to: { scale: 1 },
    config: config.wobbly,
  }), []);

  // @ts-expect-error: react-spring group type
  const AnimatedGroup = animated.group as React.FC<{
    position: [number, number, number];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scale: any;
    children: React.ReactNode;
  }>;

  return (
    <AnimatedGroup position={badgePosition} scale={scale}>
      {/* Badge background */}
      <mesh>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Badge text */}
      <Text
        position={[0, 0, 0.45]}
        fontSize={0.35}
        color="white"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff"
      >
        {count > 9 ? '9+' : String(count)}
      </Text>
    </AnimatedGroup>
  );
});

AnomalyBadge.displayName = 'AnomalyBadge';

// ============================================================================
// AnomalyHighlight Component (Main)
// ============================================================================

interface AnomalyHighlightProps {
  node: VoxelNode;
  anomalies: VoxelAnomaly[];
  allNodes: Map<string, VoxelNode>;
  showBadge?: boolean;
  showGlow?: boolean;
  showPulse?: boolean;
  showCycleLines?: boolean;
}

/**
 * Main component for highlighting anomalous nodes in 3D
 */
export const AnomalyHighlight: React.FC<AnomalyHighlightProps> = React.memo(({
  node,
  anomalies,
  allNodes,
  showBadge = true,
  showGlow = true,
  showPulse = true,
  showCycleLines = true,
}) => {
  // Filter anomalies for this node
  const nodeAnomalies = useMemo(
    () => anomalies.filter((a) => a.nodeId === node.id && a.status === 'active'),
    [anomalies, node.id]
  );

  // Find highest severity
  const highestSeverity = useMemo<VoxelAnomalySeverity>(() => {
    const severityOrder: VoxelAnomalySeverity[] = ['critical', 'high', 'medium', 'low'];
    for (const severity of severityOrder) {
      if (nodeAnomalies.some((a) => a.severity === severity)) {
        return severity;
      }
    }
    return 'low';
  }, [nodeAnomalies]);

  // Find cycle paths for circular dependency anomalies
  const cyclePaths = useMemo(() => {
    return nodeAnomalies
      .filter((a) => a.type === 'circular_dependency' && a.details?.cyclePath)
      .map((a) => a.details!.cyclePath!);
  }, [nodeAnomalies]);

  if (nodeAnomalies.length === 0) return null;

  const pos = node.position;
  const nodePosition: [number, number, number] = [pos.x, pos.y, pos.z];

  const nodeSize = (node.data as { size?: number })?.size || 1;

  return (
    <group>
      {/* Pulsing ring */}
      {showPulse && (
        <AnomalyPulseRing
          position={nodePosition}
          severity={highestSeverity}
          size={nodeSize}
        />
      )}

      {/* Glow effect */}
      {showGlow && (
        <AnomalyGlow
          position={nodePosition}
          severity={highestSeverity}
          size={nodeSize}
        />
      )}

      {/* Anomaly count badge */}
      {showBadge && nodeAnomalies.length > 0 && (
        <AnomalyBadge
          position={nodePosition}
          count={nodeAnomalies.length}
          severity={highestSeverity}
          size={nodeSize}
        />
      )}

      {/* Circular dependency lines */}
      {showCycleLines && cyclePaths.map((path, index) => (
        <CycleDependencyLines
          key={`cycle-${node.id}-${index}`}
          nodes={allNodes}
          cyclePath={path}
          severity="critical"
        />
      ))}
    </group>
  );
});

AnomalyHighlight.displayName = 'AnomalyHighlight';

// ============================================================================
// AnomalyOverlay Component
// ============================================================================

interface AnomalyOverlayProps {
  anomalies: VoxelAnomaly[];
  nodes: Map<string, VoxelNode>;
  showBadges?: boolean;
  showGlows?: boolean;
  showPulses?: boolean;
  showCycleLines?: boolean;
}

/**
 * Overlay component that renders anomaly highlights for all affected nodes
 */
export const AnomalyOverlay: React.FC<AnomalyOverlayProps> = React.memo(({
  anomalies,
  nodes,
  showBadges = true,
  showGlows = true,
  showPulses = true,
  showCycleLines = true,
}) => {
  // Get unique node IDs with active anomalies
  const affectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    anomalies
      .filter((a) => a.status === 'active')
      .forEach((a) => ids.add(a.nodeId));
    return Array.from(ids);
  }, [anomalies]);

  return (
    <group>
      {affectedNodeIds.map((nodeId) => {
        const node = nodes.get(nodeId);
        if (!node) return null;

        return (
          <AnomalyHighlight
            key={`anomaly-highlight-${nodeId}`}
            node={node}
            anomalies={anomalies}
            allNodes={nodes}
            showBadge={showBadges}
            showGlow={showGlows}
            showPulse={showPulses}
            showCycleLines={showCycleLines}
          />
        );
      })}
    </group>
  );
});

AnomalyOverlay.displayName = 'AnomalyOverlay';

export default AnomalyHighlight;
