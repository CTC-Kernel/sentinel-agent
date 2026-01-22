/**
 * useCameraAnimation - Hook for animated camera transitions
 *
 * Provides methods for animating the camera to specific positions,
 * focusing on nodes, and resetting to the initial view.
 *
 * @see Story VOX-4.7: Reset View
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, PerspectiveCamera } from 'three';
import type { VoxelNode } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface CameraAnimationConfig {
  /** Animation duration in milliseconds */
  duration?: number;
  /** Easing function */
  easing?: (t: number) => number;
}

export interface UseCameraAnimationReturn {
  /** Animate camera to a specific position */
  animateTo: (position: Vector3, target?: Vector3, config?: CameraAnimationConfig) => void;
  /** Focus camera on a specific node */
  focusOnNode: (node: VoxelNode, distance?: number, config?: CameraAnimationConfig) => void;
  /** Reset camera to initial position */
  resetView: (config?: CameraAnimationConfig) => void;
  /** Fit all nodes in view */
  fitAll: (nodes: VoxelNode[], padding?: number, config?: CameraAnimationConfig) => void;
  /** Whether camera is currently animating */
  isAnimating: boolean;
  /** Stop any ongoing animation */
  stopAnimation: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Default animation duration */
const DEFAULT_DURATION = 500;

/** Initial camera position */
const INITIAL_POSITION = new Vector3(0, 200, 400);

/** Initial camera target */
const INITIAL_TARGET = new Vector3(0, 0, 0);

/** Default focus distance from node */
const DEFAULT_FOCUS_DISTANCE = 100;

// ============================================================================
// Easing Functions
// ============================================================================

/** Ease out cubic for smooth deceleration */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing camera animations in the 3D scene.
 *
 * @example
 * ```tsx
 * const { resetView, focusOnNode, isAnimating } = useCameraAnimation();
 *
 * // Reset to initial view
 * <button onClick={resetView}>Home</button>
 *
 * // Focus on selected node
 * useEffect(() => {
 *   if (selectedNode) {
 *     focusOnNode(selectedNode);
 *   }
 * }, [selectedNode]);
 * ```
 */
export function useCameraAnimation(): UseCameraAnimationReturn {
  const { camera, controls } = useThree();
  const [isAnimating, setIsAnimating] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );

  // Animation state refs
  const animationRef = useRef<{
    startTime: number;
    duration: number;
    startPosition: Vector3;
    endPosition: Vector3;
    startTarget: Vector3;
    endTarget: Vector3;
    easing: (t: number) => number;
  } | null>(null);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Animation frame update
  useFrame(() => {
    if (!animationRef.current || !isAnimating) return;

    const { startTime, duration, startPosition, endPosition, startTarget, endTarget, easing } =
      animationRef.current;

    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easing(progress);

    // Interpolate camera position
    camera.position.lerpVectors(startPosition, endPosition, easedProgress);

    // Interpolate camera target (for OrbitControls)
    if (controls && 'target' in controls) {
      const orbitTarget = controls.target as Vector3;
      orbitTarget.lerpVectors(startTarget, endTarget, easedProgress);
    }

    // Look at target
    const currentTarget = new Vector3().lerpVectors(startTarget, endTarget, easedProgress);
    camera.lookAt(currentTarget);

    // Update controls
    if (controls && 'update' in controls) {
      (controls.update as () => void)();
    }

    // Check if animation is complete
    if (progress >= 1) {
      animationRef.current = null;
      setIsAnimating(false);
    }
  });

  /**
   * Animate camera to a specific position
   */
  const animateTo = useCallback(
    (position: Vector3, target: Vector3 = INITIAL_TARGET, config: CameraAnimationConfig = {}) => {
      const duration = prefersReducedMotion ? 0 : (config.duration ?? DEFAULT_DURATION);
      const easing = config.easing ?? easeOutCubic;

      // If reduced motion or instant, just set position
      if (duration === 0) {
        camera.position.copy(position);
        camera.lookAt(target);
        if (controls && 'target' in controls) {
          (controls.target as Vector3).copy(target);
        }
        if (controls && 'update' in controls) {
          (controls.update as () => void)();
        }
        return;
      }

      // Get current target
      const currentTarget =
        controls && 'target' in controls
          ? (controls.target as Vector3).clone()
          : new Vector3(0, 0, 0);

      animationRef.current = {
        startTime: performance.now(),
        duration,
        startPosition: camera.position.clone(),
        endPosition: position.clone(),
        startTarget: currentTarget,
        endTarget: target.clone(),
        easing,
      };

      setIsAnimating(true);
    },
    [camera, controls, prefersReducedMotion]
  );

  /**
   * Focus camera on a specific node
   */
  const focusOnNode = useCallback(
    (node: VoxelNode, distance: number = DEFAULT_FOCUS_DISTANCE, config?: CameraAnimationConfig) => {
      const nodePosition = new Vector3(node.position.x, node.position.y, node.position.z);

      // Calculate camera position at distance from node
      const direction = camera.position.clone().sub(nodePosition).normalize();
      const cameraPosition = nodePosition.clone().add(direction.multiplyScalar(distance));

      animateTo(cameraPosition, nodePosition, config);
    },
    [camera, animateTo]
  );

  /**
   * Reset camera to initial position
   */
  const resetView = useCallback(
    (config?: CameraAnimationConfig) => {
      animateTo(INITIAL_POSITION.clone(), INITIAL_TARGET.clone(), config);
    },
    [animateTo]
  );

  /**
   * Fit all nodes in view
   */
  const fitAll = useCallback(
    (nodes: VoxelNode[], padding: number = 1.2, config?: CameraAnimationConfig) => {
      if (nodes.length === 0) {
        resetView(config);
        return;
      }

      // Calculate bounding box
      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;

      for (const node of nodes) {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        minZ = Math.min(minZ, node.position.z);
        maxX = Math.max(maxX, node.position.x);
        maxY = Math.max(maxY, node.position.y);
        maxZ = Math.max(maxZ, node.position.z);
      }

      // Calculate center
      const center = new Vector3(
        (minX + maxX) / 2,
        (minY + maxY) / 2,
        (minZ + maxZ) / 2
      );

      // Calculate required distance
      const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) * padding;
      const fov = (camera as PerspectiveCamera).fov ?? 60;
      const fovRad = fov * (Math.PI / 180);
      const distance = size / (2 * Math.tan(fovRad / 2));

      // Position camera above and behind center
      const cameraPosition = new Vector3(
        center.x,
        center.y + distance * 0.5,
        center.z + distance
      );

      animateTo(cameraPosition, center, config);
    },
    [camera, animateTo, resetView]
  );

  /**
   * Stop any ongoing animation
   */
  const stopAnimation = useCallback(() => {
    animationRef.current = null;
    setIsAnimating(false);
  }, []);

  return {
    animateTo,
    focusOnNode,
    resetView,
    fitAll,
    isAnimating,
    stopAnimation,
  };
}

export default useCameraAnimation;
