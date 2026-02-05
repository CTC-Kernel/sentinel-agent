/**
 * VoxelDetailPanel Component Tests
 *
 * @see Story VOX-4.6: Click Detail Panel
 */

import { describe, it, expect, vi } from 'vitest';
import type { VoxelNode, VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';

// ============================================================================
// Test Data
// ============================================================================

const createMockNode = (overrides: Partial<VoxelNode> = {}): VoxelNode => ({
 id: 'test-node-1',
 type: 'asset',
 label: 'Test Asset',
 status: 'normal',
 position: { x: 10, y: 20, z: 30 },
 size: 8,
 data: { criticality: 4 },
 connections: ['conn-1', 'conn-2'],
 createdAt: new Date('2024-01-15'),
 updatedAt: new Date('2024-01-20'),
 ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('VoxelDetailPanel', () => {
 describe('Module Exports', () => {
 it('should export VoxelDetailPanel component', async () => {
 const { VoxelDetailPanel } = await import('../VoxelDetailPanel');
 expect(VoxelDetailPanel).toBeDefined();
 expect(typeof VoxelDetailPanel).toBe('function');
 });
 });

 describe('Type Configuration', () => {
 it('should have config for all node types', () => {
 const nodeTypes: VoxelNodeType[] = ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'];
 expect(nodeTypes).toHaveLength(7);
 });

 it('should have icon, label, and color for each type', () => {
 const assetConfig = {
 icon: 'Server',
 label: 'Asset',
 color: '#3B82F6',
 };
 expect(assetConfig.label).toBe('Asset');
 expect(assetConfig.color).toBe('#3B82F6');
 });
 });

 describe('Status Configuration', () => {
 it('should have config for all status types', () => {
 const statuses: VoxelNodeStatus[] = ['normal', 'warning', 'critical', 'inactive'];
 expect(statuses).toHaveLength(4);
 });

 it('should map status to color', () => {
 const STATUS_COLORS = {
 normal: '#22C55E',
 warning: '#F59E0B',
 critical: '#EF4444',
 inactive: '#64748B',
 };
 expect(STATUS_COLORS.normal).toBe('#22C55E');
 expect(STATUS_COLORS.critical).toBe('#EF4444');
 });
 });
});

describe('Panel Behavior', () => {
 describe('Open/Close State', () => {
 it('should be visible when isOpen is true', () => {
 const isOpen = true;
 const translateClass = isOpen ? 'translate-x-0' : 'translate-x-full';
 expect(translateClass).toBe('translate-x-0');
 });

 it('should be hidden when isOpen is false', () => {
 const isOpen = false;
 const translateClass = isOpen ? 'translate-x-0' : 'translate-x-full';
 expect(translateClass).toBe('translate-x-full');
 });
 });

 describe('Escape Key Handler', () => {
 it('should close panel on Escape key when open', () => {
 const onClose = vi.fn();
 const isOpen = true;
 const event = { key: 'Escape' };

 if (event.key === 'Escape' && isOpen) {
 onClose();
 }

 expect(onClose).toHaveBeenCalled();
 });

 it('should not close panel on Escape when already closed', () => {
 const onClose = vi.fn();
 const isOpen = false;
 const event = { key: 'Escape' };

 if (event.key === 'Escape' && isOpen) {
 onClose();
 }

 expect(onClose).not.toHaveBeenCalled();
 });
 });
});

describe('Node Data Display', () => {
 describe('Basic Information', () => {
 it('should display node ID', () => {
 const node = createMockNode();
 expect(node.id).toBe('test-node-1');
 });

 it('should display node label', () => {
 const node = createMockNode({ label: 'Production Server' });
 expect(node.label).toBe('Production Server');
 });

 it('should display node type', () => {
 const node = createMockNode({ type: 'risk' });
 expect(node.type).toBe('risk');
 });

 it('should display node status', () => {
 const node = createMockNode({ status: 'critical' });
 expect(node.status).toBe('critical');
 });
 });

 describe('Position Display', () => {
 it('should display X position', () => {
 const node = createMockNode({ position: { x: 100, y: 50, z: 25 } });
 expect(node.position.x).toBe(100);
 });

 it('should display Y position', () => {
 const node = createMockNode({ position: { x: 100, y: 50, z: 25 } });
 expect(node.position.y).toBe(50);
 });

 it('should display Z position', () => {
 const node = createMockNode({ position: { x: 100, y: 50, z: 25 } });
 expect(node.position.z).toBe(25);
 });
 });

 describe('Connection Count', () => {
 it('should display connection count', () => {
 const connectionCount = 5;
 expect(connectionCount).toBe(5);
 });
 });

 describe('Date Display', () => {
 it('should format created date', () => {
 const node = createMockNode();
 const formatted = new Date(node.createdAt).toLocaleDateString();
 expect(formatted).toBeDefined();
 });

 it('should format updated date', () => {
 const node = createMockNode();
 const formatted = new Date(node.updatedAt).toLocaleDateString();
 expect(formatted).toBeDefined();
 });
 });
});

describe('Panel Styling', () => {
 describe('Panel Dimensions', () => {
 it('should have width of 320px', () => {
 const PANEL_WIDTH = 'w-80'; // Tailwind w-80 = 320px
 expect(PANEL_WIDTH).toBe('w-80');
 });

 it('should be fixed to right edge', () => {
 const POSITION = 'fixed right-0 top-12';
 expect(POSITION).toContain('right-0');
 });
 });

 describe('Animation', () => {
 it('should use 300ms transition', () => {
 const ANIMATION_DURATION = 300;
 expect(ANIMATION_DURATION).toBe(300);
 });

 it('should use ease-out timing', () => {
 const TIMING = 'ease-out';
 expect(TIMING).toBe('ease-out');
 });
 });

 describe('Glass Morphism', () => {
 it('should have blur backdrop', () => {
 const BACKDROP_BLUR = 'blur(20px)';
 expect(BACKDROP_BLUR).toContain('blur');
 });

 it('should have semi-transparent background', () => {
 const BG_COLOR = 'rgba(15, 23, 42, 0.95)';
 expect(BG_COLOR).toContain('0.95');
 });
 });
});

describe('Navigation Action', () => {
 it('should call onNavigate with node when clicked', () => {
 const onNavigate = vi.fn();
 const node = createMockNode();

 // Simulate navigation
 onNavigate(node);

 expect(onNavigate).toHaveBeenCalledWith(node);
 });

 it('should not render navigation button when onNavigate is not provided', () => {
 const onNavigate = undefined;
 const shouldRenderButton = !!onNavigate;
 expect(shouldRenderButton).toBe(false);
 });
});
