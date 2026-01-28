/**
 * Story 34.4 - AR Placement Component
 *
 * Provides AR placement UI with:
 * - Reticle for placement preview
 * - "Place Here" button
 * - Reset placement option
 * - Scale indicator
 * - Pinch to scale, drag to move
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR, useHitTest, Interactive } from '@react-three/xr';
import { Vector3, Quaternion, Mesh, Group } from 'three';
import { Html, Text } from '@react-three/drei';

// ============================================================================
// Types
// ============================================================================

export interface ARPlacementProps {
  /** Callback when placement is confirmed */
  onPlace?: (position: Vector3, rotation: Quaternion, scale: number) => void;
  /** Callback when placement is reset */
  onReset?: () => void;
  /** Initial scale */
  initialScale?: number;
  /** Minimum scale */
  minScale?: number;
  /** Maximum scale */
  maxScale?: number;
  /** Show scale indicator */
  showScaleIndicator?: boolean;
  /** Custom reticle color */
  reticleColor?: string;
  /** Custom valid placement color */
  validColor?: string;
  /** Custom invalid placement color */
  invalidColor?: string;
  /** Enable haptic feedback */
  enableHaptics?: boolean;
  /** Children to render at placement location */
  children?: React.ReactNode;
}

export interface PlacementState {
  /** Whether content is placed */
  isPlaced: boolean;
  /** Placement position */
  position: Vector3;
  /** Placement rotation */
  rotation: Quaternion;
  /** Current scale */
  scale: number;
  /** Whether current surface is valid for placement */
  isValidSurface: boolean;
}

export interface ARReticleProps {
  /** Whether to show the reticle */
  visible: boolean;
  /** Position from hit test */
  position?: Vector3;
  /** Rotation from hit test */
  rotation?: Quaternion;
  /** Whether surface is valid */
  isValid: boolean;
  /** Reticle color */
  color: string;
  /** Valid placement color */
  validColor: string;
  /** Invalid placement color */
  invalidColor: string;
}

export interface ScaleIndicatorProps {
  /** Current scale value */
  scale: number;
  /** Minimum scale */
  minScale: number;
  /** Maximum scale */
  maxScale: number;
  /** Position relative to content */
  position: Vector3;
  /** Whether visible */
  visible: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SCALE = 1;
const DEFAULT_MIN_SCALE = 0.1;
const DEFAULT_MAX_SCALE = 5;
const DEFAULT_RETICLE_COLOR = '#ffffff';
const DEFAULT_VALID_COLOR = '#22c55e';
const DEFAULT_INVALID_COLOR = '#ef4444';

// ============================================================================
// AR Reticle Component
// ============================================================================

const ARReticle: React.FC<ARReticleProps> = ({
  visible,
  position,
  rotation,
  isValid,
  validColor,
  invalidColor,
}) => {
  const meshRef = useRef<Mesh>(null);
  const innerRingRef = useRef<Mesh>(null);

  // Animate reticle
  useFrame((_, delta) => {
    if (meshRef.current && visible) {
      meshRef.current.rotation.z += delta * 0.5;
    }
    if (innerRingRef.current && visible) {
      innerRingRef.current.rotation.z -= delta * 0.8;
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
      innerRingRef.current.scale.setScalar(scale);
    }
  });

  if (!visible || !position) return null;

  const displayColor = isValid ? validColor : invalidColor;

  return (
    <group position={position} quaternion={rotation}>
      {/* Outer ring */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.15, 32]} />
        <meshBasicMaterial
          color={displayColor}
          transparent
          opacity={0.8}
          side={2}
        />
      </mesh>

      {/* Inner ring */}
      <mesh ref={innerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.08, 16]} />
        <meshBasicMaterial
          color={displayColor}
          transparent
          opacity={0.6}
          side={2}
        />
      </mesh>

      {/* Center dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.02, 16]} />
        <meshBasicMaterial color={displayColor} />
      </mesh>

      {/* Cross markers */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={i}
          position={[Math.cos(angle) * 0.2, 0.001, Math.sin(angle) * 0.2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.02, 0.08]} />
          <meshBasicMaterial color={displayColor} transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Status text */}
      <Text
        position={[0, 0.3, 0]}
        fontSize={0.05}
        color={displayColor}
        anchorX="center"
        anchorY="middle"
      >
        {isValid ? 'Tap to place' : 'Move to flat surface'}
      </Text>
    </group>
  );
};

