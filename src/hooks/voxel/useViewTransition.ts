/**
 * Story 31.3 - View Transition Animations
 *
 * Hook for animating transitions between Voxel view presets.
 * Handles camera position, node visibility, and filter transitions.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useSpring, config as springConfig, SpringValue } from '@react-spring/three';
import type { VoxelNodeType, VoxelUIState, ViewPreset } from '@/types/voxel';
import { useVoxelStore } from '@/stores/voxelStore';
import { VIEW_PRESETS, type ExtendedViewPresetConfig } from '@/stores/viewPresets';

// ============================================================================
// Types
// ============================================================================

export interface ViewTransitionConfig {
  /** Duration of the transition in milliseconds */
  duration?: number;
  /** Spring tension (higher = faster) */
  tension?: number;
  /** Spring friction (higher = less bouncy) */
  friction?: number;
  /** Easing function name */
  easing?: 'default' | 'gentle' | 'wobbly' | 'stiff' | 'slow' | 'molasses';
  /** Callback when transition starts */
  onStart?: () => void;
  /** Callback when transition completes */
  onComplete?: () => void;
}

export interface CameraState {
  positionX: SpringValue<number>;
  positionY: SpringValue<number>;
  positionZ: SpringValue<number>;
  targetX: SpringValue<number>;
  targetY: SpringValue<number>;
  targetZ: SpringValue<number>;
}

export interface ViewTransitionState {
  /** Whether a transition is currently in progress */
  isTransitioning: boolean;
  /** The preset being transitioned to */
  targetPreset: ViewPreset | null;
  /** Progress of the transition (0-1) */
  progress: number;
}

export interface UseViewTransitionReturn {
  /** Current camera animation values */
  cameraSpring: CameraState;
  /** Visibility animation for node types (0 = hidden, 1 = visible) */
  nodeVisibility: Map<VoxelNodeType, SpringValue<number>>;
  /** Current transition state */
  transitionState: ViewTransitionState;
  /** Trigger a transition to a new preset */
  transitionTo: (preset: ViewPreset, config?: ViewTransitionConfig) => void;
  /** Trigger a transition to custom config */
  transitionToConfig: (config: ExtendedViewPresetConfig, options?: ViewTransitionConfig) => void;
  /** Cancel the current transition */
  cancelTransition: () => void;
  /** Check if a specific node type is currently visible */
  isNodeTypeVisible: (type: VoxelNodeType) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ALL_NODE_TYPES: VoxelNodeType[] = ['asset', 'risk', 'control', 'incident', 'supplier', 'project', 'audit'];

const DEFAULT_CONFIG: Required<ViewTransitionConfig> = {
  duration: 800,
  tension: 120,
  friction: 14,
  easing: 'default',
  onStart: () => {},
  onComplete: () => {},
};

const SPRING_CONFIGS = {
  default: springConfig.default,
  gentle: springConfig.gentle,
  wobbly: springConfig.wobbly,
  stiff: springConfig.stiff,
  slow: springConfig.slow,
  molasses: springConfig.molasses,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useViewTransition(initialConfig?: ViewTransitionConfig): UseViewTransitionReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...initialConfig };

  // Store state
  const ui = useVoxelStore((s) => s.ui);
  const filters = useVoxelStore((s) => s.filters);
  const setCameraPosition = useVoxelStore((s) => s.setCameraPosition);
  const setCameraTarget = useVoxelStore((s) => s.setCameraTarget);
  const setLayoutType = useVoxelStore((s) => s.setLayoutType);
  const setNodeTypeFilter = useVoxelStore((s) => s.setNodeTypeFilter);

  // Local state
  const [transitionState, setTransitionState] = useState<ViewTransitionState>({
    isTransitioning: false,
    targetPreset: null,
    progress: 0,
  });

  const cancelRef = useRef(false);
  const transitionIdRef = useRef(0);

  // Camera spring animation
  const [cameraSpring, cameraApi] = useSpring(() => ({
    positionX: ui.cameraPosition.x,
    positionY: ui.cameraPosition.y,
    positionZ: ui.cameraPosition.z,
    targetX: ui.cameraTarget.x,
    targetY: ui.cameraTarget.y,
    targetZ: ui.cameraTarget.z,
    config: SPRING_CONFIGS[mergedConfig.easing],
    onChange: ({ value }) => {
      // Update store with animated values
      setCameraPosition({
        x: value.positionX,
        y: value.positionY,
        z: value.positionZ,
      });
      setCameraTarget({
        x: value.targetX,
        y: value.targetY,
        z: value.targetZ,
      });
    },
  }));

