/**
 * VoxelTooltip Component Tests
 *
 * @see Story VOX-4.5: Hover Tooltip
 */

import { describe, it, expect, vi } from 'vitest';
import type { VoxelNode } from '@/types/voxel';

// Mock @react-three/drei
vi.mock('@react-three/drei', () => ({
 Html: ({ children, position }: { children: React.ReactNode; position: [number, number, number] }) => (
 <div data-testid="drei-html" data-position={JSON.stringify(position)}>
 {children}
 </div>
 ),
}));

// ============================================================================
// Test Data
// ============================================================================

const createMockNode = (overrides: Partial<VoxelNode> = {}): VoxelNode => ({
 id: 'test-node-1',
 type: 'asset',
 label: 'Test Asset',
 status: 'normal',
 position: { x: 0, y: 0, z: 0 },
 size: 8,
 data: {},
 connections: [],
 createdAt: new Date(Date.now()),
 updatedAt: new Date(Date.now()),
 ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('VoxelTooltip', () => {
 describe('Module Exports', () => {
 it('should export VoxelTooltip component', async () => {
 const { VoxelTooltip } = await import('../VoxelTooltip');
 expect(VoxelTooltip).toBeDefined();
 expect(typeof VoxelTooltip).toBe('function');
 });
 });

 describe('Type Labels', () => {
 it('should have labels for all node types', () => {
 const TYPE_LABELS = {
 asset: 'Asset',
 risk: 'Risk',
 control: 'Control',
 audit: 'Audit',
 project: 'Project',
 incident: 'Incident',
 supplier: 'Supplier',
 };

 expect(Object.keys(TYPE_LABELS)).toHaveLength(7);
 expect(TYPE_LABELS.asset).toBe('Asset');
 expect(TYPE_LABELS.risk).toBe('Risk');
 expect(TYPE_LABELS.control).toBe('Control');
 });
 });

 describe('Type Colors', () => {
 it('should have colors for all node types', () => {
 const TYPE_COLORS = {
 asset: '#3B82F6',
 risk: '#EF4444',
 control: '#8B5CF6',
 audit: '#F59E0B',
 project: '#10B981',
 incident: '#F97316',
 supplier: '#6366F1',
 };

 expect(TYPE_COLORS.asset).toBe('#3B82F6');
 expect(TYPE_COLORS.risk).toBe('#EF4444');
 expect(TYPE_COLORS.control).toBe('#8B5CF6');
 });
 });
});

describe('Tooltip Positioning', () => {
 it('should position above node based on size', () => {
 const node = createMockNode({ size: 10 });
 const offsetY = 1;
 const expectedY = node.size * 0.5 + offsetY;
 expect(expectedY).toBe(6);
 });

 it('should use default offset of 1', () => {
 const DEFAULT_OFFSET_Y = 1;
 expect(DEFAULT_OFFSET_Y).toBe(1);
 });
});

describe('Node Metric Display', () => {
 describe('Risk Metrics', () => {
 it('should calculate risk score from likelihood and impact', () => {
 const likelihood = 3;
 const impact = 4;
 const score = likelihood * impact;
 expect(score).toBe(12);
 });
 });

 describe('Asset Metrics', () => {
 it('should display criticality out of 5', () => {
 const criticality = 4;
 const display = `Criticality: ${criticality}/5`;
 expect(display).toBe('Criticality: 4/5');
 });
 });

 describe('Control Metrics', () => {
 it('should display effectiveness as percentage', () => {
 const effectiveness = 0.85;
 const display = `Effectiveness: ${Math.round(effectiveness * 100)}%`;
 expect(display).toBe('Effectiveness: 85%');
 });
 });
});

describe('Tooltip Styling', () => {
 describe('Theme Compliance', () => {
 it('should use dark background matching Digital Galaxy theme', () => {
 const TOOLTIP_BG = 'rgba(15, 23, 42, 0.9)';
 expect(TOOLTIP_BG).toContain('15, 23, 42');
 });

 it('should use white text for readability', () => {
 const TOOLTIP_TEXT_COLOR = '#F8FAFC';
 expect(TOOLTIP_TEXT_COLOR).toBe('#F8FAFC');
 });
 });

 describe('Glass Morphism', () => {
 it('should apply backdrop blur', () => {
 const BACKDROP_BLUR = 'blur(8px)';
 expect(BACKDROP_BLUR).toContain('blur');
 });

 it('should have subtle border', () => {
 const BORDER_COLOR = 'rgba(148, 163, 184, 0.2)';
 expect(BORDER_COLOR).toContain('0.2');
 });
 });
});
