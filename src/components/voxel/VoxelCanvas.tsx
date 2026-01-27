/**
 * VoxelCanvas - React Three Fiber Canvas wrapper for 3D visualization
 *
 * Provides the core R3F Canvas with optimized WebGL settings,
 * proper shadows, and performance-tuned configuration.
 *
 * @see Story VOX-1.1: R3F Canvas Integration
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { VoxelScene } from './VoxelScene';
import { ErrorLogger } from '@/services/errorLogger';

/** Background color per Digital Galaxy theme */
const CANVAS_BACKGROUND = '#0F172A';

/** Canvas WebGL configuration for optimal performance */
const GL_CONFIG = {
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance' as const,
  stencil: false,
  depth: true,
};

export interface VoxelCanvasProps {
  /** Optional className for the canvas container */
  className?: string;
  /** Called when canvas encounters an error */
  onError?: (error: Error) => void;
  /** Called when canvas is ready */
  onCreated?: () => void;
}

export const VoxelCanvas: React.FC<VoxelCanvasProps> = ({
  className = '',
  onError,
  onCreated,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle canvas creation callback
  const handleCreated = () => {
    onCreated?.();
  };

  // Apply container styles
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.background = CANVAS_BACKGROUND;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{
        height: 'calc(100vh - 48px)',
        background: CANVAS_BACKGROUND,
        touchAction: 'none', // Prevents scroll conflicts with OrbitControls
      }}
      data-testid="voxel-canvas-container"
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={GL_CONFIG}
        camera={{
          position: [0, 200, 400],
          fov: 60,
          near: 0.1,
          far: 5000,
        }}
        onCreated={handleCreated}
        onError={(error) => {
          ErrorLogger.error(error, 'VoxelCanvas');
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }}
        style={{
          width: '100%',
          height: '100%',
          touchAction: 'none', // Required for OrbitControls wheel/touch handling
        }}
      >
        <VoxelScene />
      </Canvas>
    </div>
  );
};

export default VoxelCanvas;
