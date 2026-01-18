/**
 * Story 34.2 - VR Controllers Component
 *
 * Provides VR controller support with ray casting, selection highlighting,
 * and optional haptic feedback for the Voxel Intelligence Engine.
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR, useController, Interactive, XRInteractionEvent } from '@react-three/xr';
import { Vector3, Group, Mesh } from 'three';
import type { VoxelNode } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface VRControllersProps {
  /** Callback when a node is selected */
  onNodeSelect?: (node: VoxelNode | null) => void;
  /** Callback when pointing at a node */
  onNodeHover?: (node: VoxelNode | null) => void;
  /** Callback for teleport request */
  onTeleport?: (position: Vector3) => void;
  /** Enable teleport locomotion */
  enableTeleport?: boolean;
  /** Enable haptic feedback */
  enableHaptics?: boolean;
  /** Ray color */
  rayColor?: string;
  /** Selection highlight color */
  highlightColor?: string;
  /** Maximum ray distance */
  maxRayDistance?: number;
  /** Node data lookup map */
  nodeMap?: Map<string, VoxelNode>;
}

export interface ControllerRayProps {
  /** Hand (left or right) */
  hand: 'left' | 'right';
  /** Ray color */
  color: string;
  /** Maximum ray distance */
  maxDistance: number;
  /** Whether ray is hitting something */
  isHitting: boolean;
  /** Hit position */
  hitPosition?: Vector3;
}

export interface TeleportTargetProps {
  /** Target position */
  position: Vector3;
  /** Whether target is valid */
  isValid: boolean;
  /** Visibility */
  visible: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RAY_COLOR = '#4ecdc4';
const DEFAULT_HIGHLIGHT_COLOR = '#fde047';
const DEFAULT_MAX_DISTANCE = 50;
const HAPTIC_INTENSITY = 0.5;
const HAPTIC_DURATION = 50;

// ============================================================================
// Controller Ray Component
// ============================================================================

const ControllerRay: React.FC<ControllerRayProps> = ({
  hand,
  color,
  maxDistance,
  isHitting,
  hitPosition,
}) => {
  const controller = useController(hand);

  // Calculate ray end position
  const rayPoints = useMemo(() => {
    if (!controller) return null;

    const startPos = new Vector3(0, 0, 0);
    const endPos = hitPosition
      ? hitPosition.clone().sub(controller.controller.position).normalize().multiplyScalar(
        hitPosition.distanceTo(controller.controller.position)
      )
      : new Vector3(0, 0, -maxDistance);

    return { start: startPos, end: endPos };
  }, [controller, hitPosition, maxDistance]);

  if (!controller || !rayPoints) return null;

  return (
    <group>
      {/* Ray line */}
      <mesh position={rayPoints.start}>
        <cylinderGeometry
          args={[0.002, isHitting ? 0.004 : 0.002, rayPoints.end.length(), 8]}
        />
        <meshBasicMaterial
          color={isHitting ? DEFAULT_HIGHLIGHT_COLOR : color}
          transparent
          opacity={isHitting ? 0.9 : 0.6}
        />
      </mesh>

      {/* Hit point indicator */}
      {isHitting && hitPosition && (
        <mesh position={rayPoints.end}>
          <sphereGeometry args={[0.02, 16, 16]} />
          <meshBasicMaterial color={DEFAULT_HIGHLIGHT_COLOR} />
        </mesh>
      )}
    </group>
  );
};

// ============================================================================
// Teleport Target Component
// ============================================================================

const TeleportTarget: React.FC<TeleportTargetProps> = ({ position, isValid, visible }) => {
  const ringRef = useRef<Mesh>(null);

  // Animate the target ring
  useFrame((_, delta) => {
    if (ringRef.current && visible) {
      ringRef.current.rotation.y += delta * 2;
    }
  });

  if (!visible) return null;

  return (
    <group position={position}>
      {/* Ground ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.4, 32]} />
        <meshBasicMaterial
          color={isValid ? '#22c55e' : '#ef4444'}
          transparent
          opacity={0.8}
          side={2}
        />
      </mesh>

      {/* Inner dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial
          color={isValid ? '#4ade80' : '#f87171'}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Vertical line */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 1, 8]} />
        <meshBasicMaterial
          color={isValid ? '#22c55e' : '#ef4444'}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Arrow head */}
      <mesh position={[0, 1, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.05, 0.1, 8]} />
        <meshBasicMaterial color={isValid ? '#22c55e' : '#ef4444'} />
      </mesh>
    </group>
  );
};

