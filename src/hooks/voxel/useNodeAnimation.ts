/**
 * Story 28.3 - Node Animation System
 *
 * Hook for managing 3D node animations using react-spring.
 * Handles node enter/exit animations and highlight effects.
 */

import { useCallback, useRef, useMemo, useState } from 'react';
import { useSpring, config as springConfig } from '@react-spring/three';
import type { VoxelNode } from '@/types/voxel';

export interface NodeAnimationState {
 scale: number;
 opacity: number;
 emissiveIntensity: number;
 positionY: number;
}

export interface NodeAnimationConfig {
 /** Animation duration in ms */
 enterDuration?: number;
 exitDuration?: number;
 highlightDuration?: number;
 /** Spring tension (higher = faster) */
 tension?: number;
 /** Spring friction (higher = less bouncy) */
 friction?: number;
}

const DEFAULT_CONFIG: Required<NodeAnimationConfig> = {
 enterDuration: 300,
 exitDuration: 200,
 highlightDuration: 500,
 tension: 280,
 friction: 60,
};

/**
 * Hook for animating a single node
 */
export function useNodeAnimation(
 node: VoxelNode | null,
 config: NodeAnimationConfig = {}
) {
 const mergedConfig = { ...DEFAULT_CONFIG, ...config };
 const [isExiting, setIsExiting] = useState(false);
 const isExitingRef = useRef(false); // Keep ref for callbacks if needed, or just use state setters

 // Spring configuration
 const springConf = useMemo(
 () => ({
 tension: mergedConfig.tension,
 friction: mergedConfig.friction,
 }),
 [mergedConfig.tension, mergedConfig.friction]
 );

 // Main animation spring
 const [spring, api] = useSpring(() => ({
 scale: node ? 1 : 0,
 opacity: node ? 1 : 0,
 emissiveIntensity: 0,
 positionY: node?.position.y ?? 0,
 config: springConf,
 }));

 /**
 * Animate node entering the scene
 */
 const animateEnter = useCallback(() => {
 isExitingRef.current = false;
 setIsExiting(false);
 api.start({
 from: { scale: 0, opacity: 0, positionY: (node?.position.y ?? 0) - 2 },
 to: { scale: 1, opacity: 1, positionY: node?.position.y ?? 0 },
 config: { ...springConf, duration: mergedConfig.enterDuration },
 });
 }, [api, node?.position.y, springConf, mergedConfig.enterDuration]);

 /**
 * Animate node exiting the scene
 */
 const animateExit = useCallback(
 (onComplete?: () => void) => {
 isExitingRef.current = true;
 setIsExiting(true);
 api.start({
 to: { scale: 0, opacity: 0 },
 config: { ...springConf, duration: mergedConfig.exitDuration },
 onRest: () => {
 if (isExitingRef.current && onComplete) {
 onComplete();
 }
 },
 });
 },
 [api, springConf, mergedConfig.exitDuration]
 );

 /**
 * Highlight node with pulse effect
 */
 const animateHighlight = useCallback(() => {
 api.start({
 from: { emissiveIntensity: 0 },
 to: async (next) => {
 await next({ emissiveIntensity: 0.8 });
 await next({ emissiveIntensity: 0 });
 },
 config: { duration: mergedConfig.highlightDuration / 2 },
 });
 }, [api, mergedConfig.highlightDuration]);

 /**
 * Pulse effect for selected/hovered nodes
 */
 const animatePulse = useCallback(
 (intensity: number = 0.5) => {
 api.start({
 to: async (next) => {
 await next({ scale: 1 + intensity * 0.2 });
 await next({ scale: 1 });
 },
 config: springConfig.wobbly,
 });
 },
 [api]
 );

 /**
 * Update position with animation
 */
 const animatePosition = useCallback(
 (newY: number) => {
 api.start({
 to: { positionY: newY },
 config: springConf,
 });
 },
 [api, springConf]
 );

 return {
 spring,
 animateEnter,
 animateExit,
 animateHighlight,
 animatePulse,
 animatePosition,
 isExiting,
 };
}

/**
 * Hook for managing animations of multiple nodes
 */
export function useNodesAnimation(
 nodes: Map<string, VoxelNode>,
 config: NodeAnimationConfig = {}
) {
 const animationStatesRef = useRef<
 Map<string, { entering: boolean; exiting: boolean }>
 >(new Map());
 const previousNodesRef = useRef<Set<string>>(new Set());

 /**
 * Determine which nodes are entering/exiting
 */
 const getAnimationChanges = useCallback(() => {
 const currentIds = new Set(nodes.keys());
 const previousIds = previousNodesRef.current;

 const entering: string[] = [];
 const exiting: string[] = [];
 const stable: string[] = [];

 // Find entering nodes (in current, not in previous)
 for (const id of currentIds) {
 if (!previousIds.has(id)) {
 entering.push(id);
 } else {
 stable.push(id);
 }
 }

 // Find exiting nodes (in previous, not in current)
 for (const id of previousIds) {
 if (!currentIds.has(id)) {
 exiting.push(id);
 }
 }

 // Update previous nodes reference
 previousNodesRef.current = currentIds;

 return { entering, exiting, stable };
 }, [nodes]);

 /**
 * Get staggered delay for node animation
 */
 const getStaggerDelay = useCallback(
 (index: number, total: number): number => {
 const maxDelay = 300; // Max total stagger time
 if (total <= 1) return 0;
 return (index / (total - 1)) * maxDelay;
 },
 []
 );

 /**
 * Reset animation state for a node
 */
 const resetAnimationState = useCallback((nodeId: string) => {
 animationStatesRef.current.delete(nodeId);
 }, []);

 /**
 * Check if node is animating
 */
 const isAnimating = useCallback((nodeId: string): boolean => {
 const state = animationStatesRef.current.get(nodeId);
 return state ? state.entering || state.exiting : false;
 }, []);

 return {
 getAnimationChanges,
 getStaggerDelay,
 resetAnimationState,
 isAnimating,
 config: { ...DEFAULT_CONFIG, ...config },
 };
}

/**
 * Animation presets for different scenarios
 */
const ANIMATION_PRESETS = {
 /** Fast, snappy animations for real-time updates */
 realtime: {
 enterDuration: 200,
 exitDuration: 150,
 highlightDuration: 300,
 tension: 400,
 friction: 40,
 },
 /** Smooth, elegant animations for view transitions */
 viewTransition: {
 enterDuration: 400,
 exitDuration: 300,
 highlightDuration: 600,
 tension: 200,
 friction: 26,
 },
 /** Bouncy, playful animations */
 playful: {
 enterDuration: 500,
 exitDuration: 300,
 highlightDuration: 400,
 tension: 180,
 friction: 12,
 },
 /** Subtle, professional animations */
 subtle: {
 enterDuration: 300,
 exitDuration: 200,
 highlightDuration: 400,
 tension: 300,
 friction: 40,
 },
} as const;

export type AnimationPreset = keyof typeof ANIMATION_PRESETS;

export default useNodeAnimation;
