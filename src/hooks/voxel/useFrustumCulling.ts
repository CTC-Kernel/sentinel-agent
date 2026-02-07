/**
 * Story 32.3 - Frustum Culling Optimization Hook
 *
 * Implements efficient frustum culling with spatial partitioning.
 * Skips rendering nodes outside camera view and debounces calculations.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Frustum, Matrix4, Vector3, Box3, Camera } from 'three';
import type { VoxelNode } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface UseFrustumCullingOptions {
 /** Enable/disable frustum culling */
 enabled?: boolean;
 /** Debounce delay in milliseconds */
 debounceMs?: number;
 /** Margin around frustum (in world units) to prevent popping */
 margin?: number;
 /** Use spatial partitioning for large node counts */
 useSpatialPartitioning?: boolean;
 /** Grid cell size for spatial partitioning */
 gridCellSize?: number;
}

export interface FrustumCullingState {
 /** Set of visible node IDs */
 visibleNodeIds: Set<string>;
 /** Total nodes being tracked */
 totalNodes: number;
 /** Number of visible nodes */
 visibleCount: number;
 /** Percentage of nodes visible */
 visibilityRatio: number;
 /** Whether culling is currently active */
 isActive: boolean;
}

export interface UseFrustumCullingReturn {
 /** Current culling state */
 state: FrustumCullingState;
 /** Check if a specific node is visible */
 isNodeVisible: (nodeId: string) => boolean;
 /** Force recalculation of visible nodes */
 recalculate: () => void;
 /** Enable/disable culling */
 setEnabled: (enabled: boolean) => void;
}

// ============================================================================
// Spatial Partitioning Grid
// ============================================================================

interface GridCell {
 nodes: VoxelNode[];
 bounds: Box3;
}

type SpatialGrid = Map<string, GridCell>;

function createSpatialGrid(nodes: VoxelNode[], cellSize: number): SpatialGrid {
 const grid: SpatialGrid = new Map();

 nodes.forEach((node) => {
 const pos = node.position;
 const x = typeof pos.x === 'number' ? pos.x : 0;
 const y = typeof pos.y === 'number' ? pos.y : 0;
 const z = typeof pos.z === 'number' ? pos.z : 0;

 // Calculate cell coordinates
 const cellX = Math.floor(x / cellSize);
 const cellY = Math.floor(y / cellSize);
 const cellZ = Math.floor(z / cellSize);
 const key = `${cellX},${cellY},${cellZ}`;

 if (!grid.has(key)) {
 const minX = cellX * cellSize;
 const minY = cellY * cellSize;
 const minZ = cellZ * cellSize;
 grid.set(key, {
 nodes: [],
 bounds: new Box3(
 new Vector3(minX, minY, minZ),
 new Vector3(minX + cellSize, minY + cellSize, minZ + cellSize)
 ),
 });
 }

 grid.get(key)!.nodes.push(node);
 });

 return grid;
}

// ============================================================================
// Frustum Testing Utilities
// ============================================================================

const tempMatrix = new Matrix4();
const tempFrustum = new Frustum();
const tempVector = new Vector3();

function updateFrustum(camera: Camera): void {
 tempMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
 tempFrustum.setFromProjectionMatrix(tempMatrix);
}

function isPointInFrustum(x: number, y: number, z: number, margin: number): boolean {
 tempVector.set(x, y, z);

 // Check each plane with margin
 for (const plane of tempFrustum.planes) {
 if (plane.distanceToPoint(tempVector) < -margin) {
 return false;
 }
 }
 return true;
}

function isBoundsInFrustum(bounds: Box3): boolean {
 return tempFrustum.intersectsBox(bounds);
}

// ============================================================================
// Main Hook
// ============================================================================

