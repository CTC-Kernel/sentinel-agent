/**
 * Story 36-3: IT/OT Voxel Mapping - IT-OT Connection Edges
 *
 * Renders connections between IT and OT segments with:
 * - Gradient line from IT (blue) to OT (orange)
 * - Dashed line style for cross-segment connections
 * - DMZ waypoint rendering
 * - Connection type labels on hover
 * - Animated flow direction indicator
 */

import React, { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Line, Billboard, Html } from '@react-three/drei';
import {
  Vector3,
  AdditiveBlending,
  Group
} from 'three';
import type { VoxelNode, VoxelEdge } from '../../types/voxel';
import {
  SEGMENT_COLORS,
  getConnectionType,
  isCrossSegmentConnection,
  type ConnectionType
} from './voxelConstants';

// ============================================================================
// Types
// ============================================================================

export interface ITOTEdgeProps {
  /** The edge data */
  edge: VoxelEdge;
  /** Source node */
  sourceNode: VoxelNode;
  /** Target node */
  targetNode: VoxelNode;
  /** Optional DMZ waypoint node */
  dmzNode?: VoxelNode | null;
  /** Whether edge is highlighted */
  isHighlighted?: boolean;
  /** Whether edge is dimmed */
  isDimmed?: boolean;
  /** Show connection type label */
  showLabel?: boolean;
  /** Click handler */
  onClick?: (edge: VoxelEdge) => void;
  /** Animated flow direction */
  animated?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CONNECTION_LABELS: Record<ConnectionType, string> = {
  'it-to-ot': 'IT → OT',
  'ot-to-it': 'OT → IT',
  'it-to-dmz': 'IT → DMZ',
  'dmz-to-ot': 'DMZ → OT',
  'same-segment': 'Internal',
};

const EDGE_TYPE_LABELS: Record<VoxelEdge['type'], string> = {
  dependency: 'Dependency',
  mitigation: 'Mitigation',
  assignment: 'Assignment',
  impact: 'Impact',
};

// ============================================================================
// Gradient Line Component
// ============================================================================

interface GradientLineProps {
  points: Vector3[];
  startColor: string;
  endColor: string;
  lineWidth: number;
  opacity: number;
  dashed: boolean;
  animated: boolean;
}

const GradientLine: React.FC<GradientLineProps> = React.memo(
  ({ points, startColor, endColor, lineWidth, opacity, dashed, animated }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineRef = useRef<any>(null);

    // Create gradient by using multiple line segments
    const segments = useMemo(() => {
      if (points.length < 2) return [];

      const segmentCount = 10;
      const result: Array<{
        start: Vector3;
        end: Vector3;
        color: string;
      }> = [];

      for (let i = 0; i < segmentCount; i++) {
        const t1 = i / segmentCount;
        const t2 = (i + 1) / segmentCount;

        // Interpolate position
        const start = new Vector3().lerpVectors(points[0], points[points.length - 1], t1);
        const end = new Vector3().lerpVectors(points[0], points[points.length - 1], t2);

        // Interpolate color
        const r1 = parseInt(startColor.slice(1, 3), 16);
        const g1 = parseInt(startColor.slice(3, 5), 16);
        const b1 = parseInt(startColor.slice(5, 7), 16);
        const r2 = parseInt(endColor.slice(1, 3), 16);
        const g2 = parseInt(endColor.slice(3, 5), 16);
        const b2 = parseInt(endColor.slice(5, 7), 16);

        const tMid = (t1 + t2) / 2;
        const r = Math.round(r1 + (r2 - r1) * tMid);
        const g = Math.round(g1 + (g2 - g1) * tMid);
        const b = Math.round(b1 + (b2 - b1) * tMid);

        const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

        result.push({ start, end, color });
      }

      return result;
    }, [points, startColor, endColor]);

    // Animate dash offset
    useFrame(({ clock }) => {
      if (lineRef.current?.material && animated && dashed) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const material = lineRef.current.material as any;
        if (material.dashOffset !== undefined) {
          material.dashOffset = -clock.getElapsedTime() * 2;
        }
      }
    });

    return (
      <group>
        {segments.map((segment, index) => (
          <Line
            key={index}
            ref={index === 0 ? lineRef : undefined}
            points={[segment.start, segment.end]}
            color={segment.color}
            lineWidth={lineWidth}
            transparent
            opacity={opacity}
            dashed={dashed}
            dashSize={0.4}
            dashScale={1}
            gapSize={0.2}
          />
        ))}
      </group>
    );
  }
);

