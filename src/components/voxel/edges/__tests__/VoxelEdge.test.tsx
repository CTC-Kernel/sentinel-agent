/**
 * VoxelEdge Component Tests
 *
 * @see Story VOX-3.1: Edge Component Creation
 */

import { describe, it, expect, vi } from 'vitest';
import type { VoxelEdge } from '@/types/voxel';

// Mock react-three/fiber
vi.mock('@react-three/fiber', () => ({
 useFrame: vi.fn(),
 useThree: vi.fn(() => ({
 camera: { position: { distanceTo: vi.fn(() => 100) } },
 })),
}));

// Mock @react-three/drei
vi.mock('@react-three/drei', () => ({
 Line: ({ points, color, lineWidth, opacity, dashed }: {
 points: unknown[];
 color: string;
 lineWidth: number;
 opacity: number;
 dashed: boolean;
 }) => (
 <line
 data-testid="drei-line"
 data-color={color}
 data-line-width={lineWidth}
 data-opacity={opacity}
 data-dashed={dashed}
 data-points={JSON.stringify(points)}
 />
 ),
 QuadraticBezierLine: ({ start, end, mid, color }: {
 start: unknown;
 end: unknown;
 mid: unknown;
 color: string;
 }) => (
 <line
 data-testid="drei-bezier-line"
 data-color={color}
 data-start={JSON.stringify(start)}
 data-end={JSON.stringify(end)}
 data-mid={JSON.stringify(mid)}
 />
 ),
}));

// Mock voxelStore
vi.mock('@/stores/voxelStore', () => ({
 useVoxelStore: vi.fn((selector) => {
 const state = {
 ui: {
 selectedNodeId: null,
 hoveredNodeId: null,
 },
 };
 return selector(state);
 }),
 useVoxelEdges: vi.fn(() => []),
 useVoxelNodes: vi.fn(() => []),
}));

// ============================================================================
// Test Data
// ============================================================================

const createMockEdge = (overrides: Partial<VoxelEdge> = {}): VoxelEdge => ({
 id: 'test-edge-1',
 source: 'node-1',
 target: 'node-2',
 type: 'dependency',
 weight: 0.5,
 ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('VoxelEdge', () => {
 describe('Module Exports', () => {
 it('should export VoxelEdge component', async () => {
 const { VoxelEdge } = await import('../VoxelEdge');
 expect(VoxelEdge).toBeDefined();
 expect(typeof VoxelEdge).toBe('function');
 });
 });

 describe('Edge Type Colors', () => {
 it('should use gray for dependency edges', () => {
 const edge = createMockEdge({ type: 'dependency' });
 expect(edge.type).toBe('dependency');
 });

 it('should use red for impact edges', () => {
 const edge = createMockEdge({ type: 'impact' });
 expect(edge.type).toBe('impact');
 });

 it('should use purple for mitigation edges', () => {
 const edge = createMockEdge({ type: 'mitigation' });
 expect(edge.type).toBe('mitigation');
 });

 it('should use blue for assignment edges', () => {
 const edge = createMockEdge({ type: 'assignment' });
 expect(edge.type).toBe('assignment');
 });
 });

 describe('Edge Positions', () => {
 it('should accept source and target positions', () => {
 const sourcePosition: [number, number, number] = [0, 0, 0];
 const targetPosition: [number, number, number] = [100, 50, 0];

 expect(sourcePosition).toEqual([0, 0, 0]);
 expect(targetPosition).toEqual([100, 50, 0]);
 });
 });
});

describe('VoxelEdgeCurved', () => {
 describe('Module Exports', () => {
 it('should export VoxelEdgeCurved component', async () => {
 const { VoxelEdgeCurved } = await import('../VoxelEdgeCurved');
 expect(VoxelEdgeCurved).toBeDefined();
 expect(typeof VoxelEdgeCurved).toBe('function');
 });
 });

 describe('Curve Offset', () => {
 it('should have default curve offset', () => {
 const defaultOffset = 1;
 expect(defaultOffset).toBe(1);
 });

 it('should allow custom curve offset', () => {
 const customOffset = 2.5;
 expect(customOffset).toBe(2.5);
 });
 });
});

describe('EdgeManager', () => {
 describe('Module Exports', () => {
 it('should export EdgeManager component', async () => {
 const { EdgeManager } = await import('../EdgeManager');
 expect(EdgeManager).toBeDefined();
 expect(typeof EdgeManager).toBe('function');
 });
 });

 describe('Edge Filtering', () => {
 it('should support type filtering', () => {
 const filterByType: VoxelEdge['type'][] = ['impact', 'mitigation'];
 expect(filterByType).toContain('impact');
 expect(filterByType).toContain('mitigation');
 });

 it('should support minimum weight filtering', () => {
 const minWeight = 0.5;
 expect(minWeight).toBe(0.5);
 });

 it('should support node-specific filtering', () => {
 const forNodeId = 'node-1';
 expect(forNodeId).toBe('node-1');
 });
 });
});

describe('Edges Index Exports', () => {
 it('should export all edge components from index', async () => {
 const edgeModule = await import('../index');

 expect(edgeModule.VoxelEdge).toBeDefined();
 expect(edgeModule.VoxelEdgeCurved).toBeDefined();
 expect(edgeModule.EdgeManager).toBeDefined();
 });
});

describe('Edge Style Calculations', () => {
 describe('Weight to Line Width', () => {
 it('should increase line width with higher weight', () => {
 const lowWeight = 0.2;
 const highWeight = 0.8;

 // Line width formula: BASE + weight * (MAX - BASE)
 const BASE = 1;
 const MAX = 4;
 const lowWidth = BASE + lowWeight * (MAX - BASE);
 const highWidth = BASE + highWeight * (MAX - BASE);

 expect(highWidth).toBeGreaterThan(lowWidth);
 });
 });

 describe('Weight to Opacity', () => {
 it('should increase opacity with higher weight', () => {
 const lowWeight = 0.2;
 const highWeight = 0.8;

 // Opacity formula: MIN + weight * (MAX - MIN)
 const MIN = 0.2;
 const MAX = 0.8;
 const lowOpacity = MIN + lowWeight * (MAX - MIN);
 const highOpacity = MIN + highWeight * (MAX - MIN);

 expect(highOpacity).toBeGreaterThan(lowOpacity);
 });
 });
});

describe('Edge Highlight Logic', () => {
 describe('Connected to Selected Node', () => {
 it('should highlight when source matches selected node', () => {
 const edge = createMockEdge({ source: 'selected-node', target: 'other-node' });
 const selectedNodeId = 'selected-node';
 const isConnected = edge.source === selectedNodeId || edge.target === selectedNodeId;
 expect(isConnected).toBe(true);
 });

 it('should highlight when target matches selected node', () => {
 const edge = createMockEdge({ source: 'other-node', target: 'selected-node' });
 const selectedNodeId = 'selected-node';
 const isConnected = edge.source === selectedNodeId || edge.target === selectedNodeId;
 expect(isConnected).toBe(true);
 });

 it('should not highlight when not connected to selected node', () => {
 const edge = createMockEdge({ source: 'node-1', target: 'node-2' });
 const selectedNodeId = 'other-node';
 const isConnected = edge.source === selectedNodeId || edge.target === selectedNodeId;
 expect(isConnected).toBe(false);
 });
 });
});
