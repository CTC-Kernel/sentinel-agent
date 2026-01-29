/**
 * Story 32.2 - Level of Detail (LOD) Node Component
 *
 * Uses @react-three/drei LOD component for distance-based detail reduction.
 * - High detail: full geometry + labels at close distance
 * - Medium detail: simplified geometry at medium distance
 * - Low detail: billboard/sprite at far distance
 */

import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Billboard, Text, Detailed } from '@react-three/drei';
import {
  Group,
  CanvasTexture,
  AdditiveBlending,
} from 'three';
import type { VoxelNode, VoxelNodeType } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface LODNodeProps {
  /** The node to render */
  node: VoxelNode;
  /** Callback when node is clicked */
  onClick?: (node: VoxelNode) => void;
  /** Whether the node is selected */
  isSelected?: boolean;
  /** Whether the node is highlighted */
  isHighlighted?: boolean;
  /** Whether the node is dimmed */
  isDimmed?: boolean;
  /** Custom LOD distances */
  distances?: LODDistances;
  /** Show label */
  showLabel?: boolean;
}

export interface LODDistances {
  /** Distance for high detail (full geometry) */
  high: number;
  /** Distance for medium detail (simplified) */
  medium: number;
  /** Distance for low detail (billboard) */
  low: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default LOD distances */
// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_LOD_DISTANCES: LODDistances = {
  high: 15,
  medium: 35,
  low: 60,
};

/** Node type colors */
const NODE_COLORS: Record<VoxelNodeType, string> = {
  asset: 'hsl(var(--primary))',
  risk: 'hsl(var(--error))',
  control: 'hsl(var(--success))',
  incident: 'hsl(var(--destructive))',
  supplier: 'hsl(var(--nav-repository))',
  project: 'hsl(var(--warning))',
  audit: 'hsl(var(--info))',
};

// ============================================================================
// High Detail Geometry Components
// ============================================================================

interface DetailGeometryProps {
  color: string;
  emissiveColor: string;
  opacity: number;
}

const HighDetailAsset: React.FC<DetailGeometryProps> = ({ color, emissiveColor, opacity }) => (
  <group>
    <mesh position={[0, -0.2, 0]}>
      <boxGeometry args={[0.9, 0.25, 0.6]} />
      <meshPhysicalMaterial
        color={color}
        emissive={emissiveColor}
        emissiveIntensity={0.3}
        metalness={0.35}
        roughness={0.25}
        transparent
        opacity={opacity}
      />
    </mesh>
    <mesh position={[0, 0.1, 0]}>
      <boxGeometry args={[0.85, 0.2, 0.55]} />
      <meshPhysicalMaterial
        color={color}
        emissive={emissiveColor}
        emissiveIntensity={0.3}
        metalness={0.35}
        roughness={0.25}
        transparent
        opacity={opacity}
      />
    </mesh>
    {/* Status lights */}
    {[0, 0.25, 0.5].map((offset, i) => (
      <mesh key={i} position={[(offset - 0.25) * 0.8, 0.25, 0.28]}>
        <boxGeometry args={[0.06, 0.04, 0.02]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.9} />
      </mesh>
    ))}
  </group>
);

const HighDetailRisk: React.FC<DetailGeometryProps> = ({ color, emissiveColor, opacity }) => (
  <group>
    <mesh rotation={[0, 0, Math.PI / 4]}>
      <octahedronGeometry args={[0.6]} />
      <meshPhysicalMaterial
        color={color}
        emissive={emissiveColor}
        emissiveIntensity={0.5}
        metalness={0.2}
        roughness={0.35}
        transparent
        opacity={opacity}
      />
    </mesh>
    {/* Warning spikes */}
    {[0, 1, 2, 3].map((i) => {
      const angle = (Math.PI / 2) * i;
      return (
        <mesh
          key={i}
          position={[Math.cos(angle) * 0.55, 0, Math.sin(angle) * 0.55]}
          rotation={[Math.PI / 2, angle, 0]}
        >
          <coneGeometry args={[0.1, 0.3, 4]} />
          <meshPhysicalMaterial
            color="#f97316"
            emissive="#fb923c"
            emissiveIntensity={0.8}
            transparent
            opacity={opacity}
          />
        </mesh>
      );
    })}
  </group>
);