  // Node visibility springs (one per node type)
  const visibilityMapRef = useRef<Map<VoxelNodeType, SpringValue<number>>>(new Map());
  const [visibilitySprings, visibilityApi] = useSpring(() => {
    const initial: Record<string, number> = {};
    ALL_NODE_TYPES.forEach((type) => {
      initial[type] = filters.nodeTypes.includes(type) ? 1 : 0;
    });
    return {
      ...initial,
      config: SPRING_CONFIGS[mergedConfig.easing],
    };
  });

  // Build visibility map from springs
  useEffect(() => {
    const map = new Map<VoxelNodeType, SpringValue<number>>();
    ALL_NODE_TYPES.forEach((type) => {
      const springValue = visibilitySprings[type as keyof typeof visibilitySprings];
      if (springValue instanceof SpringValue) {
        map.set(type, springValue);
      }
    });
    visibilityMapRef.current = map;
  }, [visibilitySprings]);

  /**
   * Check if a node type is currently visible
   */
  const isNodeTypeVisible = useCallback((type: VoxelNodeType): boolean => {
    const spring = visibilityMapRef.current.get(type);
    if (spring) {
      return spring.get() > 0.5;
    }
    return filters.nodeTypes.includes(type);
  }, [filters.nodeTypes]);

  /**
   * Transition to a specific configuration
   */
  const transitionToConfig = useCallback((
    config: ExtendedViewPresetConfig,
    options?: ViewTransitionConfig
  ) => {
    const opts = { ...mergedConfig, ...options };
    const transitionId = ++transitionIdRef.current;
    cancelRef.current = false;

    setTransitionState({
      isTransitioning: true,
      targetPreset: null,
      progress: 0,
    });

    opts.onStart?.();

    // Animate camera
    cameraApi.start({
      positionX: config.camera.position.x,
      positionY: config.camera.position.y,
      positionZ: config.camera.position.z,
      targetX: config.camera.target.x,
      targetY: config.camera.target.y,
      targetZ: config.camera.target.z,
      config: {
        ...SPRING_CONFIGS[opts.easing],
        duration: opts.duration,
      },
      onRest: () => {
        if (transitionId === transitionIdRef.current && !cancelRef.current) {
          setTransitionState((prev) => ({ ...prev, isTransitioning: false, progress: 1 }));
          opts.onComplete?.();
        }
      },
    });

    // Animate node visibility
    const visibilityTarget: Record<string, number> = {};
    ALL_NODE_TYPES.forEach((type) => {
      visibilityTarget[type] = config.layers.includes(type) ? 1 : 0;
    });

    visibilityApi.start({
      ...visibilityTarget,
      config: {
        ...SPRING_CONFIGS[opts.easing],
        duration: opts.duration,
      },
      onRest: () => {
        // Update filters after animation completes
        if (transitionId === transitionIdRef.current && !cancelRef.current) {
          setNodeTypeFilter(config.layers);
        }
      },
    });

    // Update layout type immediately (no animation needed)
    setLayoutType(config.layout);
  }, [mergedConfig, cameraApi, visibilityApi, setNodeTypeFilter, setLayoutType]);

  /**
   * Transition to a preset
   */
  const transitionTo = useCallback((
    preset: ViewPreset,
    options?: ViewTransitionConfig
  ) => {
    const config = VIEW_PRESETS[preset];
    if (!config) {
      console.warn(`Unknown preset: ${preset}`);
      return;
    }

    setTransitionState((prev) => ({ ...prev, targetPreset: preset }));
    transitionToConfig(config, options);
  }, [transitionToConfig]);

  /**
   * Cancel the current transition
   */
  const cancelTransition = useCallback(() => {
    cancelRef.current = true;
    cameraApi.stop();
    visibilityApi.stop();
    setTransitionState({
      isTransitioning: false,
      targetPreset: null,
      progress: 0,
    });
  }, [cameraApi, visibilityApi]);

  return {
    cameraSpring: cameraSpring as CameraState,
    nodeVisibility: visibilityMapRef.current,
    transitionState,
    transitionTo,
    transitionToConfig,
    cancelTransition,
    isNodeTypeVisible,
  };
}

/**
 * Animation presets for different transition scenarios
 */
export const VIEW_TRANSITION_PRESETS = {
  /** Smooth, elegant transition for preset switching */
  smooth: {
    duration: 800,
    tension: 120,
    friction: 14,
    easing: 'default' as const,
  },
  /** Quick snap for rapid navigation */
  snap: {
    duration: 300,
    tension: 400,
    friction: 30,
    easing: 'stiff' as const,
  },
  /** Gentle, slow transition for presentation mode */
  cinematic: {
    duration: 1500,
    tension: 80,
    friction: 20,
    easing: 'gentle' as const,
  },
  /** Bouncy, playful transition */
  playful: {
    duration: 600,
    tension: 180,
    friction: 12,
    easing: 'wobbly' as const,
  },
} as const;

export type ViewTransitionPreset = keyof typeof VIEW_TRANSITION_PRESETS;

export default useViewTransition;
