/**
 * Story 36-3: IT/OT Voxel Mapping - OT Node Visual Component
 *
 * Renders OT assets with distinct visual style:
 * - Cube geometry (vs sphere/server for IT)
 * - Orange/amber color scheme
 * - Criticality-based size scaling
 * - Industrial icon overlay
 * - Pulsing glow effect for critical assets
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import { Group, AdditiveBlending, CanvasTexture } from 'three';
import { animated, useSpring, config } from '@react-spring/three';
import type { VoxelNode, OTNodeDetails } from '../../types/voxel';
import { GlassMaterial, EdgesWithColor } from './VoxelMaterials';
import {
  SEGMENT_COLORS,
  CRITICALITY_SIZES,
  CRITICALITY_GLOW
} from './voxelConstants';

// Re-export for backward compatibility
export { SEGMENT_COLORS, CRITICALITY_SIZES, CRITICALITY_GLOW } from './voxelConstants';

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Industrial gear icon texture for OT nodes
 */
const IndustrialIconSprite: React.FC<{ color: string; size: number }> = React.memo(
  ({ color, size }) => {
    const texture = useMemo(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 64, 64);

        // Draw gear icon
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();

        // Outer gear teeth
        const centerX = 32;
        const centerY = 32;
        const outerRadius = 24;
        const innerRadius = 16;
        const teeth = 8;

        for (let i = 0; i < teeth; i++) {
          const angle1 = (i * 2 * Math.PI) / teeth;
          const angle2 = ((i + 0.3) * 2 * Math.PI) / teeth;
          const angle3 = ((i + 0.5) * 2 * Math.PI) / teeth;
          const angle4 = ((i + 0.8) * 2 * Math.PI) / teeth;

          if (i === 0) {
            ctx.moveTo(
              centerX + outerRadius * Math.cos(angle1),
              centerY + outerRadius * Math.sin(angle1)
            );
          }
          ctx.lineTo(
            centerX + outerRadius * Math.cos(angle2),
            centerY + outerRadius * Math.sin(angle2)
          );
          ctx.lineTo(
            centerX + innerRadius * Math.cos(angle3),
            centerY + innerRadius * Math.sin(angle3)
          );
          ctx.lineTo(
            centerX + innerRadius * Math.cos(angle4),
            centerY + innerRadius * Math.sin(angle4)
          );
          ctx.lineTo(
            centerX + outerRadius * Math.cos(((i + 1) * 2 * Math.PI) / teeth),
            centerY + outerRadius * Math.sin(((i + 1) * 2 * Math.PI) / teeth)
          );
        }
        ctx.closePath();
        ctx.stroke();

        // Center hole
        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
        ctx.stroke();
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
      <Billboard position={[0, 0.8, 0]}>
        <mesh>
          <planeGeometry args={[size * 0.6, size * 0.6]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    );
  }
);

/**
 * Pulsing glow effect for critical OT assets
 */