export function useFrustumCulling(
 nodes: VoxelNode[],
 options: UseFrustumCullingOptions = {}
): UseFrustumCullingReturn {
 const {
 enabled: initialEnabled = true,
 debounceMs = 50,
 margin = 2,
 useSpatialPartitioning = true,
 gridCellSize = 20,
 } = options;

 const { camera } = useThree();
 const [enabled, setEnabled] = useState(initialEnabled);
 const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
 const lastUpdateRef = useRef<number>(0);
 const frameCountRef = useRef<number>(0);
 const pendingUpdateRef = useRef<boolean>(false);

 // Build spatial grid when nodes change
 const spatialGrid = useMemo(() => {
 if (!useSpatialPartitioning || nodes.length < 100) {
 return null;
 }
 return createSpatialGrid(nodes, gridCellSize);
 }, [nodes, useSpatialPartitioning, gridCellSize]);

 // Calculate visible nodes
 const calculateVisibleNodes = useCallback(() => {
 if (!enabled) {
 // When disabled, all nodes are visible
 setVisibleNodeIds(new Set(nodes.map((n) => n.id)));
 return;
 }

 updateFrustum(camera);

 const visible = new Set<string>();

 if (spatialGrid) {
 // Use spatial partitioning for large node sets
 for (const [, cell] of spatialGrid) {
 // First check if cell bounds intersect frustum
 if (isBoundsInFrustum(cell.bounds)) {
 // Then check individual nodes in visible cells
 for (const node of cell.nodes) {
 const pos = node.position;
 const x = typeof pos.x === 'number' ? pos.x : 0;
 const y = typeof pos.y === 'number' ? pos.y : 0;
 const z = typeof pos.z === 'number' ? pos.z : 0;

 if (isPointInFrustum(x, y, z, margin)) {
 visible.add(node.id);
 }
 }
 }
 }
 } else {
 // Direct frustum test for smaller node sets
 for (const node of nodes) {
 const pos = node.position;
 const x = typeof pos.x === 'number' ? pos.x : 0;
 const y = typeof pos.y === 'number' ? pos.y : 0;
 const z = typeof pos.z === 'number' ? pos.z : 0;

 if (isPointInFrustum(x, y, z, margin)) {
 visible.add(node.id);
 }
 }
 }

 setVisibleNodeIds(visible);
 }, [camera, enabled, margin, nodes, spatialGrid]);

 // Force recalculation
 const recalculate = useCallback(() => {
 calculateVisibleNodes();
 }, [calculateVisibleNodes]);

 // Debounced update in animation frame
 useFrame(() => {
 if (!enabled) return;

 const now = performance.now();
 frameCountRef.current++;

 // Only update every few frames or when debounce time has passed
 if (now - lastUpdateRef.current >= debounceMs || pendingUpdateRef.current) {
 pendingUpdateRef.current = false;
 lastUpdateRef.current = now;
 calculateVisibleNodes();
 }
 });

 // Recalculate when nodes change
 useEffect(() => {
 requestAnimationFrame(() => calculateVisibleNodes());
 }, [nodes, calculateVisibleNodes]);

 // Check if specific node is visible
 const isNodeVisible = useCallback(
 (nodeId: string): boolean => {
 if (!enabled) return true;
 return visibleNodeIds.has(nodeId);
 },
 [enabled, visibleNodeIds]
 );

 // Calculate state
 const state: FrustumCullingState = useMemo(
 () => ({
 visibleNodeIds,
 totalNodes: nodes.length,
 visibleCount: visibleNodeIds.size,
 visibilityRatio: nodes.length > 0 ? visibleNodeIds.size / nodes.length : 1,
 isActive: enabled,
 }),
 [visibleNodeIds, nodes.length, enabled]
 );

 return {
 state,
 isNodeVisible,
 recalculate,
 setEnabled,
 };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate optimal grid cell size based on scene bounds
 */
function calculateOptimalCellSize(nodes: VoxelNode[], targetCellCount = 100): number {
 if (nodes.length === 0) return 20;

 // Find scene bounds
 let minX = Infinity,
 minY = Infinity,
 minZ = Infinity;
 let maxX = -Infinity,
 maxY = -Infinity,
 maxZ = -Infinity;

 for (const node of nodes) {
 const pos = node.position;
 const x = typeof pos.x === 'number' ? pos.x : 0;
 const y = typeof pos.y === 'number' ? pos.y : 0;
 const z = typeof pos.z === 'number' ? pos.z : 0;

 minX = Math.min(minX, x);
 minY = Math.min(minY, y);
 minZ = Math.min(minZ, z);
 maxX = Math.max(maxX, x);
 maxY = Math.max(maxY, y);
 maxZ = Math.max(maxZ, z);
 }

 const sizeX = maxX - minX || 1;
 const sizeY = maxY - minY || 1;
 const sizeZ = maxZ - minZ || 1;

 // Calculate cell size to achieve target cell count
 const volume = sizeX * sizeY * sizeZ;
 const cellVolume = volume / targetCellCount;
 const cellSize = Math.cbrt(cellVolume);

 // Clamp to reasonable range
 return Math.max(5, Math.min(50, cellSize));
}

/**
 * Get culling efficiency statistics
 */
function getCullingStats(state: FrustumCullingState): {
 efficiency: string;
 savedNodes: number;
 recommendation: string;
} {
 const culledNodes = state.totalNodes - state.visibleCount;
 const efficiency = ((culledNodes / Math.max(1, state.totalNodes)) * 100).toFixed(1);

 let recommendation = 'Culling is working optimally.';
 if (state.visibilityRatio > 0.9) {
 recommendation = 'Most nodes are visible. Consider zooming out or using LOD.';
 } else if (state.visibilityRatio < 0.2) {
 recommendation = 'Heavy culling active. Consider reducing scene complexity.';
 }

 return {
 efficiency: `${efficiency}%`,
 savedNodes: culledNodes,
 recommendation,
 };
}

export default useFrustumCulling;
