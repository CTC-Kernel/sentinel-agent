/**
 * Story 32.10 - Presentation Mode Component
 *
 * Fullscreen mode for presentations with auto-rotate,
 * spotlight effects, keyboard controls, and optional timer/notes.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3, SpotLight as ThreeSpotLight } from 'three';
import type { VoxelNode } from '@/types/voxel';
import { ErrorLogger } from '@/services/errorLogger';

// ============================================================================
// Types
// ============================================================================

export interface PresentationModeProps {
  /** Enable presentation mode */
  enabled: boolean;
  /** Callback when exiting presentation mode */
  onExit?: () => void;
  /** Nodes to feature in presentation */
  nodes: VoxelNode[];
  /** Current selected node */
  selectedNode?: VoxelNode | null;
  /** Callback when node selection changes */
  onNodeSelect?: (node: VoxelNode | null) => void;
  /** Auto-rotate camera around scene */
  autoRotate?: boolean;
  /** Auto-rotate speed (degrees per second) */
  autoRotateSpeed?: number;
  /** Enable spotlight effect on selected nodes */
  spotlightEnabled?: boolean;
  /** Presentation notes/slides */
  slides?: PresentationSlide[];
  /** Show timer */
  showTimer?: boolean;
  /** Initial slide index */
  initialSlideIndex?: number;
}

export interface PresentationSlide {
  /** Slide title */
  title: string;
  /** Slide notes/content */
  notes?: string;
  /** Node ID to focus on (optional) */
  focusNodeId?: string;
  /** Duration in seconds (for auto-advance) */
  duration?: number;
}

export interface PresentationControlsProps {
  /** Current slide index */
  currentSlide: number;
  /** Total number of slides */
  totalSlides: number;
  /** Go to next slide */
  onNext: () => void;
  /** Go to previous slide */
  onPrevious: () => void;
  /** Exit presentation */
  onExit: () => void;
  /** Toggle auto-rotate */
  onToggleRotate: () => void;
  /** Is auto-rotating */
  isRotating: boolean;
  /** Current slide data */
  slide?: PresentationSlide;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Show timer */
  showTimer: boolean;
}

// ============================================================================
// Spotlight Component
// ============================================================================

interface SpotlightEffectProps {
  targetPosition: [number, number, number] | null;
  intensity?: number;
  color?: string;
}