// ============================================================================
// Scale Indicator Component
// ============================================================================

const ScaleIndicator: React.FC<ScaleIndicatorProps> = ({
  scale,
  minScale,
  maxScale,
  position,
  visible,
}) => {
  if (!visible) return null;

  const percentage = ((scale - minScale) / (maxScale - minScale)) * 100;

  return (
    <Html position={[position.x, position.y + 0.5, position.z]} center>
      <div className="bg-slate-900/90 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 pointer-events-none">
        {/* Scale value */}
        <div className="text-white text-xs font-mono text-center mb-1">
          {(scale * 100).toFixed(0)}%
        </div>

        {/* Scale bar */}
        <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Min/Max labels */}
        <div className="flex justify-between text-slate-400 text-[11px] mt-0.5">
          <span>{(minScale * 100).toFixed(0)}%</span>
          <span>{(maxScale * 100).toFixed(0)}%</span>
        </div>
      </div>
    </Html>
  );
};

// ============================================================================
// Placement Controls UI (DOM Overlay)
// ============================================================================

interface PlacementControlsProps {
  isPlaced: boolean;
  isValidSurface: boolean;
  scale: number;
  onPlace: () => void;
  onReset: () => void;
  onScaleChange: (scale: number) => void;
  minScale: number;
  maxScale: number;
}

