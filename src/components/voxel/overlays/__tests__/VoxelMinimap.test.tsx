/**
 * VoxelMinimap Tests
 *
 * @see Story VOX-9.5: Minimap Navigation
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoxelMinimap } from '../VoxelMinimap';
import type { VoxelNode } from '@/types/voxel';

// ============================================================================
// Mocks
// ============================================================================

// Mock canvas context
beforeAll(() => {
 HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
 clearRect: vi.fn(),
 fillRect: vi.fn(),
 strokeRect: vi.fn(),
 fillText: vi.fn(),
 beginPath: vi.fn(),
 moveTo: vi.fn(),
 lineTo: vi.fn(),
 arc: vi.fn(),
 stroke: vi.fn(),
 fill: vi.fn(),
 drawImage: vi.fn(),
 save: vi.fn(),
 restore: vi.fn(),
 scale: vi.fn(),
 translate: vi.fn(),
 rotate: vi.fn(),
 measureText: vi.fn(() => ({ width: 0 })),
 fillStyle: '',
 strokeStyle: '',
 lineWidth: 1,
 shadowColor: '',
 shadowBlur: 0,
 shadowOffsetX: 0,
 shadowOffsetY: 0,
 font: '',
 textAlign: 'left',
 })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const mockNodes = new Map<string, VoxelNode>([
 [
 'asset-1',
 {
 id: 'asset-1',
 type: 'asset',
 label: 'Test Asset',
 position: { x: 10, y: 0, z: 20 },
 status: 'normal',
 size: 1,
 data: {},
 connections: [],
 createdAt: new Date(Date.now()),
 updatedAt: new Date(Date.now()),
 },
 ],
 [
 'risk-1',
 {
 id: 'risk-1',
 type: 'risk',
 label: 'Test Risk',
 position: { x: -30, y: 0, z: 40 },
 status: 'critical',
 size: 1,
 data: {},
 connections: [],
 createdAt: new Date(Date.now()),
 updatedAt: new Date(Date.now()),
 },
 ],
 [
 'control-1',
 {
 id: 'control-1',
 type: 'control',
 label: 'Test Control',
 position: { x: 50, y: 0, z: -10 },
 status: 'normal',
 size: 1,
 data: {},
 connections: [],
 createdAt: new Date(Date.now()),
 updatedAt: new Date(Date.now()),
 },
 ],
]);

vi.mock('@/stores/voxelStore', () => ({
 useVoxelStore: vi.fn((selector) => {
 const state = {
 nodes: mockNodes,
 ui: {
 selectedNodeId: null,
 },
 };
 return selector(state);
 }),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
 X: () => <span data-testid="icon-x">X</span>,
 Map: () => <span data-testid="icon-map">Map</span>,
 Maximize2: () => <span data-testid="icon-maximize">Maximize</span>,
 Minimize2: () => <span data-testid="icon-minimize">Minimize</span>,
}));

// ============================================================================
// Tests
// ============================================================================

describe('VoxelMinimap', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('Rendering', () => {
 it('should render when visible', () => {
 render(<VoxelMinimap visible={true} />);

 expect(screen.getByText('Minimap')).toBeInTheDocument();
 expect(screen.getByLabelText(/3D scene minimap/)).toBeInTheDocument();
 });

 it('should render toggle button when not visible', () => {
 const onToggle = vi.fn();
 render(<VoxelMinimap visible={false} onToggle={onToggle} />);

 expect(screen.queryByText('Minimap')).not.toBeInTheDocument();
 expect(screen.getByRole('button', { name: 'Show minimap' })).toBeInTheDocument();
 });

 it('should apply custom className', () => {
 const { container } = render(<VoxelMinimap visible={true} className="custom-class" />);

 expect(container.firstChild).toHaveClass('custom-class');
 });

 it('should use default dimensions', () => {
 render(<VoxelMinimap visible={true} />);

 const canvas = screen.getByLabelText(/3D scene minimap/);
 expect(canvas).toHaveAttribute('width', '160');
 expect(canvas).toHaveAttribute('height', '120');
 });

 it('should accept custom dimensions', () => {
 render(<VoxelMinimap visible={true} width={200} height={150} />);

 const canvas = screen.getByLabelText(/3D scene minimap/);
 expect(canvas).toHaveAttribute('width', '200');
 expect(canvas).toHaveAttribute('height', '150');
 });
 });

 describe('Visibility Toggle', () => {
 it('should call onToggle when toggle button clicked (hidden state)', () => {
 const onToggle = vi.fn();
 render(<VoxelMinimap visible={false} onToggle={onToggle} />);

 fireEvent.click(screen.getByRole('button', { name: 'Show minimap' }));
 expect(onToggle).toHaveBeenCalledTimes(1);
 });

 it('should call onToggle when close button clicked (visible state)', () => {
 const onToggle = vi.fn();
 render(<VoxelMinimap visible={true} onToggle={onToggle} />);

 fireEvent.click(screen.getByRole('button', { name: 'Hide minimap' }));
 expect(onToggle).toHaveBeenCalledTimes(1);
 });
 });

 describe('Expand/Minimize', () => {
 it('should toggle expanded state when expand button clicked', () => {
 render(<VoxelMinimap visible={true} />);

 const expandButton = screen.getByRole('button', { name: 'Expand minimap' });
 fireEvent.click(expandButton);

 expect(screen.getByRole('button', { name: 'Minimize minimap' })).toBeInTheDocument();
 });
 });

 describe('Navigation', () => {
 it('should call onNavigate when canvas is clicked', () => {
 const onNavigate = vi.fn();
 render(<VoxelMinimap visible={true} onNavigate={onNavigate} />);

 const canvas = screen.getByLabelText(/3D scene minimap/);
 fireEvent.click(canvas, { clientX: 80, clientY: 60 });

 expect(onNavigate).toHaveBeenCalledWith(
 expect.objectContaining({
 x: expect.any(Number),
 y: expect.any(Number),
 z: expect.any(Number),
 })
 );
 });

 it('should not call onNavigate if handler not provided', () => {
 render(<VoxelMinimap visible={true} />);

 const canvas = screen.getByLabelText(/3D scene minimap/);
 expect(() => fireEvent.click(canvas, { clientX: 80, clientY: 60 })).not.toThrow();
 });
 });

 describe('Camera Position', () => {
 it('should render viewport indicator when camera position provided', () => {
 render(<VoxelMinimap visible={true} cameraPosition={[0, 50, 0]} />);

 expect(screen.getByLabelText(/3D scene minimap/)).toBeInTheDocument();
 });

 it('should render direction indicator when both position and target provided', () => {
 render(
 <VoxelMinimap visible={true} cameraPosition={[0, 50, 0]} cameraTarget={[10, 0, 10]} />
 );

 expect(screen.getByLabelText(/3D scene minimap/)).toBeInTheDocument();
 });
 });

 describe('Node Count Display', () => {
 it('should display node count on hover', () => {
 const { container } = render(<VoxelMinimap visible={true} />);

 fireEvent.mouseEnter(container.firstChild as Element);

 expect(screen.getByText(/3 nodes/)).toBeInTheDocument();
 });
 });
});