const CriticalGlow: React.FC<{
  color: string;
  size: number;
  intensity: number;
}> = React.memo(({ color, size, intensity }) => {
  const meshRef = useRef<Group>(null);
  const [pulse, setPulse] = useState(0);

  useFrame((_, delta) => {
    setPulse((prev) => (prev + delta * 2) % (Math.PI * 2));
  });

  const opacity = 0.3 + Math.sin(pulse) * 0.2 * intensity;
  const scale = 1 + Math.sin(pulse) * 0.1;

  return (
    <group ref={meshRef} scale={[scale, scale, scale]}>
      <mesh>
        <boxGeometry args={[size * 1.3, size * 1.3, size * 1.3]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

// ============================================================================
// OT Cube Geometry
// ============================================================================

interface OTCubeGeometryProps {
  size: number;
  color: string;
  emissiveColor: string;
  emissiveIntensity: number;
  opacity: number;
  xRayMode?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
}

const OTCubeGeometry: React.FC<OTCubeGeometryProps> = React.memo(
  ({
    size,
    color,
    emissiveColor,
    emissiveIntensity,
    opacity,
    xRayMode,
    isDimmed,
    isHighlighted,
  }) => {
    // Main cube body
    return (
      <group>
        {/* Main cube */}
        <mesh>
          <boxGeometry args={[size, size, size]} />
          <GlassMaterial
            color={color}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            opacity={opacity}
            transparent
            wireframe={xRayMode}
            isDimmed={isDimmed}
            isHighlighted={isHighlighted}
            metalness={0.4}
            roughness={0.2}
          />
          <EdgesWithColor color={emissiveColor} />
        </mesh>

        {/* Industrial accent lines */}
        <mesh position={[0, size * 0.35, size * 0.51]}>
          <boxGeometry args={[size * 0.7, size * 0.08, 0.02]} />
          <meshBasicMaterial color={emissiveColor} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, -size * 0.35, size * 0.51]}>
          <boxGeometry args={[size * 0.7, size * 0.08, 0.02]} />
          <meshBasicMaterial color={emissiveColor} transparent opacity={0.9} />
        </mesh>

        {/* Status indicator */}
        <mesh position={[size * 0.35, size * 0.35, size * 0.51]}>
          <boxGeometry args={[size * 0.12, size * 0.12, 0.02]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.9} />
        </mesh>
      </group>
    );
  }
);

// ============================================================================
// DMZ Octahedron Geometry
// ============================================================================

interface DMZOctahedronGeometryProps {
  size: number;
  color: string;
  emissiveColor: string;
  emissiveIntensity: number;
  opacity: number;
  xRayMode?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
}

const DMZOctahedronGeometry: React.FC<DMZOctahedronGeometryProps> = React.memo(
  ({
    size,
    color,
    emissiveColor,
    emissiveIntensity,
    opacity,
    xRayMode,
    isDimmed,
    isHighlighted,
  }) => {
    return (
      <group rotation={[0, Math.PI / 4, 0]}>
        <mesh>
          <octahedronGeometry args={[size * 0.7]} />
          <GlassMaterial
            color={color}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            opacity={opacity}
            transparent
            wireframe={xRayMode}
            isDimmed={isDimmed}
            isHighlighted={isHighlighted}
            metalness={0.3}
            roughness={0.25}
          />
          <EdgesWithColor color={emissiveColor} />
        </mesh>

        {/* Shield icon ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <ringGeometry args={[size * 0.5, size * 0.6, 6]} />
          <meshBasicMaterial
            color={emissiveColor}
            transparent
            opacity={0.6}
            side={2}
          />
        </mesh>
      </group>
    );
  }
);

// ============================================================================
// Main OTNodeMesh Component
// ============================================================================

export interface OTNodeMeshProps {
  /** The voxel node to render */
  node: VoxelNode;
  /** Click handler */
  onClick?: (node: VoxelNode) => void;
  /** Whether node is selected */
  isSelected?: boolean;
  /** Whether node is dimmed */
  isDimmed?: boolean;
  /** Whether node is highlighted */
  isHighlighted?: boolean;
  /** X-ray wireframe mode */
  xRayMode?: boolean;
  /** Override opacity */
  opacity?: number;
  /** Show segment icon overlay */
  showSegmentIcon?: boolean;
}

export const OTNodeMesh: React.FC<OTNodeMeshProps> = React.memo(
  ({
    node,
    onClick,
    isSelected = false,
    isDimmed = false,
    isHighlighted = false,
    xRayMode = false,
    opacity,
    showSegmentIcon = true,
  }) => {
    const meshRef = useRef<Group>(null);
    const [hovered, setHovered] = useState(false);

    // Extract OT-specific properties
    const networkSegment = node.networkSegment || 'IT';
    const otDetails = node.otDetails as OTNodeDetails | undefined;
    const criticality = otDetails?.criticality || 'operations';

    // Calculate size based on criticality
    const criticalityMultiplier = CRITICALITY_SIZES[criticality];
    const baseSize = node.size > 0 ? node.size : 1;
    const adjustedSize = baseSize * criticalityMultiplier;

    // Calculate colors
    const segmentColor = SEGMENT_COLORS[networkSegment];
    const baseColor = isSelected ? '#fde047' : hovered ? '#4ecdc4' : segmentColor;
    const emissiveColor = isSelected ? '#fbbf24' : hovered ? '#4ecdc4' : segmentColor;

    // Calculate emissive intensity based on criticality
    const baseEmissive = CRITICALITY_GLOW[criticality];
    const emissiveIntensity = isDimmed ? 0 : isHighlighted ? baseEmissive * 1.5 : baseEmissive;

    // Calculate opacity
    const calculatedOpacity = opacity !== undefined ? opacity : isDimmed ? 0.4 : 0.9;

    // Animation
    const targetScale = isSelected ? 1.3 : hovered || isHighlighted ? 1.15 : 1;
    const { scale } = useSpring({
      scale: targetScale,
      config: config.wobbly,
    });

    // Rotate non-critical nodes
    useFrame(() => {
      if (meshRef.current && !isSelected && criticality !== 'safety') {
        meshRef.current.rotation.y += 0.003;
      }
    });

    // Event handlers
    const handleClick = useCallback(
      (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick?.(node);
      },
      [onClick, node]
    );

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

    // Get label
    const label = useMemo(() => {
      const data = node.data as Record<string, unknown>;
      const rawLabel = (data?.name || data?.title || node.label || 'OT Asset') as string;
      return rawLabel.length > 24 ? `${rawLabel.slice(0, 21)}...` : rawLabel;
    }, [node.data, node.label]);

    // Position array
    const position: [number, number, number] = [
      node.position.x,
      node.position.y,
      node.position.z,
    ];

    // Determine if critical (safety-critical OT asset)
    const isCritical = criticality === 'safety';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnimatedGroup = (animated as any).group;

    return (
      <group position={position}>
        {/* Critical glow effect */}
        {isCritical && !isDimmed && (
          <CriticalGlow
            color={segmentColor}
            size={adjustedSize}
            intensity={1.5}
          />
        )}

        <AnimatedGroup
          ref={meshRef}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          scale={scale}
        >
          {/* Render geometry based on segment */}
          {networkSegment === 'DMZ' ? (
            <DMZOctahedronGeometry
              size={adjustedSize}
              color={baseColor}
              emissiveColor={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              opacity={calculatedOpacity}
              xRayMode={xRayMode}
              isDimmed={isDimmed}
              isHighlighted={isHighlighted}
            />
          ) : networkSegment === 'OT' ? (
            <OTCubeGeometry
              size={adjustedSize}
              color={baseColor}
              emissiveColor={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              opacity={calculatedOpacity}
              xRayMode={xRayMode}
              isDimmed={isDimmed}
              isHighlighted={isHighlighted}
            />
          ) : (
            // IT nodes use default sphere-like geometry (server stack)
            <mesh>
              <boxGeometry args={[adjustedSize * 0.9, adjustedSize * 0.5, adjustedSize * 0.6]} />
              <GlassMaterial
                color={baseColor}
                emissive={emissiveColor}
                emissiveIntensity={emissiveIntensity}
                opacity={calculatedOpacity}
                transparent
                wireframe={xRayMode}
                isDimmed={isDimmed}
                isHighlighted={isHighlighted}
              />
              <EdgesWithColor color={emissiveColor} />
            </mesh>
          )}
        </AnimatedGroup>

        {/* Industrial icon for OT nodes */}
        {showSegmentIcon && networkSegment === 'OT' && !isDimmed && (
          <IndustrialIconSprite color={emissiveColor} size={adjustedSize} />
        )}

        {/* Selection ring */}
        {(hovered || isSelected || isHighlighted) && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -adjustedSize / 2, 0]}>
            <ringGeometry args={[adjustedSize * 0.8, adjustedSize * 1.4, 32]} />
            <meshBasicMaterial
              color={segmentColor}
              transparent
              opacity={isSelected ? 0.8 : 0.4}
              blending={AdditiveBlending}
            />
          </mesh>
        )}

        {/* Label */}
        {(hovered || isSelected || isHighlighted) && (
          <Text
            position={[0, adjustedSize + 1.2, 0]}
            fontSize={0.45}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.06}
            outlineColor="black"
            maxWidth={3}
            lineHeight={1.1}
          >
            {label}
          </Text>
        )}

        {/* Criticality badge */}
        {(hovered || isSelected) && criticality && (
          <Text
            position={[0, adjustedSize + 0.6, 0]}
            fontSize={0.28}
            color={isCritical ? '#ef4444' : '#9ca3af'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="black"
          >
            {criticality.toUpperCase()}
          </Text>
        )}
      </group>
    );
  },
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.isDimmed === next.isDimmed &&
      prev.isHighlighted === next.isHighlighted &&
      prev.xRayMode === next.xRayMode &&
      prev.node.id === next.node.id &&
      prev.node.position.x === next.node.position.x &&
      prev.node.position.y === next.node.position.y &&
      prev.node.position.z === next.node.position.z &&
      prev.node.networkSegment === next.node.networkSegment &&
      prev.node.otDetails?.criticality === next.node.otDetails?.criticality
    );
  }
);

OTNodeMesh.displayName = 'OTNodeMesh';

export default OTNodeMesh;