const HighDetailControl: React.FC<DetailGeometryProps> = ({ color, emissiveColor, opacity }) => (
  <group>
    <mesh>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshPhysicalMaterial
        color={color}
        emissive={emissiveColor}
        emissiveIntensity={0.3}
        metalness={0.4}
        roughness={0.2}
        transparent
        opacity={opacity}
      />
    </mesh>
    {/* Shield overlay */}
    <mesh rotation={[0, 0, 0]} position={[0, 0, 0.25]}>
      <ringGeometry args={[0.35, 0.45, 6]} />
      <meshBasicMaterial color={emissiveColor} transparent opacity={0.6} side={2} />
    </mesh>
  </group>
);

const HighDetailProject: React.FC<DetailGeometryProps> = ({ color, emissiveColor, opacity }) => (
  <group>
    <mesh position={[0, -0.1, 0]}>
      <cylinderGeometry args={[0.5, 0.5, 0.6, 32]} />
      <meshPhysicalMaterial
        color={color}
        emissive={emissiveColor}
        emissiveIntensity={0.3}
        metalness={0.3}
        roughness={0.3}
        transparent
        opacity={opacity}
      />
    </mesh>
    {/* Progress ring */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
      <ringGeometry args={[0.35, 0.48, 32, 1, 0, Math.PI * 1.5]} />
      <meshBasicMaterial color="#fcd34d" transparent opacity={0.8} side={2} />
    </mesh>
  </group>
);

const HighDetailDefault: React.FC<DetailGeometryProps> = ({ color, emissiveColor, opacity }) => (
  <mesh>
    <cylinderGeometry args={[0.45, 0.55, 0.7, 8]} />
    <meshPhysicalMaterial
      color={color}
      emissive={emissiveColor}
      emissiveIntensity={0.3}
      metalness={0.35}
      roughness={0.25}
      transparent
      opacity={opacity}
    />
  </mesh>
);

// ============================================================================
// Medium Detail Geometry Components
// ============================================================================

const MediumDetailGeometry: React.FC<{ nodeType: VoxelNodeType; color: string; opacity: number }> = ({
  nodeType,
  color,
  opacity,
}) => {
  const geometry = useMemo(() => {
    switch (nodeType) {
      case 'asset':
        return <boxGeometry args={[0.7, 0.4, 0.5]} />;
      case 'risk':
      case 'incident':
        return <octahedronGeometry args={[0.5]} />;
      case 'control':
        return <sphereGeometry args={[0.4, 12, 12]} />;
      default:
        return <cylinderGeometry args={[0.4, 0.4, 0.5, 6]} />;
    }
  }, [nodeType]);

  return (
    <mesh rotation={nodeType === 'risk' || nodeType === 'incident' ? [0, 0, Math.PI / 4] : [0, 0, 0]}>
      {geometry}
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
};

// ============================================================================
// Low Detail Billboard Component
// ============================================================================

const LowDetailBillboard: React.FC<{ color: string; size: number }> = ({ color, size }) => {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Create radial gradient for soft glow effect
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.5, color + '88');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    return new CanvasTexture(canvas);
  }, [color]);

  // Cleanup texture on unmount or when color changes
  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return (
    <Billboard>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={texture} transparent blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </Billboard>
  );
};

// ============================================================================
// Main LODNode Component
// ============================================================================

