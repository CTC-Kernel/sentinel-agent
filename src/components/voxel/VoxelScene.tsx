/**
 * VoxelScene - 3D Scene setup with lighting and controls
 *
 * Configures the Three.js scene with ambient and directional lighting,
 * OrbitControls for navigation, and respects prefers-reduced-motion.
 *
 * @see Story VOX-1.1: R3F Canvas Integration
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Stars } from '@react-three/drei';

/** Check if user prefers reduced motion */
const usePrefersReducedMotion = (): boolean => {
  const [prefersReduced, setPrefersReduced] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
};

export interface VoxelSceneProps {
  /** Enable auto-rotation of the scene */
  autoRotate?: boolean;
  /** Show grid helper */
  showGrid?: boolean;
  /** Show stars background */
  showStars?: boolean;
}

export const VoxelScene: React.FC<VoxelSceneProps> = ({
  autoRotate = false,
  showGrid = true,
  showStars = true,
}) => {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { camera } = useThree();

  // Set initial camera position
  useEffect(() => {
    camera.position.set(0, 200, 400);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // Optional auto-rotation (respects reduced motion)
  useFrame(() => {
    if (autoRotate && !prefersReducedMotion && controlsRef.current) {
      controlsRef.current.autoRotate = true;
      controlsRef.current.autoRotateSpeed = 0.5;
    }
  });

  return (
    <>
      {/* Ambient Light - Soft global illumination */}
      <ambientLight intensity={0.4} color="#ffffff" />

      {/* Directional Light - Main light source with shadows */}
      <directionalLight
        position={[10, 10, 10]}
        intensity={0.6}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      {/* Secondary fill light */}
      <directionalLight
        position={[-5, 5, -5]}
        intensity={0.2}
        color="#8b9dc3"
      />

      {/* Point light for accent */}
      <pointLight
        position={[0, 50, 0]}
        intensity={0.3}
        color="#60a5fa"
        distance={300}
        decay={2}
      />

      {/* OrbitControls - Per Architecture spec */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        maxPolarAngle={Math.PI * 0.9}
        minPolarAngle={Math.PI * 0.1}
        minDistance={50}
        maxDistance={2000}
        enablePan
        panSpeed={0.8}
        enableZoom
        zoomSpeed={1.2}
        makeDefault
      />

      {/* Grid helper for spatial reference */}
      {showGrid && (
        <Grid
          args={[1000, 1000]}
          cellSize={20}
          cellThickness={0.5}
          cellColor="#1e293b"
          sectionSize={100}
          sectionThickness={1}
          sectionColor="#334155"
          fadeDistance={800}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}

      {/* Stars background for Digital Galaxy theme */}
      {showStars && !prefersReducedMotion && (
        <Stars
          radius={500}
          depth={100}
          count={3000}
          factor={4}
          saturation={0}
          fade
          speed={0.5}
        />
      )}

      {/* Placeholder content - will be replaced by actual nodes */}
      <mesh position={[0, 25, 0]} castShadow receiveShadow>
        <boxGeometry args={[50, 50, 50]} />
        <meshStandardMaterial
          color="#3b82f6"
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Ground plane for shadow reception */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.1, 0]}
        receiveShadow
      >
        <planeGeometry args={[2000, 2000]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
    </>
  );
};

export default VoxelScene;
