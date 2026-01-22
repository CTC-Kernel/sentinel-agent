/**
 * Story 36-3: IT/OT Voxel Mapping - Network Segment Visualization
 *
 * Renders visual zones for IT, OT, and DMZ network segments:
 * - Semi-transparent boundary planes
 * - 3D segment labels
 * - Zone coloring with gradients
 * - Animated boundaries for active segments
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { DoubleSide, AdditiveBlending, Mesh, CanvasTexture, MeshBasicMaterial } from 'three';
import type { NetworkSegment } from '../../types/voxel';
import { SEGMENT_COLORS } from './voxelConstants';
import type { SegmentZone } from './segmentZoneUtils';

// ============================================================================
// Types
// ============================================================================

export interface SegmentZonesProps {
  /** Array of segment zones to render */
  zones: SegmentZone[];
  /** Show zone boundaries */
  showBoundaries?: boolean;
  /** Show zone labels */
  showLabels?: boolean;
  /** Show floor grid */
  showGrid?: boolean;
  /** Boundary opacity */
  boundaryOpacity?: number;
  /** Currently active/selected segment */
  activeSegment?: NetworkSegment | null;
}

// ============================================================================
// Constants
// ============================================================================

const SEGMENT_LABELS: Record<NetworkSegment, string> = {
  IT: 'IT Zone',
  OT: 'OT Zone',
  DMZ: 'DMZ',
};

const SEGMENT_DESCRIPTIONS: Record<NetworkSegment, string> = {
  IT: 'Corporate Network',
  OT: 'Industrial Control',
  DMZ: 'Demilitarized Zone',
};

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Animated boundary plane for segment zones
 */
const ZoneBoundaryPlane: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  color: string;
  opacity: number;
  isActive: boolean;
}> = React.memo(({ position, rotation, size, color, opacity, isActive }) => {
  const meshRef = useRef<Mesh>(null);
  const textureRef = useRef<CanvasTexture | null>(null);

  // Create gradient texture
  const texture = useMemo(() => {
    // Dispose previous texture if exists (memory leak fix)
    if (textureRef.current) {
      textureRef.current.dispose();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, color + '00'); // Transparent at top
      gradient.addColorStop(0.5, color + '40'); // Semi-transparent middle
      gradient.addColorStop(1, color + '00'); // Transparent at bottom
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);

      // Add grid lines
      ctx.strokeStyle = color + '60';
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let i = 0; i <= 256; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 256);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(256, i);
        ctx.stroke();
      }
    }
    const newTexture = new CanvasTexture(canvas);
    textureRef.current = newTexture;
    return newTexture;
  }, [color]);

  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, []);

  // Animate active boundaries
  useFrame((_state, _delta) => {
    if (meshRef.current && isActive) {
      const material = meshRef.current.material as MeshBasicMaterial;
      if (material.opacity !== undefined) {
        material.opacity = opacity + Math.sin(Date.now() * 0.003) * 0.05;
      }
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={DoubleSide}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
});

/**
 * Floor grid for segment zone
 */
const ZoneFloorGrid: React.FC<{
  position: [number, number, number];
  size: [number, number];
  color: string;
  opacity: number;
}> = React.memo(({ position, size, color, opacity }) => {
  const textureRef = useRef<CanvasTexture | null>(null);

  const texture = useMemo(() => {
    // Dispose previous texture if exists (memory leak fix)
    if (textureRef.current) {
      textureRef.current.dispose();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 512, 512);

      // Create gradient fill
      const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      gradient.addColorStop(0, color + '30');
      gradient.addColorStop(0.7, color + '15');
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);

      // Grid lines
      ctx.strokeStyle = color + '40';
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let i = 0; i <= 512; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    }
    const newTexture = new CanvasTexture(canvas);
    textureRef.current = newTexture;
    return newTexture;
  }, [color]);

  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, []);

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
});

/**
 * 3D label for segment zone
 */
