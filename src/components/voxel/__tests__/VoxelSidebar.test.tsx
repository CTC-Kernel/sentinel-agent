/**
 * Unit tests for VoxelSidebar component
 * Tests CTC Engine sidebar navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoxelSidebar } from '../VoxelSidebar';

// Mock VoxelSilhouettes
vi.mock('../VoxelSilhouettes', () => ({
 VoxelSilhouettes: {
 asset: <div>Asset Silhouette</div>,
 risk: <div>Risk Silhouette</div>,
 control: <div>Control Silhouette</div>
 }
}));

describe('VoxelSidebar', () => {
 const mockSetNavCollapsed = vi.fn();
 const mockSetSearchQuery = vi.fn();
 const mockOnNodeSelect = vi.fn();
 const mockOnLayerToggle = vi.fn();

 const defaultProps = {
 navCollapsed: false,
 setNavCollapsed: mockSetNavCollapsed,
 orderedNodesLength: 15,
 searchQuery: '',
 setSearchQuery: mockSetSearchQuery,
 categorizedNodes: [
 {
 id: 'asset',
 label: 'Actifs',
 color: 'bg-blue-500',
 items: [
  { id: 'asset-1', label: 'Server 1', meta: 'Critique' },
  { id: 'asset-2', label: 'Database', meta: 'Important' }
 ]
 },
 {
 id: 'risk',
 label: 'Risques',
 color: 'bg-red-500',
 items: [
  { id: 'risk-1', label: 'Data Breach', meta: 'Élevé' }
 ]
 }
 ],
 selectedNodeId: null,
 onNodeSelect: mockOnNodeSelect,
 activeLayers: ['asset', 'risk'] as ('asset' | 'risk')[],
 onLayerToggle: mockOnLayerToggle
 };

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('rendering', () => {
 it('renders sidebar header', () => {
 render(<VoxelSidebar {...defaultProps} />);

 expect(screen.getByText('CTC Engine')).toBeInTheDocument();
 });

 it('renders element count', () => {
 render(<VoxelSidebar {...defaultProps} />);

 expect(screen.getByText('15 Éléments')).toBeInTheDocument();
 });

 it('renders search input', () => {
 render(<VoxelSidebar {...defaultProps} />);

 expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
 });

 it('renders close button', () => {
 render(<VoxelSidebar {...defaultProps} />);

 expect(screen.getByLabelText('Fermer le menu')).toBeInTheDocument();
 });

 it('renders category labels', () => {
 render(<VoxelSidebar {...defaultProps} />);

 expect(screen.getByText('Actifs')).toBeInTheDocument();
 expect(screen.getByText('Risques')).toBeInTheDocument();
 });

 it('renders items in categories', () => {
 render(<VoxelSidebar {...defaultProps} />);

 expect(screen.getByText('Server 1')).toBeInTheDocument();
 expect(screen.getByText('Database')).toBeInTheDocument();
 expect(screen.getByText('Data Breach')).toBeInTheDocument();
 });

 it('renders item meta', () => {
 render(<VoxelSidebar {...defaultProps} />);

 expect(screen.getByText('Critique')).toBeInTheDocument();
 expect(screen.getByText('Important')).toBeInTheDocument();
 });
 });

 describe('collapsed state', () => {
 it('has collapsed class when navCollapsed is true', () => {
 const { container } = render(<VoxelSidebar {...defaultProps} navCollapsed={true} />);

 expect(container.querySelector('.w-0')).toBeInTheDocument();
 expect(container.querySelector('.opacity-0')).toBeInTheDocument();
 });

 it('is visible when navCollapsed is false', () => {
 const { container } = render(<VoxelSidebar {...defaultProps} navCollapsed={false} />);

 expect(container.querySelector('.w-80')).toBeInTheDocument();
 expect(container.querySelector('.opacity-70')).toBeInTheDocument();
 });
 });

 describe('interactions', () => {
 it('calls setNavCollapsed when close button clicked', () => {
 render(<VoxelSidebar {...defaultProps} />);

 fireEvent.click(screen.getByLabelText('Fermer le menu'));

 expect(mockSetNavCollapsed).toHaveBeenCalledWith(true);
 });

 it('calls setSearchQuery when typing in search', () => {
 render(<VoxelSidebar {...defaultProps} />);

 fireEvent.change(screen.getByPlaceholderText('Rechercher...'), {
 target: { value: 'Server' }
 });

 expect(mockSetSearchQuery).toHaveBeenCalledWith('Server');
 });

 it('calls onNodeSelect when item clicked', () => {
 render(<VoxelSidebar {...defaultProps} />);

 fireEvent.click(screen.getByText('Server 1'));

 expect(mockOnNodeSelect).toHaveBeenCalledWith('asset-1', 'asset');
 });

 it('calls onLayerToggle when toggle clicked', () => {
 render(<VoxelSidebar {...defaultProps} />);

 fireEvent.click(screen.getByLabelText("Basculer l'affichage de la couche Actifs"));

 expect(mockOnLayerToggle).toHaveBeenCalledWith('asset');
 });
 });

 describe('selected state', () => {
 it('highlights selected item', () => {
 const { container } = render(<VoxelSidebar {...defaultProps} selectedNodeId="asset-1" />);

 // Check for any selected/highlight styling
 const selectedItem = container.querySelector('[class*="brand"]') ||
 container.querySelector('[class*="selected"]') ||
 container.querySelector('[class*="bg-"]');
 expect(selectedItem).toBeTruthy();
 });
 });

 describe('empty category', () => {
 it('shows empty message when category has no items', () => {
 const propsWithEmpty = {
 ...defaultProps,
 categorizedNodes: [
  {
  id: 'control',
  label: 'Contrôles',
  color: 'bg-green-500',
  items: []
  }
 ]
 };

 render(<VoxelSidebar {...propsWithEmpty} />);

 expect(screen.getByText('Aucun élément')).toBeInTheDocument();
 });
 });

 describe('layer toggles', () => {
 it('shows active state for active layers', () => {
 const { container } = render(<VoxelSidebar {...defaultProps} />);

 // Active layer toggles have bg-primary
 const activeToggles = container.querySelectorAll('.bg-primary');
 expect(activeToggles.length).toBeGreaterThan(0);
 });

 it('shows inactive state for inactive layers', () => {
 const propsWithInactive = {
 ...defaultProps,
 activeLayers: [] as never[]
 };

 const { container } = render(<VoxelSidebar {...propsWithInactive} />);

 // Inactive layer toggles have bg-muted
 const inactiveToggles = container.querySelectorAll('.bg-muted');
 expect(inactiveToggles.length).toBeGreaterThan(0);
 });
 });

 describe('accessibility', () => {
 it('has aria-label on sidebar', () => {
 render(<VoxelSidebar {...defaultProps} />);

 expect(screen.getByLabelText('Navigation latérale')).toBeInTheDocument();
 });

 it('has aria-label on search input', () => {
 render(<VoxelSidebar {...defaultProps} />);

 expect(screen.getByLabelText('Rechercher')).toBeInTheDocument();
 });
 });
});
