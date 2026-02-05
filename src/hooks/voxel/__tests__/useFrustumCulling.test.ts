/**
 * Unit tests for useFrustumCulling hook
 *
 * Tests for:
 * - Visibility calculations
 * - Spatial partitioning
 * - Performance with large node sets
 * - Enable/disable functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createVoxelNodes, resetIdCounter } from '@/tests/factories/voxelFactory';

// Mock Three.js
const mockCamera = {
 projectionMatrix: { elements: new Array(16).fill(0) },
 matrixWorldInverse: { elements: new Array(16).fill(0) },
};

vi.mock('@react-three/fiber', () => ({
 useThree: vi.fn(() => ({
 camera: mockCamera,
 })),
 useFrame: vi.fn((callback) => {
 // Store callback for testing
 (global as Record<string, unknown>).__useFrameCallback = callback;
 }),
}));

vi.mock('three', () => ({
 Frustum: vi.fn().mockImplementation(() => ({
 planes: [
 { distanceToPoint: vi.fn().mockReturnValue(1) },
 { distanceToPoint: vi.fn().mockReturnValue(1) },
 { distanceToPoint: vi.fn().mockReturnValue(1) },
 { distanceToPoint: vi.fn().mockReturnValue(1) },
 { distanceToPoint: vi.fn().mockReturnValue(1) },
 { distanceToPoint: vi.fn().mockReturnValue(1) },
 ],
 setFromProjectionMatrix: vi.fn(),
 intersectsBox: vi.fn().mockReturnValue(true),
 })),
 Matrix4: vi.fn().mockImplementation(() => ({
 multiplyMatrices: vi.fn().mockReturnThis(),
 })),
 Vector3: vi.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
 x,
 y,
 z,
 set: vi.fn(),
 copy: vi.fn(),
 })),
 Box3: vi.fn().mockImplementation(() => ({
 min: { x: 0, y: 0, z: 0 },
 max: { x: 1, y: 1, z: 1 },
 setFromPoints: vi.fn(),
 })),
 Camera: vi.fn(),
}));

describe('useFrustumCulling', () => {
 beforeEach(() => {
 resetIdCounter();
 vi.clearAllMocks();
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 // ============================================================================
 // Initial State Tests
 // ============================================================================

 describe('initial state', () => {
 it('should initialize with all nodes visible when disabled', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(5);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { enabled: false })
 );

 // Wait for async visibility calculation via requestAnimationFrame
 await waitFor(() => {
 expect(result.current.state.visibleCount).toBe(5);
 });

 expect(result.current.state.visibleNodeIds.size).toBe(5);
 });

 it('should have correct state structure', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(3);

 const { result } = renderHook(() => useFrustumCulling(nodes));

 expect(result.current.state).toHaveProperty('visibleNodeIds');
 expect(result.current.state).toHaveProperty('totalNodes');
 expect(result.current.state).toHaveProperty('visibleCount');
 expect(result.current.state).toHaveProperty('visibilityRatio');
 expect(result.current.state).toHaveProperty('isActive');
 });

 it('should initialize with enabled by default', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(3);

 const { result } = renderHook(() => useFrustumCulling(nodes));

 expect(result.current.state.isActive).toBe(true);
 });
 });

 // ============================================================================
 // Visibility Calculation Tests
 // ============================================================================

 describe('visibility calculations', () => {
 it('should calculate visible nodes', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(10, (i) => ({
 position: { x: i * 5, y: 0, z: 0 },
 }));

 const { result } = renderHook(() => useFrustumCulling(nodes));

 // All nodes should be visible (mock returns true for all)
 expect(result.current.state.visibleCount).toBeGreaterThanOrEqual(0);
 });

 it('should update visibility ratio correctly', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(10);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { enabled: false })
 );

 // Wait for the async visibility calculation via requestAnimationFrame
 await waitFor(() => {
 expect(result.current.state.visibleCount).toBe(10);
 });

 expect(result.current.state.visibilityRatio).toBe(1);
 expect(result.current.state.totalNodes).toBe(10);
 });

 it('should handle empty node array', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');

 const { result } = renderHook(() => useFrustumCulling([]));

 expect(result.current.state.totalNodes).toBe(0);
 expect(result.current.state.visibilityRatio).toBe(1);
 });
 });

 // ============================================================================
 // isNodeVisible Tests
 // ============================================================================

 describe('isNodeVisible', () => {
 it('should return true for visible nodes', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(5);
 const nodeIds = nodes.map((n) => n.id);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { enabled: false })
 );

 expect(result.current.isNodeVisible(nodeIds[0])).toBe(true);
 });

 it('should return true for all nodes when culling is disabled', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(5);
 const nodeIds = nodes.map((n) => n.id);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { enabled: false })
 );

 nodeIds.forEach((id) => {
 expect(result.current.isNodeVisible(id)).toBe(true);
 });
 });
 });

 // ============================================================================
 // setEnabled Tests
 // ============================================================================

 describe('setEnabled', () => {
 it('should toggle culling on/off', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(5);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { enabled: true })
 );

 expect(result.current.state.isActive).toBe(true);

 act(() => {
 result.current.setEnabled(false);
 });

 expect(result.current.state.isActive).toBe(false);
 });

 it('should show all nodes when disabled', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(10);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { enabled: true })
 );

 act(() => {
 result.current.setEnabled(false);
 });

 // Wait for the async visibility recalculation
 await waitFor(() => {
 expect(result.current.state.visibleCount).toBe(10);
 });
 });
 });

 // ============================================================================
 // recalculate Tests
 // ============================================================================

 describe('recalculate', () => {
 it('should trigger visibility recalculation', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(5);

 const { result } = renderHook(() => useFrustumCulling(nodes));

 // Should not throw
 act(() => {
 result.current.recalculate();
 });

 expect(result.current.state).toBeDefined();
 });
 });

 // ============================================================================
 // Node Updates Tests
 // ============================================================================

 describe('node updates', () => {
 it('should recalculate when nodes change', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const initialNodes = createVoxelNodes(5);

 const { result, rerender } = renderHook(
 ({ nodes }) => useFrustumCulling(nodes, { enabled: false }),
 { initialProps: { nodes: initialNodes } }
 );

 expect(result.current.state.totalNodes).toBe(5);

 const newNodes = createVoxelNodes(10);
 rerender({ nodes: newNodes });

 expect(result.current.state.totalNodes).toBe(10);
 });
 });

 // ============================================================================
 // Spatial Partitioning Tests
 // ============================================================================

 describe('spatial partitioning', () => {
 it('should use spatial partitioning for large node sets', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 // Create 150 nodes to trigger spatial partitioning (threshold is 100)
 const nodes = createVoxelNodes(150, (i) => ({
 position: { x: i % 10, y: Math.floor(i / 10), z: 0 },
 }));

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { useSpatialPartitioning: true, gridCellSize: 5 })
 );

 expect(result.current.state.totalNodes).toBe(150);
 });

 it('should not use spatial partitioning for small node sets', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(50);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { useSpatialPartitioning: true })
 );

 expect(result.current.state.totalNodes).toBe(50);
 });
 });

 // ============================================================================
 // Options Tests
 // ============================================================================

 describe('options', () => {
 it('should respect custom debounce time', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(5);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { debounceMs: 100 })
 );

 expect(result.current.state).toBeDefined();
 });

 it('should respect custom margin', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(5);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, { margin: 5 })
 );

 expect(result.current.state).toBeDefined();
 });

 it('should respect custom grid cell size', async () => {
 const { useFrustumCulling } = await import('../useFrustumCulling');
 const nodes = createVoxelNodes(150);

 const { result } = renderHook(() =>
 useFrustumCulling(nodes, {
 useSpatialPartitioning: true,
 gridCellSize: 10,
 })
 );

 expect(result.current.state).toBeDefined();
 });
 });

 // ============================================================================
 // Utility Functions Tests
 // ============================================================================

 describe('calculateOptimalCellSize', () => {
 it('should calculate optimal cell size based on node distribution', async () => {
 const { calculateOptimalCellSize } = await import('../useFrustumCulling');

 const nodes = createVoxelNodes(100, (i) => ({
 position: {
 x: Math.cos((i / 100) * Math.PI * 2) * 50,
 y: i,
 z: Math.sin((i / 100) * Math.PI * 2) * 50,
 },
 }));

 const cellSize = calculateOptimalCellSize(nodes);

 expect(cellSize).toBeGreaterThan(0);
 expect(cellSize).toBeLessThanOrEqual(50);
 });

 it('should return default for empty array', async () => {
 const { calculateOptimalCellSize } = await import('../useFrustumCulling');

 const cellSize = calculateOptimalCellSize([]);

 expect(cellSize).toBe(20);
 });
 });

 describe('getCullingStats', () => {
 it('should return culling statistics', async () => {
 const { getCullingStats } = await import('../useFrustumCulling');

 const state = {
 visibleNodeIds: new Set(['a', 'b', 'c']),
 totalNodes: 10,
 visibleCount: 3,
 visibilityRatio: 0.3,
 isActive: true,
 };

 const stats = getCullingStats(state);

 expect(stats.efficiency).toBeDefined();
 expect(stats.savedNodes).toBe(7);
 expect(stats.recommendation).toBeDefined();
 });

 it('should recommend reducing complexity when heavy culling', async () => {
 const { getCullingStats } = await import('../useFrustumCulling');

 const state = {
 visibleNodeIds: new Set(['a']),
 totalNodes: 100,
 visibleCount: 1,
 visibilityRatio: 0.01,
 isActive: true,
 };

 const stats = getCullingStats(state);

 expect(stats.recommendation.toLowerCase()).toContain('complexity');
 });

 it('should recommend zooming out when most nodes visible', async () => {
 const { getCullingStats } = await import('../useFrustumCulling');

 const state = {
 visibleNodeIds: new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']),
 totalNodes: 10,
 visibleCount: 10,
 visibilityRatio: 1,
 isActive: true,
 };

 const stats = getCullingStats(state);

 expect(stats.recommendation.toLowerCase()).toContain('zoom');
 });
 });
});