export const PlacementControls: React.FC<PlacementControlsProps> = ({
  isPlaced,
  isValidSurface,
  scale,
  onPlace,
  onReset,
  onScaleChange,
  minScale,
  maxScale,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none z-50">
      <div className="max-w-md mx-auto flex flex-col gap-3 pointer-events-auto">
        {/* Scale slider (only when placed) */}
        {isPlaced && (
          <div className="bg-slate-900/90 backdrop-blur-md border border-white/20 rounded-3xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-medium">Scale</span>
              <span className="text-muted-foreground text-xs font-mono">
                {(scale * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={minScale}
              max={maxScale}
              step={0.01}
              value={scale}
              onChange={(e) => onScaleChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-blue-500
                [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isPlaced ? (
            <button
              onClick={onPlace}
              disabled={!isValidSurface}
              className={`
                flex-1 py-4 rounded-3xl font-semibold text-lg
                transition-all duration-200
                ${isValidSurface
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/25 hover:bg-green-600 active:scale-95'
                  : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                }
              `}
            >
              {isValidSurface ? 'Place Here' : 'Find a Surface'}
            </button>
          ) : (
            <>
              <button
                onClick={onReset}
                className="flex-1 py-4 bg-slate-700 text-white rounded-3xl font-semibold text-lg
                  shadow-lg hover:bg-slate-600 active:scale-95 transition-all"
              >
                Reset Position
              </button>
              <button
                onClick={onPlace}
                className="py-4 px-6 bg-blue-500 text-white rounded-3xl font-semibold text-lg
                  shadow-lg shadow-blue-500/25 hover:bg-blue-600 active:scale-95 transition-all"
              >
                Done
              </button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="text-center text-white/60 text-xs">
          {!isPlaced
            ? 'Point your camera at a flat surface'
            : 'Pinch to scale, drag to move'
          }
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Hit Test Handler Component
// ============================================================================

interface HitTestHandlerProps {
  onHitTest: (position: Vector3, rotation: Quaternion, isValid: boolean) => void;
  enabled: boolean;
}

const HitTestHandler: React.FC<HitTestHandlerProps> = ({ onHitTest, enabled }) => {
  const hitTestRef = useRef<Group>(null);

  useHitTest((hitMatrix) => {
    if (!enabled || !hitTestRef.current) return;

    // Extract position and rotation from hit matrix
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    hitMatrix.decompose(position, rotation, scale);

    // Simple surface validity check (horizontal surfaces)
    const up = new Vector3(0, 1, 0);
    const surfaceNormal = new Vector3(0, 1, 0).applyQuaternion(rotation);
    const dot = up.dot(surfaceNormal);
    const isValid = dot > 0.9; // Surface is roughly horizontal

    onHitTest(position, rotation, isValid);
  });

  return <group ref={hitTestRef} />;
};

// ============================================================================
// Main AR Placement Component
// ============================================================================

export const ARPlacement: React.FC<ARPlacementProps> = ({
  onPlace,
  onReset,
  initialScale = DEFAULT_SCALE,
  minScale = DEFAULT_MIN_SCALE,
  maxScale = DEFAULT_MAX_SCALE,
  showScaleIndicator = true,
  reticleColor = DEFAULT_RETICLE_COLOR,
  validColor = DEFAULT_VALID_COLOR,
  invalidColor = DEFAULT_INVALID_COLOR,
  enableHaptics = true,
  children,
}) => {
  const { isPresenting } = useXR();

  // Placement state
  const [state, setState] = useState<PlacementState>({
    isPlaced: false,
    position: new Vector3(0, 0, 0),
    rotation: new Quaternion(),
    scale: initialScale,
    isValidSurface: false,
  });

  // Hit test state
  const [hitPosition, setHitPosition] = useState<Vector3 | undefined>();
  const [hitRotation, setHitRotation] = useState<Quaternion | undefined>();

  // Gesture state
  const [isScaling, setIsScaling] = useState(false);
  const initialPinchDistance = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(state.scale);

  // Handle hit test results
  const handleHitTest = useCallback((position: Vector3, rotation: Quaternion, isValid: boolean) => {
    setHitPosition(position);
    setHitRotation(rotation);
    setState((prev) => ({ ...prev, isValidSurface: isValid }));

    // Update position if not placed
    if (!state.isPlaced) {
      setState((prev) => ({
        ...prev,
        position: position.clone(),
        rotation: rotation.clone(),
      }));
    }
  }, [state.isPlaced]);

  // Handle placement
  const handlePlace = useCallback(() => {
    if (!state.isValidSurface && !state.isPlaced) return;

    if (!state.isPlaced) {
      setState((prev) => ({ ...prev, isPlaced: true }));
      onPlace?.(state.position, state.rotation, state.scale);

      // Haptic feedback
      if (enableHaptics && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  }, [state, onPlace, enableHaptics]);

  // Handle reset
  const handleReset = useCallback(() => {
    setState({
      isPlaced: false,
      position: new Vector3(0, 0, 0),
      rotation: new Quaternion(),
      scale: initialScale,
      isValidSurface: false,
    });
    onReset?.();

    if (enableHaptics && navigator.vibrate) {
      navigator.vibrate([20, 50, 20]);
    }
  }, [initialScale, onReset, enableHaptics]);

  // Handle scale change
  const handleScaleChange = useCallback((newScale: number) => {
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
    setState((prev) => ({ ...prev, scale: clampedScale }));
  }, [minScale, maxScale]);

  // Touch gesture handlers for pinch-to-scale
  useEffect(() => {
    if (!isPresenting || !state.isPlaced) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
        initialScaleRef.current = state.scale;
        setIsScaling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const scaleFactor = currentDistance / initialPinchDistance.current;
        handleScaleChange(initialScaleRef.current * scaleFactor);
      }
    };

    const handleTouchEnd = () => {
      initialPinchDistance.current = null;
      setIsScaling(false);
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPresenting, state.isPlaced, state.scale, handleScaleChange]);

  return (
    <>
      {/* Hit test handler */}
      <HitTestHandler
        onHitTest={handleHitTest}
        enabled={isPresenting && !state.isPlaced}
      />

      {/* AR Reticle (when not placed) */}
      <ARReticle
        visible={isPresenting && !state.isPlaced}
        position={hitPosition}
        rotation={hitRotation}
        isValid={state.isValidSurface}
        color={reticleColor}
        validColor={validColor}
        invalidColor={invalidColor}
      />

      {/* Placed content */}
      {state.isPlaced && (
        <Interactive onSelect={handlePlace}>
          <group
            position={state.position}
            quaternion={state.rotation}
            scale={state.scale}
          >
            {children}

            {/* Scale indicator */}
            {showScaleIndicator && isScaling && (
              <ScaleIndicator
                scale={state.scale}
                minScale={minScale}
                maxScale={maxScale}
                position={new Vector3(0, 0, 0)}
                visible={true}
              />
            )}
          </group>
        </Interactive>
      )}

      {/* DOM Overlay Controls */}
      {isPresenting && (
        <PlacementControls
          isPlaced={state.isPlaced}
          isValidSurface={state.isValidSurface}
          scale={state.scale}
          onPlace={handlePlace}
          onReset={handleReset}
          onScaleChange={handleScaleChange}
          minScale={minScale}
          maxScale={maxScale}
        />
      )}
    </>
  );
};

export default ARPlacement;