export const LODNode: React.FC<LODNodeProps> = React.memo(
  ({
    node,
    onClick,
    isSelected = false,
    isHighlighted = false,
    isDimmed = false,
    distances = DEFAULT_LOD_DISTANCES,
    showLabel = true,
  }) => {
    const groupRef = useRef<Group>(null);
    const [hovered, setHovered] = useState(false);

    // Calculate colors based on state
    const { baseColor, emissiveColor, opacity } = useMemo(() => {
      let base = NODE_COLORS[node.type] || '#ffffff';
      let emissive = base;

      if (isSelected) {
        base = '#fde047';
        emissive = '#fbbf24';
      } else if (hovered) {
        base = '#4ecdc4';
        emissive = '#4ecdc4';
      }

      const op = isDimmed ? 0.4 : isHighlighted ? 0.95 : 0.9;

      return { baseColor: base, emissiveColor: emissive, opacity: op };
    }, [node.type, isSelected, isHighlighted, isDimmed, hovered]);

    // Get label from node data
    const label = useMemo(() => {
      const data = node.data as Record<string, unknown>;
      const rawLabel = (data?.name || data?.title || node.label || 'Node') as string;
      return rawLabel.length > 20 ? `${rawLabel.slice(0, 17)}...` : rawLabel;
    }, [node.data, node.label]);

    // Position array
    const position: [number, number, number] = useMemo(
      () => [
        typeof node.position.x === 'number' ? node.position.x : 0,
        typeof node.position.y === 'number' ? node.position.y : 0,
        typeof node.position.z === 'number' ? node.position.z : 0,
      ],
      [node.position]
    );

    // Handle click
    const handleClick = useCallback(
      (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick?.(node);
      },
      [onClick, node]
    );

    // Handle pointer events
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

    // Subtle animation for selected/hovered state
    useFrame((_, delta) => {
      if (groupRef.current && (isSelected || hovered)) {
        groupRef.current.rotation.y += delta * 0.3;
      }
    });

    // Get high detail component based on node type
    const HighDetailComponent = useMemo(() => {
      const props: DetailGeometryProps = { color: baseColor, emissiveColor, opacity };
      switch (node.type) {
        case 'asset':
          return <HighDetailAsset {...props} />;
        case 'risk':
          return <HighDetailRisk {...props} />;
        case 'control':
          return <HighDetailControl {...props} />;
        case 'project':
          return <HighDetailProject {...props} />;
        default:
          return <HighDetailDefault {...props} />;
      }
    }, [node.type, baseColor, emissiveColor, opacity]);

    return (
      <group position={position}>
        <group
          ref={groupRef}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          scale={isSelected ? 1.3 : hovered || isHighlighted ? 1.15 : 1}
        >
          <Detailed distances={[distances.high, distances.medium, distances.low]}>
            {/* LOD 0: High detail */}
            <group>{HighDetailComponent}</group>

            {/* LOD 1: Medium detail */}
            <MediumDetailGeometry nodeType={node.type} color={baseColor} opacity={opacity} />

            {/* LOD 2: Low detail (billboard) */}
            <LowDetailBillboard color={baseColor} size={1.5} />
          </Detailed>
        </group>

        {/* Selection ring */}
        {(isSelected || isHighlighted || hovered) && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            <ringGeometry args={[0.8, 1.2, 32]} />
            <meshBasicMaterial
              color={baseColor}
              transparent
              opacity={isSelected ? 0.7 : 0.4}
              blending={AdditiveBlending}
            />
          </mesh>
        )}

        {/* Label - only show when close enough and label is enabled */}
        {showLabel && (hovered || isSelected || isHighlighted) && (
          <Text
            position={[0, 1.4, 0]}
            fontSize={0.4}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="black"
          >
            {label}
          </Text>
        )}
      </group>
    );
  }
);

LODNode.displayName = 'LODNode';

// ============================================================================
// Utility Hook for LOD Configuration
// ============================================================================

export interface UseLODConfigOptions {
  /** Base distances to use */
  baseDistances?: LODDistances;
  /** Performance mode: reduces distances for better performance */
  performanceMode?: boolean;
  /** Quality mode: increases distances for better quality */
  qualityMode?: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLODConfig(options: UseLODConfigOptions = {}): LODDistances {
  const { baseDistances = DEFAULT_LOD_DISTANCES, performanceMode = false, qualityMode = false } = options;

  return useMemo(() => {
    let multiplier = 1;
    if (performanceMode) multiplier = 0.6;
    if (qualityMode) multiplier = 1.5;

    return {
      high: baseDistances.high * multiplier,
      medium: baseDistances.medium * multiplier,
      low: baseDistances.low * multiplier,
    };
  }, [baseDistances, performanceMode, qualityMode]);
}

export default LODNode;
