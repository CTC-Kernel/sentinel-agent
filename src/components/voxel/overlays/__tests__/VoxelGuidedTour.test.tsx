/**
 * VoxelGuidedTour Tests
 *
 * @see Story VOX-9.3: Mode Guidé
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoxelGuidedTour, type TourStop } from '../VoxelGuidedTour';
import type { VoxelNode } from '@/types/voxel';

// ============================================================================
// Mocks
// ============================================================================

const mockNodes = new Map<string, VoxelNode>([
 [
 'asset-1',
 {
 id: 'asset-1',
 type: 'asset',
 label: 'Primary Server',
 position: { x: 10, y: 0, z: 20 },
 status: 'normal',
 size: 1,
 data: {},
 connections: ['risk-1', 'control-1'],
 createdAt: new Date(),
 updatedAt: new Date(),
 },
 ],
 [
 'risk-1',
 {
 id: 'risk-1',
 type: 'risk',
 label: 'Critical Vulnerability',
 position: { x: -30, y: 0, z: 40 },
 status: 'critical',
 size: 1,
 data: {},
 connections: ['asset-1'],
 createdAt: new Date(),
 updatedAt: new Date(),
 },
 ],
 [
 'control-1',
 {
 id: 'control-1',
 type: 'control',
 label: 'Firewall Policy',
 position: { x: 50, y: 0, z: -10 },
 status: 'normal',
 size: 1,
 data: {},
 connections: ['asset-1'],
 createdAt: new Date(),
 updatedAt: new Date(),
 },
 ],
]);

const mockSelectNode = vi.fn();

vi.mock('@/stores/voxelStore', () => ({
 useVoxelStore: vi.fn((selector) => {
 const state = {
 nodes: mockNodes,
 ui: { selectedNodeId: null },
 selectNode: mockSelectNode,
 };
 return selector(state);
 }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
 Play: () => <span data-testid="icon-play">Play</span>,
 Pause: () => <span data-testid="icon-pause">Pause</span>,
 SkipForward: () => <span data-testid="icon-skip">Skip</span>,
 X: () => <span data-testid="icon-x">X</span>,
 ChevronLeft: () => <span data-testid="icon-prev">Prev</span>,
 ChevronRight: () => <span data-testid="icon-next">Next</span>,
 MapPin: () => <span data-testid="icon-map">Map</span>,
 AlertTriangle: () => <span data-testid="icon-alert">Alert</span>,
 Shield: () => <span data-testid="icon-shield">Shield</span>,
 Server: () => <span data-testid="icon-server">Server</span>,
 CheckCircle: () => <span data-testid="icon-check">Check</span>,
}));

// ============================================================================
// Test Data
// ============================================================================

const customStops: TourStop[] = [
 {
 id: 'stop-1',
 title: 'First Stop',
 description: 'Description for first stop',
 targetPosition: [0, 0, 0],
 icon: 'location',
 },
 {
 id: 'stop-2',
 title: 'Second Stop',
 description: 'Description for second stop',
 targetPosition: [10, 0, 10],
 icon: 'risk',
 highlightNodeId: 'risk-1',
 },
 {
 id: 'stop-3',
 title: 'Final Stop',
 description: 'Description for final stop',
 targetPosition: [20, 0, 20],
 icon: 'check',
 },
];

// ============================================================================
// Tests
// ============================================================================

describe('VoxelGuidedTour', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('Start Screen', () => {
 it('should show start screen initially', () => {
 render(<VoxelGuidedTour visible={true} stops={customStops} />);

 expect(screen.getByText('Guided Tour')).toBeInTheDocument();
 expect(screen.getByText('Start Tour')).toBeInTheDocument();
 });

 it('should have skip button on start screen', () => {
 const onClose = vi.fn();
 render(<VoxelGuidedTour visible={true} stops={customStops} onClose={onClose} />);

 // On the start screen, Skip is a simple button with just text
 const skipButton = screen.getByRole('button', { name: 'Skip' });
 fireEvent.click(skipButton);
 expect(onClose).toHaveBeenCalled();
 });

 it('should start tour when clicking Start Tour', () => {
 render(<VoxelGuidedTour visible={true} stops={customStops} />);

 fireEvent.click(screen.getByText('Start Tour'));

 expect(screen.getByText('First Stop')).toBeInTheDocument();
 expect(screen.getByText('Description for first stop')).toBeInTheDocument();
 });
 });

 describe('Tour Navigation', () => {
 it('should show first stop after starting', () => {
 render(<VoxelGuidedTour visible={true} stops={customStops} />);
 fireEvent.click(screen.getByText('Start Tour'));

 expect(screen.getByText('First Stop')).toBeInTheDocument();
 expect(screen.getByText('1 / 3')).toBeInTheDocument();
 });

 it('should navigate to next stop', () => {
 render(<VoxelGuidedTour visible={true} stops={customStops} />);
 fireEvent.click(screen.getByText('Start Tour'));

 fireEvent.click(screen.getByRole('button', { name: /Arrêt suivant|suivant/i }));

 expect(screen.getByText('Second Stop')).toBeInTheDocument();
 expect(screen.getByText('2 / 3')).toBeInTheDocument();
 });

 it('should navigate to previous stop', () => {
 render(<VoxelGuidedTour visible={true} stops={customStops} />);
 fireEvent.click(screen.getByText('Start Tour'));
 fireEvent.click(screen.getByRole('button', { name: /Arrêt suivant|suivant/i }));

 fireEvent.click(screen.getByRole('button', { name: /Arrêt précédent|précédent/i }));

 expect(screen.getByText('First Stop')).toBeInTheDocument();
 });

 it('should disable previous button on first stop', () => {
 render(<VoxelGuidedTour visible={true} stops={customStops} />);
 fireEvent.click(screen.getByText('Start Tour'));

 const prevButton = screen.getByRole('button', { name: /Arrêt précédent|précédent/i });
 expect(prevButton).toBeDisabled();
 });

 it('should call onNavigate when navigating', () => {
 const onNavigate = vi.fn();
 render(<VoxelGuidedTour visible={true} stops={customStops} onNavigate={onNavigate} />);
 fireEvent.click(screen.getByText('Start Tour'));

 fireEvent.click(screen.getByRole('button', { name: /Arrêt suivant|suivant/i }));

 expect(onNavigate).toHaveBeenCalledWith(customStops[1]);
 });

 it('should highlight node when stop has highlightNodeId', () => {
 render(<VoxelGuidedTour visible={true} stops={customStops} />);
 fireEvent.click(screen.getByText('Start Tour'));
 fireEvent.click(screen.getByRole('button', { name: /Arrêt suivant|suivant/i }));

 expect(mockSelectNode).toHaveBeenCalledWith('risk-1');
 });
 });

 describe('Tour Controls', () => {
 it('should toggle play/pause', () => {
 render(<VoxelGuidedTour visible={true} stops={customStops} />);
 fireEvent.click(screen.getByText('Start Tour'));

 // Initially playing
 expect(screen.getByTestId('icon-pause')).toBeInTheDocument();

 // Toggle to pause
 fireEvent.click(screen.getByRole('button', { name: /Mettre en pause|pause/i }));
 expect(screen.getByTestId('icon-play')).toBeInTheDocument();
 });

 it('should skip tour and call onComplete', () => {
 const onComplete = vi.fn();
 render(<VoxelGuidedTour visible={true} stops={customStops} onComplete={onComplete} />);
 fireEvent.click(screen.getByText('Start Tour'));

 // Use getAllByText and click the button (not the icon)
 const skipButtons = screen.getAllByText('Skip');
 const skipButton = skipButtons.find((el) => el.tagName === 'BUTTON');
 if (skipButton) fireEvent.click(skipButton);

 expect(onComplete).toHaveBeenCalled();
 });

 it('should close tour when clicking X', () => {
 const onClose = vi.fn();
 render(<VoxelGuidedTour visible={true} stops={customStops} onClose={onClose} />);
 fireEvent.click(screen.getByText('Start Tour'));

 fireEvent.click(screen.getByRole('button', { name: /Fermer la visite|Fermer/i }));

 expect(onClose).toHaveBeenCalled();
 });
 });

 describe('Tour Completion', () => {
 it('should call onComplete when finishing last stop', () => {
 const onComplete = vi.fn();
 render(<VoxelGuidedTour visible={true} stops={customStops} onComplete={onComplete} />);
 fireEvent.click(screen.getByText('Start Tour'));

 // Navigate to last stop
 fireEvent.click(screen.getByRole('button', { name: /Arrêt suivant|suivant/i }));
 fireEvent.click(screen.getByRole('button', { name: /Arrêt suivant|suivant/i }));

 // Click next on last stop
 fireEvent.click(screen.getByRole('button', { name: /Terminer la visite|Terminer/i }));

 expect(onComplete).toHaveBeenCalled();
 });
 });

 describe('Visibility', () => {
 it('should not render when not visible', () => {
 const { container } = render(<VoxelGuidedTour visible={false} stops={customStops} />);
 expect(container.firstChild).toBeNull();
 });

 it('should not render when no stops', () => {
 const { container } = render(<VoxelGuidedTour visible={true} stops={[]} />);
 expect(container.firstChild).toBeNull();
 });
 });

 describe('Auto-generated Stops', () => {
 it('should generate stops from nodes when no custom stops provided', () => {
 render(<VoxelGuidedTour visible={true} />);
 fireEvent.click(screen.getByText('Start Tour'));

 // Should have generated stops including critical risks
 expect(screen.getByText('Critical Risks')).toBeInTheDocument();
 });
 });

 describe('Progress Indicator', () => {
 it('should show progress bar', () => {
 render(<VoxelGuidedTour visible={true} stops={customStops} />);
 fireEvent.click(screen.getByText('Start Tour'));

 // Progress bar should be visible (check for progress element)
 const progressBar = document.querySelector('[class*="bg-blue-500"]');
 expect(progressBar).toBeInTheDocument();
 });
 });
});
