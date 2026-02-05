/**
 * useHoverState - Hook for managing node hover state
 *
 * Provides methods for tracking hover state with debounce support
 * for smooth tooltip display.
 *
 * @see Story VOX-4.5: Hover Tooltip
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import { useCallback, useRef, useEffect } from 'react';
import { useVoxelStore, useHoveredNode } from '@/stores/voxelStore';

// ============================================================================
// Types
// ============================================================================

export interface UseHoverStateReturn {
 /** Currently hovered node ID */
 hoveredNodeId: string | null;
 /** Currently hovered node data */
 hoveredNode: ReturnType<typeof useHoveredNode>;
 /** Set hover on a node (with optional delay) */
 setHover: (nodeId: string) => void;
 /** Clear hover state */
 clearHover: () => void;
 /** Check if a specific node is hovered */
 isHovered: (nodeId: string) => boolean;
}

export interface UseHoverStateOptions {
 /** Delay before showing hover state (ms) */
 hoverDelay?: number;
 /** Delay before hiding hover state (ms) */
 hideDelay?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default hover delay */
const DEFAULT_HOVER_DELAY = 200;

/** Default hide delay */
const DEFAULT_HIDE_DELAY = 0;

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing node hover state with optional delays.
 *
 * @param options - Configuration options for hover behavior
 *
 * @example
 * ```tsx
 * const { setHover, clearHover, isHovered } = useHoverState({ hoverDelay: 200 });
 *
 * <mesh
 * onPointerOver={() => setHover(nodeId)}
 * onPointerOut={clearHover}
 * />
 * ```
 */
export function useHoverState(options: UseHoverStateOptions = {}): UseHoverStateReturn {
 const { hoverDelay = DEFAULT_HOVER_DELAY, hideDelay = DEFAULT_HIDE_DELAY } = options;

 const hoverNode = useVoxelStore((state) => state.hoverNode);
 const hoveredNodeId = useVoxelStore((state) => state.ui.hoveredNodeId);
 const hoveredNode = useHoveredNode();

 // Timeout refs for debounced hover
 const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 // Cleanup on unmount
 useEffect(() => {
 return () => {
 if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
 if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
 };
 }, []);

 const setHover = useCallback(
 (nodeId: string) => {
 // Clear any pending hide
 if (hideTimeoutRef.current) {
 clearTimeout(hideTimeoutRef.current);
 hideTimeoutRef.current = null;
 }

 // If no delay or already hovering this node, set immediately
 if (hoverDelay === 0 || hoveredNodeId === nodeId) {
 hoverNode(nodeId);
 return;
 }

 // Clear any pending hover
 if (hoverTimeoutRef.current) {
 clearTimeout(hoverTimeoutRef.current);
 }

 // Set hover after delay
 hoverTimeoutRef.current = setTimeout(() => {
 hoverNode(nodeId);
 hoverTimeoutRef.current = null;
 }, hoverDelay);
 },
 [hoverNode, hoverDelay, hoveredNodeId]
 );

 const clearHover = useCallback(() => {
 // Clear any pending hover
 if (hoverTimeoutRef.current) {
 clearTimeout(hoverTimeoutRef.current);
 hoverTimeoutRef.current = null;
 }

 // If no delay, clear immediately
 if (hideDelay === 0) {
 hoverNode(null);
 return;
 }

 // Clear after delay
 hideTimeoutRef.current = setTimeout(() => {
 hoverNode(null);
 hideTimeoutRef.current = null;
 }, hideDelay);
 }, [hoverNode, hideDelay]);

 const isHovered = useCallback(
 (nodeId: string) => {
 return hoveredNodeId === nodeId;
 },
 [hoveredNodeId]
 );

 return {
 hoveredNodeId,
 hoveredNode,
 setHover,
 clearHover,
 isHovered,
 };
}

export default useHoverState;
