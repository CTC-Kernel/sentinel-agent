/**
 * useZoomSemantic - Hook for semantic zoom level management
 *
 * Provides zoom level detection and smooth transitions between
 * macro, medium, and micro views based on camera distance.
 *
 * Zoom Levels:
 * - Macro (>1000u): Clusters visible, no labels
 * - Medium (200-1000u): Individual nodes, short labels
 * - Micro (<200u): Full details, all labels
 *
 * @see Story VOX-9.1: Zoom Sémantique
 * @see FR45: Users can experience smooth zoom transition between macro and micro views
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

// ============================================================================
// Types
// ============================================================================

export type ZoomLevel = 'macro' | 'medium' | 'micro';

export interface ZoomSemanticConfig {
  /** Distance threshold for micro view (default: 200) */
  microThreshold?: number;
  /** Distance threshold for medium view (default: 1000) */
  mediumThreshold?: number;
  /** Transition smoothing factor (0-1, higher = faster) */
  transitionSpeed?: number;
  /** Enable smooth opacity transitions */
  smoothTransitions?: boolean;
}

export interface ZoomSemanticState {
  /** Current zoom level */
  level: ZoomLevel;
  /** Current camera distance to origin/target */
  distance: number;
  /** Normalized progress within current level (0-1) */
  levelProgress: number;
  /** Label opacity based on zoom level and transition */
  labelOpacity: number;
  /** Node detail level (0-2, where 2 is highest) */
  detailLevel: number;
  /** Whether currently transitioning between levels */
  isTransitioning: boolean;
}

