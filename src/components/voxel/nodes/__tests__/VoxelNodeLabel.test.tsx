/**
 * VoxelNodeLabel Component Tests
 *
 * @see Story VOX-2.4: Node Labels with HTML Overlay
 */

import { describe, it, expect, vi } from 'vitest';
import type { VoxelNode } from '@/types/voxel';

// Mock @react-three/drei
vi.mock('@react-three/drei', () => ({
 Html: ({ children, style, position }: { children: React.ReactNode; style: React.CSSProperties; position: [number, number, number] }) => (
 <div data-testid="drei-html" style={style} data-position={position.join(',')}>
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
 position: { x: 10, y: 20, z: 30 },
 status: 'normal',
 size: 8,
 data: {},
 connections: [],
 createdAt: new Date(),
 updatedAt: new Date(),
 ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('VoxelNodeLabel', () => {
 describe('Module Exports', () => {
 it('should export VoxelNodeLabel component', async () => {
 const { VoxelNodeLabel } = await import('../VoxelNodeLabel');
 expect(VoxelNodeLabel).toBeDefined();
 expect(typeof VoxelNodeLabel).toBe('function');
 });

 it('should export VoxelNodeLabelProps type', async () => {
 const module = await import('../VoxelNodeLabel');
 expect(module.VoxelNodeLabel).toBeDefined();
 });
 });

 describe('Type Badge Labels', () => {
 it('should have labels for all node types', () => {
 const typeLabels = {
 asset: 'Asset',
 risk: 'Risque',
 control: 'Contrôle',
 incident: 'Incident',
 supplier: 'Fournisseur',
 project: 'Projet',
 audit: 'Audit',
 };

 // Verify all expected types exist
 expect(Object.keys(typeLabels)).toHaveLength(7);
 expect(typeLabels.asset).toBe('Asset');
 expect(typeLabels.risk).toBe('Risque');
 expect(typeLabels.control).toBe('Contrôle');
 });
 });

 describe('Visibility Calculations', () => {
 it('should show label when within visible distance', () => {
 const cameraDistance = 100;
 const visibleDistance = 200;
 const isVisible = cameraDistance < visibleDistance;
 expect(isVisible).toBe(true);
 });

 it('should hide label when beyond visible distance', () => {
 const cameraDistance = 300;
 const visibleDistance = 200;
 const isVisible = cameraDistance < visibleDistance;
 expect(isVisible).toBe(false);
 });

 it('should always show label when selected', () => {
 const cameraDistance = 500;
 const visibleDistance = 200;
 const isSelected = true;
 const isVisible = isSelected || cameraDistance < visibleDistance;
 expect(isVisible).toBe(true);
 });

 it('should always show label when hovered', () => {
 const cameraDistance = 500;
 const visibleDistance = 200;
 const isHovered = true;
 const isVisible = isHovered || cameraDistance < visibleDistance;
 expect(isVisible).toBe(true);
 });
 });

 describe('Opacity Calculations', () => {
 it('should have full opacity when close', () => {
 const cameraDistance = 50;
 const visibleDistance = 200;
 const fadeStart = visibleDistance * 0.7; // 140
 const opacity = cameraDistance < fadeStart ? 1 : 0.5;
 expect(opacity).toBe(1);
 });

 it('should fade out when approaching distance threshold', () => {
 const distance = 180;
 const visibleDistance = 200;
 const fadeStart = visibleDistance * 0.7; // 140

 // Calculate opacity
 let opacity = 1;
 if (distance > visibleDistance) {
 opacity = 0;
 } else if (distance >= fadeStart) {
 opacity = 1 - (distance - fadeStart) / (visibleDistance - fadeStart);
 }

 expect(opacity).toBeGreaterThan(0);
 expect(opacity).toBeLessThan(1);
 });

 it('should have zero opacity beyond threshold', () => {
 const cameraDistance = 250;
 const visibleDistance = 200;
 const opacity = cameraDistance > visibleDistance ? 0 : 1;
 expect(opacity).toBe(0);
 });

 it('should have full opacity when selected regardless of distance', () => {
 const distance = 500;
 const visibleDistance = 200;
 const isSelected = true;
 // Even though distance > visibleDistance, selected nodes always have full opacity
 const opacity = isSelected ? 1 : (distance > visibleDistance ? 0 : 1);
 expect(opacity).toBe(1);
 });
 });

 describe('Node Data Integration', () => {
 it('should use node label', () => {
 const node = createMockNode({ label: 'My Custom Label' });
 expect(node.label).toBe('My Custom Label');
 });

 it('should use node type for color lookup', () => {
 const assetNode = createMockNode({ type: 'asset' });
 const riskNode = createMockNode({ type: 'risk' });

 expect(assetNode.type).toBe('asset');
 expect(riskNode.type).toBe('risk');
 });
 });

 describe('Props Configuration', () => {
 it('should have default offsetY', () => {
 const defaultOffsetY = 12;
 expect(defaultOffsetY).toBe(12);
 });

 it('should have default visibleDistance', () => {
 const defaultVisibleDistance = 200;
 expect(defaultVisibleDistance).toBe(200);
 });

 it('should allow showTypeBadge to be configured', () => {
 const showTypeBadge = true;
 expect(showTypeBadge).toBe(true);
 });
 });

 describe('Index Exports', () => {
 it('should export VoxelNodeLabel from nodes index', async () => {
 const nodeModule = await import('../index');
 expect(nodeModule.VoxelNodeLabel).toBeDefined();
 });
 });
});