const ZoneLabel: React.FC<{
  segment: NetworkSegment;
  position: [number, number, number];
  nodeCount: number;
  isActive: boolean;
}> = React.memo(({ segment, position, nodeCount, isActive }) => {
  const color = SEGMENT_COLORS[segment];
  const label = SEGMENT_LABELS[segment];
  const description = SEGMENT_DESCRIPTIONS[segment];

  return (
    <group position={position}>
      {/* Main label */}
      <Text
        position={[0, 0, 0]}
        fontSize={1.2}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.08}
        outlineColor="#000000"
        font="https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff"
      >
        {label}
      </Text>

      {/* Description */}
      <Text
        position={[0, -1, 0]}
        fontSize={0.5}
        color={isActive ? '#ffffff' : '#9ca3af'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {description}
      </Text>

      {/* Node count */}
      <Text
        position={[0, -1.8, 0]}
        fontSize={0.4}
        color="#6b7280"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {nodeCount} {nodeCount === 1 ? 'asset' : 'assets'}
      </Text>

      {/* Decorative line under label */}
      <mesh position={[0, -0.5, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[3, 0.05]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
    </group>
  );
});

// ============================================================================
// Main SegmentZones Component
// ============================================================================

export const SegmentZones: React.FC<SegmentZonesProps> = React.memo(
  ({
    zones,
    showBoundaries = true,
    showLabels = true,
    showGrid = true,
    boundaryOpacity = 0.15,
    activeSegment = null,
  }) => {
    return (
      <group>
        {zones
          .filter((zone) => zone.visible)
          .map((zone) => {
            const color = SEGMENT_COLORS[zone.segment];
            const isActive = activeSegment === zone.segment;
            const position: [number, number, number] = [
              zone.position.x,
              zone.position.y,
              zone.position.z,
            ];

            return (
              <group key={zone.segment} position={position}>
                {/* Floor grid */}
                {showGrid && (
                  <ZoneFloorGrid
                    position={[0, -zone.size.height / 2, 0]}
                    size={[zone.size.width, zone.size.depth]}
                    color={color}
                    opacity={isActive ? 0.4 : 0.2}
                  />
                )}

                {/* Boundary planes - vertical walls */}
                {showBoundaries && (
                  <>
                    {/* Front boundary */}
                    <ZoneBoundaryPlane
                      position={[0, 0, zone.size.depth / 2]}
                      rotation={[0, 0, 0]}
                      size={[zone.size.width, zone.size.height]}
                      color={color}
                      opacity={isActive ? boundaryOpacity * 1.5 : boundaryOpacity}
                      isActive={isActive}
                    />
                    {/* Back boundary */}
                    <ZoneBoundaryPlane
                      position={[0, 0, -zone.size.depth / 2]}
                      rotation={[0, Math.PI, 0]}
                      size={[zone.size.width, zone.size.height]}
                      color={color}
                      opacity={isActive ? boundaryOpacity * 1.5 : boundaryOpacity}
                      isActive={isActive}
                    />
                    {/* Left boundary */}
                    <ZoneBoundaryPlane
                      position={[-zone.size.width / 2, 0, 0]}
                      rotation={[0, Math.PI / 2, 0]}
                      size={[zone.size.depth, zone.size.height]}
                      color={color}
                      opacity={isActive ? boundaryOpacity * 1.5 : boundaryOpacity}
                      isActive={isActive}
                    />
                    {/* Right boundary */}
                    <ZoneBoundaryPlane
                      position={[zone.size.width / 2, 0, 0]}
                      rotation={[0, -Math.PI / 2, 0]}
                      size={[zone.size.depth, zone.size.height]}
                      color={color}
                      opacity={isActive ? boundaryOpacity * 1.5 : boundaryOpacity}
                      isActive={isActive}
                    />
                  </>
                )}

                {/* Zone label */}
                {showLabels && (
                  <ZoneLabel
                    segment={zone.segment}
                    position={[0, zone.size.height / 2 + 2, 0]}
                    nodeCount={zone.nodeCount}
                    isActive={isActive}
                  />
                )}
              </group>
            );
          })}
      </group>
    );
  }
);

SegmentZones.displayName = 'SegmentZones';

// Re-export utility functions for backward compatibility
/* eslint-disable react-refresh/only-export-components */
export {
  calculateSegmentZones,
  applySegmentLayout,
  type SegmentZone
} from './segmentZoneUtils';
/* eslint-enable react-refresh/only-export-components */

export default SegmentZones;