export interface UseZoomSemanticReturn extends ZoomSemanticState {
  /** Get label opacity for a specific distance */
  getLabelOpacity: (distance: number) => number;
  /** Get detail level for a specific distance */
  getDetailLevel: (distance: number) => number;
  /** Check if labels should be visible at distance */
  shouldShowLabels: (distance: number) => boolean;
  /** Get zoom level for a specific distance */
  getZoomLevel: (distance: number) => ZoomLevel;
  /** Configuration thresholds */
  thresholds: {
    micro: number;
    medium: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<ZoomSemanticConfig> = {
  microThreshold: 200,
  mediumThreshold: 1000,
  transitionSpeed: 0.1,
  smoothTransitions: true,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing semantic zoom levels with smooth transitions.
 *
 * @example
 * ```tsx
 * const { level, labelOpacity, detailLevel } = useZoomSemantic();
 *
 * // Use in node rendering
 * <mesh>
 *   {detailLevel >= 2 && <HighDetailGeometry />}
 *   {detailLevel === 1 && <MediumDetailGeometry />}
 *   {detailLevel === 0 && <LowDetailGeometry />}
 * </mesh>
 * {labelOpacity > 0 && (
 *   <Label opacity={labelOpacity} />
 * )}
 * ```
 */
export function useZoomSemantic(
  config: ZoomSemanticConfig = {},
  targetPosition?: Vector3 | [number, number, number]
): UseZoomSemanticReturn {
  const { camera } = useThree();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { microThreshold, mediumThreshold, transitionSpeed, smoothTransitions } = mergedConfig;

  // State
  const [distance, setDistance] = useState<number>(500);
  const [smoothLabelOpacity, setSmoothLabelOpacity] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const prevLevelRef = useRef<ZoomLevel>('medium');

  // Target position as Vector3
  const target = useMemo(() => {
    if (!targetPosition) return new Vector3(0, 0, 0);
    if (targetPosition instanceof Vector3) return targetPosition;
    return new Vector3(...targetPosition);
  }, [targetPosition]);

  // Calculate zoom level from distance
  const getZoomLevel = useCallback(
    (dist: number): ZoomLevel => {
      if (dist < microThreshold) return 'micro';
      if (dist < mediumThreshold) return 'medium';
      return 'macro';
    },
    [microThreshold, mediumThreshold]
  );

  // Calculate detail level (0-2)
  const getDetailLevel = useCallback(
    (dist: number): number => {
      if (dist < microThreshold) return 2; // High detail
      if (dist < mediumThreshold) return 1; // Medium detail
      return 0; // Low detail
    },
    [microThreshold, mediumThreshold]
  );

  // Calculate label opacity with smooth falloff
  const getLabelOpacity = useCallback(
    (dist: number): number => {
      // Labels fully visible at micro level
      if (dist < microThreshold * 0.5) return 1;

      // Fade out from micro to medium transition zone
      if (dist < microThreshold) {
        const t = (dist - microThreshold * 0.5) / (microThreshold * 0.5);
        return 1 - t * 0.3; // Fade to 0.7
      }

      // Medium level: reduced opacity
      if (dist < mediumThreshold * 0.5) {
        return 0.7;
      }

      // Fade out in upper medium range
      if (dist < mediumThreshold) {
        const t = (dist - mediumThreshold * 0.5) / (mediumThreshold * 0.5);
        return 0.7 - t * 0.7; // Fade to 0
      }

      // Macro level: no labels
      return 0;
    },
    [microThreshold, mediumThreshold]
  );

  // Check if labels should be shown
  const shouldShowLabels = useCallback(
    (dist: number): boolean => {
      return dist < mediumThreshold;
    },
    [mediumThreshold]
  );

  // Current level
  const level = useMemo(() => getZoomLevel(distance), [distance, getZoomLevel]);

  // Level progress (0-1 within current level)
  const levelProgress = useMemo(() => {
    if (level === 'micro') {
      return Math.min(1, distance / microThreshold);
    }
    if (level === 'medium') {
      return (distance - microThreshold) / (mediumThreshold - microThreshold);
    }
    // Macro: use log scale for very large distances
    const macroDistance = distance - mediumThreshold;
    return Math.min(1, macroDistance / mediumThreshold);
  }, [distance, level, microThreshold, mediumThreshold]);

  // Detail level
  const detailLevel = useMemo(() => getDetailLevel(distance), [distance, getDetailLevel]);

  // Target label opacity
  const targetLabelOpacity = useMemo(() => getLabelOpacity(distance), [distance, getLabelOpacity]);

  // Update distance and smooth values each frame
  useFrame(() => {
    const newDistance = camera.position.distanceTo(target);
    setDistance(newDistance);

    // Check for level transition
    const newLevel = getZoomLevel(newDistance);
    if (newLevel !== prevLevelRef.current) {
      setIsTransitioning(true);
      prevLevelRef.current = newLevel;
      // Clear transition flag after a short delay
      setTimeout(() => setIsTransitioning(false), 300);
    }

    // Smooth label opacity transition
    if (smoothTransitions) {
      setSmoothLabelOpacity((prev) => {
        const diff = targetLabelOpacity - prev;
        if (Math.abs(diff) < 0.01) return targetLabelOpacity;
        return prev + diff * transitionSpeed;
      });
    } else {
      setSmoothLabelOpacity(targetLabelOpacity);
    }
  });

  // Thresholds object
  const thresholds = useMemo(
    () => ({
      micro: microThreshold,
      medium: mediumThreshold,
    }),
    [microThreshold, mediumThreshold]
  );

  return {
    level,
    distance,
    levelProgress,
    labelOpacity: smoothLabelOpacity,
    detailLevel,
    isTransitioning,
    getLabelOpacity,
    getDetailLevel,
    shouldShowLabels,
    getZoomLevel,
    thresholds,
  };
}

/**
 * Get zoom semantic values for a specific distance (non-hook version)
 *
 * Useful for calculating values outside of React components.
 */
export function getZoomSemanticValues(
  distance: number,
  config: ZoomSemanticConfig = {}
): Omit<ZoomSemanticState, 'isTransitioning'> {
  const { microThreshold = 200, mediumThreshold = 1000 } = config;

  // Zoom level
  let level: ZoomLevel;
  if (distance < microThreshold) level = 'micro';
  else if (distance < mediumThreshold) level = 'medium';
  else level = 'macro';

  // Detail level
  let detailLevel: number;
  if (distance < microThreshold) detailLevel = 2;
  else if (distance < mediumThreshold) detailLevel = 1;
  else detailLevel = 0;

  // Level progress
  let levelProgress: number;
  if (level === 'micro') {
    levelProgress = Math.min(1, distance / microThreshold);
  } else if (level === 'medium') {
    levelProgress = (distance - microThreshold) / (mediumThreshold - microThreshold);
  } else {
    const macroDistance = distance - mediumThreshold;
    levelProgress = Math.min(1, macroDistance / mediumThreshold);
  }

  // Label opacity
  let labelOpacity: number;
  if (distance < microThreshold * 0.5) {
    labelOpacity = 1;
  } else if (distance < microThreshold) {
    const t = (distance - microThreshold * 0.5) / (microThreshold * 0.5);
    labelOpacity = 1 - t * 0.3;
  } else if (distance < mediumThreshold * 0.5) {
    labelOpacity = 0.7;
  } else if (distance < mediumThreshold) {
    const t = (distance - mediumThreshold * 0.5) / (mediumThreshold * 0.5);
    labelOpacity = 0.7 - t * 0.7;
  } else {
    labelOpacity = 0;
  }

  return {
    level,
    distance,
    levelProgress,
    labelOpacity,
    detailLevel,
  };
}

export default useZoomSemantic;
