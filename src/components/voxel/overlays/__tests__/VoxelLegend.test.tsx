/**
 * VoxelLegend Tests
 *
 * @see Story VOX-8.1: Daltonisme-Safe Visuals
 * @see Story VOX-8.3: Text Labels for All Indicators
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoxelLegend } from '../VoxelLegend';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Info: () => <span data-testid="icon-info">Info</span>,
  ChevronDown: () => <span data-testid="icon-chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="icon-chevron-up">ChevronUp</span>,
  Server: () => <span data-testid="icon-server">Server</span>,
  AlertTriangle: () => <span data-testid="icon-alert">Alert</span>,
  Shield: () => <span data-testid="icon-shield">Shield</span>,
  ClipboardCheck: () => <span data-testid="icon-clipboard">Clipboard</span>,
  FolderKanban: () => <span data-testid="icon-folder">Folder</span>,
  Flame: () => <span data-testid="icon-flame">Flame</span>,
  Building2: () => <span data-testid="icon-building">Building</span>,
  Circle: () => <span data-testid="shape-circle">Circle</span>,
  Triangle: () => <span data-testid="shape-triangle">Triangle</span>,
  Square: () => <span data-testid="shape-square">Square</span>,
  Octagon: () => <span data-testid="shape-octagon">Octagon</span>,
  Hexagon: () => <span data-testid="shape-hexagon">Hexagon</span>,
  Diamond: () => <span data-testid="shape-diamond">Diamond</span>,
  Pentagon: () => <span data-testid="shape-pentagon">Pentagon</span>,
}));

describe('VoxelLegend', () => {
  describe('Rendering', () => {
    it('should render in collapsed state by default', () => {
      render(<VoxelLegend />);

      expect(screen.getByText('Legend')).toBeInTheDocument();
      expect(screen.queryByText('Entity Types')).not.toBeInTheDocument();
    });

    it('should render expanded when defaultExpanded is true', () => {
      render(<VoxelLegend defaultExpanded />);

      expect(screen.getByText('Entity Types')).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<VoxelLegend />);

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-label', 'Visualization legend');

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-controls', 'legend-content');
    });
  });

  describe('Expand/Collapse', () => {
    it('should toggle expanded state when clicking header', () => {
      render(<VoxelLegend />);

      const button = screen.getByRole('button');

      // Initially collapsed
      expect(screen.queryByText('Entity Types')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(button);
      expect(screen.getByText('Entity Types')).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'true');

      // Click to collapse
      fireEvent.click(button);
      expect(screen.queryByText('Entity Types')).not.toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Entity Types Section', () => {
    it('should display all entity types with shapes and colors', () => {
      render(<VoxelLegend defaultExpanded />);

      // Check for entity type labels
      expect(screen.getByText('Asset')).toBeInTheDocument();
      expect(screen.getByText('Risk')).toBeInTheDocument();
      expect(screen.getByText('Control')).toBeInTheDocument();
      expect(screen.getByText('Audit')).toBeInTheDocument();
      expect(screen.getByText('Project')).toBeInTheDocument();
      expect(screen.getByText('Incident')).toBeInTheDocument();
      expect(screen.getByText('Supplier')).toBeInTheDocument();
    });

    it('should display shape names for accessibility', () => {
      render(<VoxelLegend defaultExpanded />);

      // Shape names shown for colorblind users
      expect(screen.getByText('(Sphere)')).toBeInTheDocument();
      expect(screen.getByText('(Icosahedron)')).toBeInTheDocument();
      expect(screen.getByText('(Octahedron)')).toBeInTheDocument();
      expect(screen.getByText('(Box)')).toBeInTheDocument();
      expect(screen.getByText('(Dodecahedron)')).toBeInTheDocument();
      expect(screen.getByText('(Tetrahedron)')).toBeInTheDocument();
      expect(screen.getByText('(Cylinder)')).toBeInTheDocument();
    });

    it('should render shape icons for visual distinction', () => {
      render(<VoxelLegend defaultExpanded />);

      // Shape icons rendered
      expect(screen.getByTestId('shape-circle')).toBeInTheDocument();
      expect(screen.getByTestId('shape-triangle')).toBeInTheDocument();
      expect(screen.getByTestId('shape-octagon')).toBeInTheDocument();
    });
  });

  describe('Status Section', () => {
    it('should display status indicators by default', () => {
      render(<VoxelLegend defaultExpanded />);

      expect(screen.getByText('Status Indicators')).toBeInTheDocument();
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('should display status descriptions', () => {
      render(<VoxelLegend defaultExpanded />);

      expect(screen.getByText('Entity is in good standing')).toBeInTheDocument();
      expect(screen.getByText('Entity requires attention')).toBeInTheDocument();
      expect(screen.getByText('Entity needs immediate action')).toBeInTheDocument();
      expect(screen.getByText('Entity is closed or disabled')).toBeInTheDocument();
    });

    it('should hide status section when showStatus is false', () => {
      render(<VoxelLegend defaultExpanded showStatus={false} />);

      expect(screen.queryByText('Status Indicators')).not.toBeInTheDocument();
    });
  });

  describe('Edge Types Section', () => {
    it('should display edge types by default', () => {
      render(<VoxelLegend defaultExpanded />);

      expect(screen.getByText('Connection Types')).toBeInTheDocument();
      expect(screen.getByText('Impact')).toBeInTheDocument();
      expect(screen.getByText('Mitigation')).toBeInTheDocument();
      expect(screen.getByText('Dependency')).toBeInTheDocument();
      expect(screen.getByText('Assignment')).toBeInTheDocument();
    });

    it('should display edge descriptions', () => {
      render(<VoxelLegend defaultExpanded />);

      expect(screen.getByText('Shows how risks affect assets')).toBeInTheDocument();
      expect(screen.getByText('Shows controls protecting against risks')).toBeInTheDocument();
      expect(screen.getByText('Shows relationships between entities')).toBeInTheDocument();
      expect(screen.getByText('Shows ownership or responsibility')).toBeInTheDocument();
    });

    it('should hide edges section when showEdges is false', () => {
      render(<VoxelLegend defaultExpanded showEdges={false} />);

      expect(screen.queryByText('Connection Types')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility Note', () => {
    it('should display accessibility explanation', () => {
      render(<VoxelLegend defaultExpanded />);

      expect(
        screen.getByText('Entities are distinguished by both color and shape for accessibility.')
      ).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('should apply custom className', () => {
      render(<VoxelLegend className="custom-class" />);

      const region = screen.getByRole('region');
      expect(region).toHaveClass('custom-class');
    });
  });
});