// ============================================================================
// Controller Model Component
// ============================================================================

interface ControllerModelProps {
  hand: 'left' | 'right';
  isGrabbing: boolean;
}

const ControllerModel: React.FC<ControllerModelProps> = ({ hand, isGrabbing }) => {
  const controller = useController(hand);

  if (!controller) return null;

  return (
    <group>
      {/* Simple controller representation */}
      <mesh>
        <boxGeometry args={[0.05, 0.03, 0.1]} />
        <meshPhysicalMaterial
          color={isGrabbing ? '#fde047' : '#334155'}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Grip indicator */}
      <mesh position={[0, -0.02, 0.03]}>
        <cylinderGeometry args={[0.015, 0.015, 0.06, 8]} />
        <meshPhysicalMaterial
          color={isGrabbing ? '#facc15' : '#475569'}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
};

// ============================================================================
// Selection Highlight Component
// ============================================================================

interface SelectionHighlightProps {
  position: Vector3 | null;
  color: string;
  visible: boolean;
}

const SelectionHighlight: React.FC<SelectionHighlightProps> = ({ position, color, visible }) => {
  const ringRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (ringRef.current && visible) {
      ringRef.current.rotation.z += delta * 3;
      ringRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.1);
    }
  });

  if (!visible || !position) return null;

  return (
    <group position={position}>
      {/* Pulsing ring around selected node */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.8, 0.03, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>

      {/* Glow sphere */}
      <mesh>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// ============================================================================
// Main VR Controllers Component
// ============================================================================

export const VRControllers: React.FC<VRControllersProps> = ({
  onNodeSelect,
  onNodeHover,
  onTeleport: _onTeleport,
  enableTeleport = true,
  enableHaptics = true,
  rayColor = DEFAULT_RAY_COLOR,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
  maxRayDistance = DEFAULT_MAX_DISTANCE,
  nodeMap,
}) => {
  const { isPresenting } = useXR();
  const leftController = useController('left');
  const rightController = useController('right');

  // State
  const [hoveredNodeId, _setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, _setSelectedNodeId] = useState<string | null>(null);
  const [isLeftHitting, _setIsLeftHitting] = useState(false);
  const [isRightHitting, _setIsRightHitting] = useState(false);
  const [leftHitPosition, _setLeftHitPosition] = useState<Vector3 | undefined>();
  const [rightHitPosition, _setRightHitPosition] = useState<Vector3 | undefined>();
  const [teleportTarget, _setTeleportTarget] = useState<Vector3 | null>(null);
  const [isTeleportValid, _setIsTeleportValid] = useState(false);
  const [isLeftGrabbing, _setIsLeftGrabbing] = useState(false);
  const [isRightGrabbing, _setIsRightGrabbing] = useState(false);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(
    (hand: 'left' | 'right', intensity: number = HAPTIC_INTENSITY, duration: number = HAPTIC_DURATION) => {
      if (!enableHaptics) return;

      const controller = hand === 'left' ? leftController : rightController;
      if (controller?.inputSource?.gamepad?.hapticActuators?.[0]) {
        controller.inputSource.gamepad.hapticActuators[0].pulse(intensity, duration);
      }
    },
    [enableHaptics, leftController, rightController]
  );

  // Handlers for node interaction would go here
  // Currently unused as interactions are handled by Interactive component or custom logic
  useEffect(() => {
    if (hoveredNodeId && nodeMap) {
      const node = nodeMap.get(hoveredNodeId);
      onNodeHover?.(node || null);
      if (node) triggerHaptic('right', 0.2, 20);
    } else {
      onNodeHover?.(null);
    }
  }, [hoveredNodeId, nodeMap, onNodeHover, triggerHaptic]);

  useEffect(() => {
    if (selectedNodeId && nodeMap) {
      const node = nodeMap.get(selectedNodeId);
      onNodeSelect?.(node || null);
      if (node) triggerHaptic('right', 0.8, 100);
    }
  }, [selectedNodeId, nodeMap, onNodeSelect, triggerHaptic]);

  // Get selected node position for highlight
  const selectedNodePosition = useMemo(() => {
    if (!selectedNodeId || !nodeMap) return null;
    const node = nodeMap.get(selectedNodeId);
    if (!node) return null;
    return new Vector3(node.position.x, node.position.y, node.position.z);
  }, [selectedNodeId, nodeMap]);

  // Don't render if not in VR
  if (!isPresenting) return null;

  return (
    <group>
      {/* Left Controller */}
      {leftController && (
        <group>
          <ControllerModel hand="left" isGrabbing={isLeftGrabbing} />
          <ControllerRay
            hand="left"
            color={rayColor}
            maxDistance={maxRayDistance}
            isHitting={isLeftHitting}
            hitPosition={leftHitPosition}
          />
        </group>
      )}

      {/* Right Controller */}
      {rightController && (
        <group>
          <ControllerModel hand="right" isGrabbing={isRightGrabbing} />
          <ControllerRay
            hand="right"
            color={rayColor}
            maxDistance={maxRayDistance}
            isHitting={isRightHitting}
            hitPosition={rightHitPosition}
          />
        </group>
      )}

      {/* Teleport Target */}
      {enableTeleport && teleportTarget && (
        <TeleportTarget
          position={teleportTarget}
          isValid={isTeleportValid}
          visible={true}
        />
      )}

      {/* Selection Highlight */}
      <SelectionHighlight
        position={selectedNodePosition}
        color={highlightColor}
        visible={selectedNodeId !== null}
      />
    </group>
  );
};

// ============================================================================
// Interactive Node Wrapper
// ============================================================================

export interface VRInteractiveNodeProps {
  /** Node ID for identification */
  nodeId: string;
  /** Node data */
  node: VoxelNode;
  /** Children to render */
  children: React.ReactNode;
  /** Callback when selected */
  onSelect?: (node: VoxelNode) => void;
  /** Callback when hovered */
  onHover?: (node: VoxelNode | null) => void;
  /** Enable grab interaction */
  enableGrab?: boolean;
}

export const VRInteractiveNode: React.FC<VRInteractiveNodeProps> = ({
  nodeId: _nodeId,
  node,
  children,
  onSelect,
  onHover,
  enableGrab = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isGrabbed, setIsGrabbed] = useState(false);
  const groupRef = useRef<Group>(null);

  // Handle select interaction
  const handleSelect = useCallback(
    (_event: XRInteractionEvent) => {
      onSelect?.(node);
    },
    [node, onSelect]
  );

  // Handle hover start
  const handleHoverStart = useCallback(
    (_event: XRInteractionEvent) => {
      setIsHovered(true);
      onHover?.(node);
    },
    [node, onHover]
  );

  // Handle hover end
  const handleHoverEnd = useCallback(
    (_event: XRInteractionEvent) => {
      setIsHovered(false);
      onHover?.(null);
    },
    [onHover]
  );

  // Handle grab
  const handleGrabStart = useCallback(() => {
    if (enableGrab) {
      setIsGrabbed(true);
    }
  }, [enableGrab]);

  const handleGrabEnd = useCallback(() => {
    setIsGrabbed(false);
  }, []);

  return (
    <Interactive
      onSelect={handleSelect}
      onHover={handleHoverStart}
      onBlur={handleHoverEnd}
      onSqueeze={handleGrabStart}
      onSqueezeEnd={handleGrabEnd}
    >
      <group
        ref={groupRef}
        scale={isHovered ? 1.15 : isGrabbed ? 1.25 : 1}
      >
        {children}

        {/* Hover outline */}
        {isHovered && (
          <mesh>
            <sphereGeometry args={[0.7, 16, 16]} />
            <meshBasicMaterial
              color="#4ecdc4"
              transparent
              opacity={0.2}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
    </Interactive>
  );
};

// ============================================================================
// Hand Tracking Component (Optional)
// ============================================================================

export interface VRHandTrackingProps {
  /** Enable hand visualization */
  showHands?: boolean;
  /** Hand color */
  handColor?: string;
}

export const VRHandTracking: React.FC<VRHandTrackingProps> = ({
  showHands = true,
  handColor: _handColor = '#ffffff',
}) => {
  const { isPresenting } = useXR();

  // Hand tracking is provided by @react-three/xr automatically
  // This component can be extended for custom hand visualizations

  if (!isPresenting || !showHands) return null;

  // The actual hand models are rendered by the XR system
  // This is a placeholder for custom hand rendering if needed
  return null;
};

export default VRControllers;
