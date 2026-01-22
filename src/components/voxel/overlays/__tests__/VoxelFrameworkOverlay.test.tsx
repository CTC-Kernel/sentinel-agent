/**
 * VoxelFrameworkOverlay Tests
 *
 * @see Story VOX-9.6: Framework Overlay
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  VoxelFrameworkOverlay,
  type ComplianceFramework,
} from '../VoxelFrameworkOverlay';

// ============================================================================
// Mocks
// ============================================================================

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Shield: () => <span data-testid="icon-shield">Shield</span>,
  CheckCircle: () => <span data-testid="icon-check">Check</span>,
  AlertTriangle: () => <span data-testid="icon-warning">Warning</span>,
  XCircle: () => <span data-testid="icon-x">X</span>,
  ChevronDown: () => <span data-testid="icon-down">Down</span>,
  ChevronUp: () => <span data-testid="icon-up">Up</span>,
  Filter: () => <span data-testid="icon-filter">Filter</span>,
  Layers: () => <span data-testid="icon-layers">Layers</span>,
}));

// ============================================================================
// Test Data
// ============================================================================

const mockFrameworks: ComplianceFramework[] = [
  {
    id: 'iso27001',
    name: 'ISO 27001:2022',
    code: 'ISO',
    color: '#3B82F6',
    totalControls: 100,
    mappedControls: 80,
    complianceScore: 85,
    breakdown: { compliant: 70, partial: 8, nonCompliant: 2, notApplicable: 20 },
  },
  {
    id: 'soc2',
    name: 'SOC 2 Type II',
    code: 'SOC2',
    color: '#8B5CF6',
    totalControls: 60,
    mappedControls: 50,
    complianceScore: 90,
    breakdown: { compliant: 45, partial: 4, nonCompliant: 1, notApplicable: 10 },
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('VoxelFrameworkOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should render when visible', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);
      expect(screen.getByText('Frameworks')).toBeInTheDocument();
    });

    it('should not render when not visible', () => {
      const { container } = render(
        <VoxelFrameworkOverlay visible={false} frameworks={mockFrameworks} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should show default frameworks when none provided', () => {
      render(<VoxelFrameworkOverlay visible={true} />);
      // Default frameworks include ISO 27001
      expect(screen.getByText('ISO 27001:2022')).toBeInTheDocument();
    });
  });

  describe('Framework Display', () => {
    it('should display framework names', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);
      expect(screen.getByText('ISO 27001:2022')).toBeInTheDocument();
      expect(screen.getByText('SOC 2 Type II')).toBeInTheDocument();
    });

    it('should display framework codes', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);
      expect(screen.getByText('ISO')).toBeInTheDocument();
      expect(screen.getByText('SOC2')).toBeInTheDocument();
    });

    it('should display compliance scores', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('should display control counts', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);
      expect(screen.getByText('80/100 controls')).toBeInTheDocument();
      expect(screen.getByText('50/60 controls')).toBeInTheDocument();
    });

    it('should show empty message when no frameworks', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={[]} />);
      expect(screen.getByText('No frameworks configured')).toBeInTheDocument();
    });
  });

  describe('Framework Selection', () => {
    it('should call onFrameworkSelect when clicking a framework', () => {
      const onFrameworkSelect = vi.fn();
      render(
        <VoxelFrameworkOverlay
          visible={true}
          frameworks={mockFrameworks}
          onFrameworkSelect={onFrameworkSelect}
        />
      );

      const framework = screen.getByRole('button', { name: /ISO 27001:2022 framework/i });
      fireEvent.click(framework);

      expect(onFrameworkSelect).toHaveBeenCalledWith('iso27001');
    });

    it('should deselect when clicking selected framework', () => {
      const onFrameworkSelect = vi.fn();
      render(
        <VoxelFrameworkOverlay
          visible={true}
          frameworks={mockFrameworks}
          selectedFrameworkId="iso27001"
          onFrameworkSelect={onFrameworkSelect}
        />
      );

      const framework = screen.getByRole('button', { name: /ISO 27001:2022 framework/i });
      fireEvent.click(framework);

      expect(onFrameworkSelect).toHaveBeenCalledWith(null);
    });

    it('should highlight selected framework', () => {
      render(
        <VoxelFrameworkOverlay
          visible={true}
          frameworks={mockFrameworks}
          selectedFrameworkId="iso27001"
        />
      );

      const framework = screen.getByRole('button', { name: /ISO 27001:2022 framework/i });
      expect(framework).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Framework Hover', () => {
    it('should call onFrameworkHover on mouse enter', () => {
      const onFrameworkHover = vi.fn();
      render(
        <VoxelFrameworkOverlay
          visible={true}
          frameworks={mockFrameworks}
          onFrameworkHover={onFrameworkHover}
        />
      );

      const framework = screen.getByRole('button', { name: /ISO 27001:2022 framework/i });
      fireEvent.mouseEnter(framework);

      expect(onFrameworkHover).toHaveBeenCalledWith('iso27001');
    });

    it('should call onFrameworkHover with null on mouse leave', () => {
      const onFrameworkHover = vi.fn();
      render(
        <VoxelFrameworkOverlay
          visible={true}
          frameworks={mockFrameworks}
          onFrameworkHover={onFrameworkHover}
        />
      );

      const framework = screen.getByRole('button', { name: /ISO 27001:2022 framework/i });
      fireEvent.mouseEnter(framework);
      fireEvent.mouseLeave(framework);

      expect(onFrameworkHover).toHaveBeenLastCalledWith(null);
    });
  });

  describe('Breakdown Expansion', () => {
    it('should expand breakdown when clicking expand button', () => {
      render(
        <VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} showBreakdown={true} />
      );

      // Initially breakdown should not be visible
      expect(screen.queryByText('Compliant')).not.toBeInTheDocument();

      // Click expand button
      const expandButton = screen.getAllByRole('button', { name: /expand breakdown/i })[0];
      fireEvent.click(expandButton);

      // Now breakdown should be visible
      expect(screen.getByText('Compliant')).toBeInTheDocument();
      expect(screen.getByText('Partial')).toBeInTheDocument();
      expect(screen.getByText('Non-Compliant')).toBeInTheDocument();
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should collapse breakdown when clicking again', () => {
      render(
        <VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} showBreakdown={true} />
      );

      // Expand
      const expandButton = screen.getAllByRole('button', { name: /expand breakdown/i })[0];
      fireEvent.click(expandButton);
      expect(screen.getByText('Compliant')).toBeInTheDocument();

      // Collapse
      const collapseButton = screen.getByRole('button', { name: /collapse breakdown/i });
      fireEvent.click(collapseButton);
      expect(screen.queryByText('Compliant')).not.toBeInTheDocument();
    });

    it('should not show breakdown when showBreakdown is false', () => {
      render(
        <VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} showBreakdown={false} />
      );

      // Click expand button
      const expandButton = screen.getAllByRole('button', { name: /expand breakdown/i })[0];
      fireEvent.click(expandButton);

      // Breakdown should still not be visible
      expect(screen.queryByText('Compliant')).not.toBeInTheDocument();
    });
  });

  describe('Overall Stats', () => {
    it('should display overall coverage', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);
      expect(screen.getByText('Overall Coverage')).toBeInTheDocument();
    });

    it('should calculate average score correctly', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);
      // Average of 85 and 90 = 87.5, rounded to 88
      expect(screen.getByText('88%')).toBeInTheDocument();
    });

    it('should show 0% for empty frameworks', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={[]} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Minimize/Expand', () => {
    it('should have minimize button', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);
      expect(screen.getByRole('button', { name: /minimize panel/i })).toBeInTheDocument();
    });

    it('should minimize when clicking minimize button', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);

      const minimizeButton = screen.getByRole('button', { name: /minimize panel/i });
      fireEvent.click(minimizeButton);

      // Framework names should not be visible when minimized
      expect(screen.queryByText('ISO 27001:2022')).not.toBeInTheDocument();
      expect(screen.queryByText('SOC 2 Type II')).not.toBeInTheDocument();
    });

    it('should show abbreviated codes when minimized', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);

      const minimizeButton = screen.getByRole('button', { name: /minimize panel/i });
      fireEvent.click(minimizeButton);

      // Should show abbreviated buttons
      expect(screen.getByRole('button', { name: /select iso 27001/i })).toBeInTheDocument();
    });

    it('should expand when clicking expand button', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);

      // Minimize first
      const minimizeButton = screen.getByRole('button', { name: /minimize panel/i });
      fireEvent.click(minimizeButton);

      // Then expand
      const expandButton = screen.getByRole('button', { name: /expand panel/i });
      fireEvent.click(expandButton);

      // Framework names should be visible again
      expect(screen.getByText('ISO 27001:2022')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria attributes on framework cards', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);

      const frameworks = screen.getAllByRole('button', { name: /framework/i });
      frameworks.forEach((fw) => {
        expect(fw).toHaveAttribute('aria-pressed');
      });
    });

    it('should have proper labels for expand/collapse buttons', () => {
      render(<VoxelFrameworkOverlay visible={true} frameworks={mockFrameworks} />);

      const expandButtons = screen.getAllByRole('button', { name: /expand breakdown/i });
      expect(expandButtons.length).toBeGreaterThan(0);
    });
  });
});