const SpotlightEffect: React.FC<SpotlightEffectProps> = ({
  targetPosition,
  intensity = 3,
  color = '#ffffff',
}) => {
  const spotlightRef = useRef<ThreeSpotLight>(null);

  useFrame(() => {
    if (spotlightRef.current && targetPosition) {
      // Smoothly move spotlight towards target
      const target = new Vector3(...targetPosition);
      spotlightRef.current.target.position.lerp(target, 0.1);
      spotlightRef.current.target.updateMatrixWorld();
    }
  });

  if (!targetPosition) return null;

  return (
    <group>
      <spotLight
        ref={spotlightRef}
        position={[targetPosition[0], targetPosition[1] + 15, targetPosition[2] + 10]}
        intensity={intensity}
        angle={Math.PI / 6}
        penumbra={0.5}
        distance={50}
        color={color}
        castShadow
      />
      {/* Ambient ring on ground */}
      <mesh
        position={[targetPosition[0], targetPosition[1] - 1, targetPosition[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[2, 3, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
    </group>
  );
};

// ============================================================================
// Auto-Rotate Camera Controller
// ============================================================================

interface AutoRotateCameraProps {
  enabled: boolean;
  speed: number;
  center: [number, number, number];
  radius: number;
  height: number;
}

const AutoRotateCamera: React.FC<AutoRotateCameraProps> = ({
  enabled,
  speed,
  center,
  radius,
  height,
}) => {
  const { camera } = useThree();
  const angleRef = useRef(0);

  useFrame((_, delta) => {
    if (!enabled) return;

    // Rotate around center
    angleRef.current += (speed * Math.PI / 180) * delta;

    const x = center[0] + Math.cos(angleRef.current) * radius;
    const z = center[2] + Math.sin(angleRef.current) * radius;
    const y = center[1] + height;

    camera.position.set(x, y, z);
    camera.lookAt(new Vector3(...center));
  });

  return null;
};

// ============================================================================
// Presentation Controls Overlay
// ============================================================================

const PresentationControls: React.FC<PresentationControlsProps> = ({
  currentSlide,
  totalSlides,
  onNext,
  onPrevious,
  onExit,
  onToggleRotate,
  isRotating,
  slide,
  elapsedTime,
  showTimer,
}) => {
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-modal pointer-events-none">
      {/* Slide info panel */}
      {slide && (
        <div className="absolute left-4 bottom-20 max-w-md pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 shadow-xl border border-border/40">
            <h3 className="text-white font-medium text-lg mb-2">{slide.title}</h3>
            {slide.notes && <p className="text-slate-300 text-sm">{slide.notes}</p>}
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="flex items-center justify-center gap-4 p-4 bg-gradient-to-t from-black/50 to-transparent pointer-events-auto">
        {/* Left section: Exit */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
            title="Exit (Escape)"
          >
            <span className="text-sm">Exit</span>
            <kbd className="px-1.5 py-0.5 text-xs bg-white/20 rounded">ESC</kbd>
          </button>
        </div>

        {/* Center section: Navigation */}
        <div className="flex items-center gap-3 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
          <button
            onClick={onPrevious}
            disabled={currentSlide === 0}
            className="min-w-[44px] min-h-[44px] p-2 hover:bg-white/10 rounded-full transition-colors disabled:bg-slate-700/50 disabled:text-slate-500"
            title="Previous (Left Arrow)"
            aria-label="Diapositive précédente"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="text-white font-mono min-w-[4rem] text-center">
            {currentSlide + 1} / {totalSlides}
          </span>

          <button
            onClick={onNext}
            disabled={currentSlide === totalSlides - 1}
            className="min-w-[44px] min-h-[44px] p-2 hover:bg-white/10 rounded-full transition-colors disabled:bg-slate-700/50 disabled:text-slate-500"
            title="Next (Right Arrow)"
            aria-label="Diapositive suivante"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Right section: Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleRotate}
            className={`p-2 rounded-lg transition-colors ${isRotating ? 'bg-brand-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            title="Toggle Auto-Rotate (R)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {showTimer && (
            <div className="px-3 py-1.5 bg-white/10 rounded-lg">
              <span className="text-white font-mono text-sm">{formatTime(elapsedTime)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Main Presentation Mode Component
// ============================================================================

export const PresentationMode: React.FC<PresentationModeProps> = ({
  enabled,
  onExit,
  nodes,
  selectedNode,
  onNodeSelect,
  autoRotate: initialAutoRotate = true,
  autoRotateSpeed = 15,
  spotlightEnabled = true,
  slides = [],
  showTimer = true,
  initialSlideIndex = 0,
}) => {
  const [, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(initialAutoRotate);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(initialSlideIndex);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Default slides if none provided
  const effectiveSlides = useMemo(() => {
    if (slides.length > 0) return slides;

    // Generate slides from nodes if no slides provided
    const criticalNodes = nodes.filter(
      (n) => n.status === 'critical' || n.status === 'warning'
    );

    return [
      {
        title: 'Vue d\'ensemble',
        notes: `Total: ${nodes.length} noeuds dans le système`,
      },
      ...criticalNodes.slice(0, 5).map((node) => ({
        title: node.label || `Noeud ${node.id}`,
        notes: `Type: ${node.type} | Status: ${node.status}`,
        focusNodeId: node.id,
      })),
      {
        title: 'Résumé',
        notes: `${criticalNodes.length} éléments critiques identifiés`,
      },
    ];
  }, [slides, nodes]);

  // Current slide
  const currentSlide = effectiveSlides[currentSlideIndex];

  // Handle fullscreen
  useEffect(() => {
    if (!enabled) return;

    const enterFullscreen = async () => {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        ErrorLogger.warn('Fullscreen not available', 'PresentationMode', { metadata: { error: err } });
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && enabled) {
        onExit?.();
      }
    };

    enterFullscreen();
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    };
  }, [enabled, onExit]);

  // Timer
  useEffect(() => {
    if (!enabled) {
      setTimeout(() => setElapsedTime(0), 0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled]);

  // Focus on slide's target node
  useEffect(() => {
    const focusId = (currentSlide as PresentationSlide | undefined)?.focusNodeId;
    if (!enabled || !focusId) return;

    const targetNode = nodes.find((n) => n.id === focusId);
    if (targetNode) {
      onNodeSelect?.(targetNode);
      // Defer state update to avoid set-state-in-effect warning
      setTimeout(() => setAutoRotate(false), 0);
    }
  }, [enabled, currentSlide, nodes, onNodeSelect]);

  // Keyboard controls
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onExit?.();
          break;
        case 'ArrowRight':
        case ' ':
        case 'Enter':
          if (currentSlideIndex < effectiveSlides.length - 1) {
            setCurrentSlideIndex((prev) => prev + 1);
          }
          break;
        case 'ArrowLeft':
        case 'Backspace':
          if (currentSlideIndex > 0) {
            setCurrentSlideIndex((prev) => prev - 1);
          }
          break;
        case 'r':
        case 'R':
          setAutoRotate((prev) => !prev);
          break;
        case 'Home':
          setCurrentSlideIndex(0);
          break;
        case 'End':
          setCurrentSlideIndex(effectiveSlides.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, currentSlideIndex, effectiveSlides.length, onExit]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentSlideIndex < effectiveSlides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    }
  }, [currentSlideIndex, effectiveSlides.length]);

  const handlePrevious = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
    }
  }, [currentSlideIndex]);

  const handleExit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
    onExit?.();
  }, [onExit]);

  const handleToggleRotate = useCallback(() => {
    setAutoRotate((prev) => !prev);
  }, []);

  // Get spotlight position
  const spotlightPosition = useMemo((): [number, number, number] | null => {
    if (!spotlightEnabled || !selectedNode) return null;
    const pos = selectedNode.position;
    return [
      typeof pos.x === 'number' ? pos.x : 0,
      typeof pos.y === 'number' ? pos.y : 0,
      typeof pos.z === 'number' ? pos.z : 0,
    ];
  }, [spotlightEnabled, selectedNode]);

  // Calculate scene center for rotation
  const sceneCenter = useMemo((): [number, number, number] => {
    if (nodes.length === 0) return [0, 0, 0];

    let sumX = 0, sumY = 0, sumZ = 0;
    nodes.forEach((node) => {
      sumX += typeof node.position.x === 'number' ? node.position.x : 0;
      sumY += typeof node.position.y === 'number' ? node.position.y : 0;
      sumZ += typeof node.position.z === 'number' ? node.position.z : 0;
    });

    return [sumX / nodes.length, sumY / nodes.length, sumZ / nodes.length];
  }, [nodes]);

  if (!enabled) return null;

  return (
    <>
      {/* 3D Effects */}
      <SpotlightEffect targetPosition={spotlightPosition} />
      <AutoRotateCamera
        enabled={autoRotate}
        speed={autoRotateSpeed}
        center={sceneCenter}
        radius={30}
        height={15}
      />

      {/* HTML Overlay */}
      <Html fullscreen>
        <PresentationControls
          currentSlide={currentSlideIndex}
          totalSlides={effectiveSlides.length}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onExit={handleExit}
          onToggleRotate={handleToggleRotate}
          isRotating={autoRotate}
          slide={currentSlide}
          elapsedTime={elapsedTime}
          showTimer={showTimer}
        />
      </Html>
    </>
  );
};

// ============================================================================
// Presentation Mode Hook
// ============================================================================

export interface UsePresentationModeReturn {
  /** Whether presentation mode is active */
  isActive: boolean;
  /** Start presentation mode */
  start: (slides?: PresentationSlide[]) => void;
  /** Stop presentation mode */
  stop: () => void;
  /** Toggle presentation mode */
  toggle: () => void;
  /** Current slides */
  slides: PresentationSlide[];
  /** Set slides */
  setSlides: (slides: PresentationSlide[]) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePresentationMode(): UsePresentationModeReturn {
  const [isActive, setIsActive] = useState(false);
  const [slides, setSlides] = useState<PresentationSlide[]>([]);

  const start = useCallback((newSlides?: PresentationSlide[]) => {
    if (newSlides) {
      setSlides(newSlides);
    }
    setIsActive(true);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
  }, []);

  const toggle = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  return {
    isActive,
    start,
    stop,
    toggle,
    slides,
    setSlides,
  };
}

export default PresentationMode;