// ============================================================================
// Flow Indicator Component
// ============================================================================

interface FlowIndicatorProps {
  points: Vector3[];
  color: string;
  speed: number;
}

const FlowIndicator: React.FC<FlowIndicatorProps> = React.memo(({ points, color, speed }) => {
  const meshRef = useRef<Group>(null);
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    if (meshRef.current && points.length >= 2) {
      progressRef.current = (progressRef.current + delta * speed) % 1;

      // Interpolate position along path
      const start = points[0];
      const end = points[points.length - 1];
      const pos = new Vector3().lerpVectors(start, end, progressRef.current);

      meshRef.current.position.copy(pos);

      // Rotate to face direction
      const direction = new Vector3().subVectors(end, start).normalize();
      meshRef.current.lookAt(pos.clone().add(direction));
    }
  });

  if (points.length < 2) return null;

  return (
    <group ref={meshRef}>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <coneGeometry args={[0.15, 0.4, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
});

// ============================================================================
// DMZ Waypoint Component
// ============================================================================

interface DMZWaypointProps {
  position: Vector3;
  isHighlighted: boolean;
}

const DMZWaypoint: React.FC<DMZWaypointProps> = React.memo(({ position, isHighlighted }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meshRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.3]} />
        <meshBasicMaterial
          color={SEGMENT_COLORS.DMZ}
          transparent
          opacity={isHighlighted ? 0.9 : 0.6}
          blending={AdditiveBlending}
        />
      </mesh>
      {isHighlighted && (
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial
            color={SEGMENT_COLORS.DMZ}
            transparent
            opacity={0.2}
            blending={AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
});

// ============================================================================
// Connection Label Component
// ============================================================================

interface ConnectionLabelProps {
  position: Vector3;
  connectionType: ConnectionType;
  edgeType: VoxelEdge['type'];
  visible: boolean;
}

const ConnectionLabel: React.FC<ConnectionLabelProps> = React.memo(
  ({ position, connectionType, edgeType, visible }) => {
    if (!visible) return null;

    return (
      <Billboard position={position}>
        <Html center distanceFactor={15} style={{ pointerEvents: 'none' }}>
          <div
            className="px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap"
            style={{
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
            }}
          >
            <div className="font-semibold">{CONNECTION_LABELS[connectionType]}</div>
            <div className="text-gray-400 text-[10px]">{EDGE_TYPE_LABELS[edgeType]}</div>
          </div>
        </Html>
      </Billboard>
    );
  }
);

// ============================================================================
// Main ITOTEdge Component
// ============================================================================

export const ITOTEdge: React.FC<ITOTEdgeProps> = React.memo(
  ({
    edge,
    sourceNode,
    targetNode,
    dmzNode,
    isHighlighted = false,
    isDimmed = false,
    showLabel = true,
    onClick,
    animated = true,
  }) => {
    const [hovered, setHovered] = useState(false);

    // Get segments
    const sourceSegment = sourceNode.networkSegment || 'IT';
    const targetSegment = targetNode.networkSegment || 'IT';
    const connectionType = getConnectionType(sourceSegment, targetSegment);
    const isCrossSegment = isCrossSegmentConnection(sourceSegment, targetSegment);

    // Build path points
    const points = useMemo(() => {
      const sourcePos = new Vector3(
        sourceNode.position.x,
        sourceNode.position.y,
        sourceNode.position.z
      );
      const targetPos = new Vector3(
        targetNode.position.x,
        targetNode.position.y,
        targetNode.position.z
      );
      const dmzPos = dmzNode
        ? new Vector3(dmzNode.position.x, dmzNode.position.y, dmzNode.position.z)
        : null;

      if (dmzPos && isCrossSegment) {
        return [sourcePos, dmzPos, targetPos];
      }
      return [sourcePos, targetPos];
    }, [sourceNode.position.x, sourceNode.position.y, sourceNode.position.z,
        targetNode.position.x, targetNode.position.y, targetNode.position.z,
        dmzNode, isCrossSegment]);

    // Calculate midpoint for label
    const midpoint = useMemo(() => {
      if (points.length === 3) {
        return points[1]; // DMZ waypoint
      }
      return new Vector3().lerpVectors(points[0], points[points.length - 1], 0.5);
    }, [points]);

    // Colors based on segment
    const startColor = SEGMENT_COLORS[sourceSegment];
    const endColor = SEGMENT_COLORS[targetSegment];

    // Visual properties
    const lineWidth = isHighlighted || hovered ? 3 : 2;
    const opacity = isDimmed ? 0.3 : isHighlighted || hovered ? 0.9 : 0.6;

    // Event handlers
    const handlePointerOver = useCallback((e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      setHovered(true);
      if (typeof document !== 'undefined') {
        document.body.style.cursor = 'pointer';
      }
    }, []);

    const handlePointerOut = useCallback(() => {
      setHovered(false);
      if (typeof document !== 'undefined') {
        document.body.style.cursor = 'auto';
      }
    }, []);

    const handleClick = useCallback(
      (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick?.(edge);
      },
      [onClick, edge]
    );

    return (
      <group
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        {/* Main gradient line */}
        <GradientLine
          points={points}
          startColor={startColor}
          endColor={endColor}
          lineWidth={lineWidth}
          opacity={opacity}
          dashed={isCrossSegment}
          animated={animated && isCrossSegment}
        />

        {/* Flow indicator for cross-segment connections */}
        {animated && isCrossSegment && !isDimmed && (
          <FlowIndicator
            points={points}
            color={isHighlighted ? '#ffffff' : '#fbbf24'}
            speed={0.3}
          />
        )}

        {/* DMZ waypoint */}
        {dmzPos && isCrossSegment && (
          <DMZWaypoint position={dmzPos} isHighlighted={isHighlighted || hovered} />
        )}

        {/* Connection label */}
        {showLabel && (
          <ConnectionLabel
            position={midpoint}
            connectionType={connectionType}
            edgeType={edge.type}
            visible={hovered || isHighlighted}
          />
        )}

        {/* Invisible wider hitbox for easier selection */}
        <Line
          points={points}
          color="transparent"
          lineWidth={10}
          transparent
          opacity={0}
        />
      </group>
    );
  }
);

ITOTEdge.displayName = 'ITOTEdge';

// ============================================================================
// Edge Collection Component
// ============================================================================

export interface ITOTEdgeCollectionProps {
  /** Edges to render */
  edges: VoxelEdge[];
  /** All nodes map */
  nodes: Map<string, VoxelNode>;
  /** Highlighted edge IDs */
  highlightedEdges?: Set<string>;
  /** Dimmed edge IDs */
  dimmedEdges?: Set<string>;
  /** Only show cross-segment edges */
  crossSegmentOnly?: boolean;
  /** Show labels */
  showLabels?: boolean;
  /** Edge click handler */
  onEdgeClick?: (edge: VoxelEdge) => void;
}

export const ITOTEdgeCollection: React.FC<ITOTEdgeCollectionProps> = React.memo(
  ({
    edges,
    nodes,
    highlightedEdges = new Set(),
    dimmedEdges = new Set(),
    crossSegmentOnly = false,
    showLabels = true,
    onEdgeClick,
  }) => {
    // Find DMZ node for waypoint routing
    const dmzNode = useMemo(() => {
      for (const node of nodes.values()) {
        if (node.networkSegment === 'DMZ') {
          return node;
        }
      }
      return null;
    }, [nodes]);

    // Filter and render edges
    const renderedEdges = useMemo(() => {
      return edges.filter((edge) => {
        const sourceNode = nodes.get(edge.source);
        const targetNode = nodes.get(edge.target);
        if (!sourceNode || !targetNode) return false;

        if (crossSegmentOnly) {
          return isCrossSegmentConnection(
            sourceNode.networkSegment,
            targetNode.networkSegment
          );
        }
        return true;
      });
    }, [edges, nodes, crossSegmentOnly]);

    return (
      <group>
        {renderedEdges.map((edge) => {
          const sourceNode = nodes.get(edge.source);
          const targetNode = nodes.get(edge.target);
          if (!sourceNode || !targetNode) return null;

          const isCrossSegment = isCrossSegmentConnection(
            sourceNode.networkSegment,
            targetNode.networkSegment
          );

          return (
            <ITOTEdge
              key={edge.id}
              edge={edge}
              sourceNode={sourceNode}
              targetNode={targetNode}
              dmzNode={isCrossSegment ? dmzNode : null}
              isHighlighted={highlightedEdges.has(edge.id)}
              isDimmed={dimmedEdges.has(edge.id)}
              showLabel={showLabels}
              onClick={onEdgeClick}
            />
          );
        })}
      </group>
    );
  }
);

ITOTEdgeCollection.displayName = 'ITOTEdgeCollection';

export default ITOTEdge;
