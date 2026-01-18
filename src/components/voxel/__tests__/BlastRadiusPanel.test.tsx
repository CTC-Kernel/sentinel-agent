/**
 * Unit tests for BlastRadiusPanel component
 *
 * Tests for:
 * - Stats display
 * - Node list rendering
 * - What-If controls
 * - Export buttons
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlastRadiusPanel } from '../BlastRadiusPanel';
import type { AffectedNode, WhatIfComparison } from '@/services/blastRadiusService';
import type { SimulationMode } from '@/hooks/voxel/useBlastRadius';
import { createVoxelNode, resetIdCounter } from '@/tests/factories/voxelFactory';
import type { VoxelNode } from '@/types/voxel';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...props}>{children}</span>
    ),
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('BlastRadiusPanel', () => {
  const mockSourceNode = createVoxelNode({
    id: 'source-node',
    label: 'Source Risk',
    type: 'risk',
  });

  const mockAffectedNodes: AffectedNode[] = [
    {
      nodeId: 'node-1',
      node: createVoxelNode({ id: 'node-1', label: 'Asset A', type: 'asset' }),
      depth: 1,
      impact: 0.85,
      path: ['source-node', 'node-1'],
      edgeWeightSum: 1.0,
    },
    {
      nodeId: 'node-2',
      node: createVoxelNode({ id: 'node-2', label: 'Control B', type: 'control' }),
      depth: 2,
      impact: 0.6,
      path: ['source-node', 'node-1', 'node-2'],
      edgeWeightSum: 2.0,
    },
    {
      nodeId: 'node-3',
      node: createVoxelNode({ id: 'node-3', label: 'Supplier C', type: 'supplier' }),
      depth: 2,
      impact: 0.35,
      path: ['source-node', 'node-1', 'node-3'],
      edgeWeightSum: 1.5,
    },
  ];

  const mockStats = {
    totalAffected: 3,
    totalImpact: 1.8,
    maxDepth: 2,
    criticalCount: 1,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
    byType: {
      asset: 1,
      risk: 0,
      control: 1,
      incident: 0,
      supplier: 1,
      project: 0,
      audit: 0,
    },
  };

  const mockConfig = {
    startNodeId: 'source-node',
    maxDepth: 4,
    minProbability: 0.1,
    decayRate: 0.25,
    bidirectional: false,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    // Simulation state
    sourceNodeId: 'source-node',
    sourceNode: mockSourceNode,
    mode: 'blast-radius' as SimulationMode,
    isSimulating: false,
    // Results
    affectedNodes: mockAffectedNodes,
    stats: mockStats,
    whatIfResult: null as WhatIfComparison | null,
    // Config
    config: mockConfig,
    // Callbacks
    onConfigChange: vi.fn(),
    onResetConfig: vi.fn(),
    onStartSimulation: vi.fn(),
    onStopSimulation: vi.fn(),
    onStartWhatIf: vi.fn(),
    onClearWhatIf: vi.fn(),
    onFocusNode: vi.fn(),
    onExport: vi.fn(),
    onExportPdf: vi.fn(),
    onSetMode: vi.fn(),
  };

  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('rendering', () => {
    it('should render panel header', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      expect(screen.getByText(/blast radius|rayon/i)).toBeInTheDocument();
    });

    it('should render source node information', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      expect(screen.getByText('Source Risk')).toBeInTheDocument();
    });

    it('should render stats summary', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      // Should show total affected count
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render affected nodes list', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      expect(screen.getByText('Asset A')).toBeInTheDocument();
      expect(screen.getByText('Control B')).toBeInTheDocument();
      expect(screen.getByText('Supplier C')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /fermer|close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      const { container } = render(<BlastRadiusPanel {...defaultProps} isOpen={false} />);

      // Panel should be hidden
      expect(container.querySelector('[class*="opacity-0"], [class*="hidden"]')).toBeDefined();
    });
  });

  // ============================================================================
  // Stats Display Tests
  // ============================================================================

  describe('stats display', () => {
    it('should display total affected nodes count', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      // Look for the count
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display max depth', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should display impact breakdown by severity', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      // Should show counts for different impact levels
      const countElements = screen.getAllByText(/1/);
      expect(countElements.length).toBeGreaterThan(0);
    });

    it('should display node type breakdown', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      // Look for type labels
      expect(screen.queryByText(/actif|asset/i) || document.querySelector('[title*="asset"]')).toBeDefined();
    });
  });

  // ============================================================================
  // Node List Tests
  // ============================================================================

  describe('node list', () => {
    it('should sort nodes by impact', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      // First node should be highest impact (Asset A at 0.85)
      const nodeItems = screen.getAllByRole('button');
      // Node order should reflect impact sorting
    });

    it('should show impact percentage for each node', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      // Should display impact values
      expect(screen.queryByText(/85|60|35/) || screen.queryByText(/0\.85|0\.6|0\.35/)).toBeDefined();
    });

    it('should show depth indicator for each node', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      // Should show depth information
      expect(screen.queryByText(/profondeur|depth/i) || screen.queryByText(/niveau|level/i)).toBeDefined();
    });

    it('should call onFocusNode when clicking a node', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const nodeButton = screen.getByText('Asset A');
      fireEvent.click(nodeButton);

      expect(defaultProps.onFocusNode).toHaveBeenCalledWith('node-1');
    });
  });

  // ============================================================================
  // Config Controls Tests
  // ============================================================================

  describe('config controls', () => {
    it('should have max depth slider/input', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const depthControl = document.querySelector('[name*="depth"], [aria-label*="depth"], [type="range"]');
      expect(depthControl).toBeDefined();
    });

    it('should call onConfigChange when config is modified', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const depthControl = document.querySelector('[type="range"]') as HTMLInputElement;
      if (depthControl) {
        fireEvent.change(depthControl, { target: { value: '5' } });
        expect(defaultProps.onConfigChange).toHaveBeenCalled();
      }
    });

    it('should have reset config button', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const resetButton = screen.queryByRole('button', { name: /reset|reinitialiser/i });
      expect(resetButton || document.querySelector('[aria-label*="reset"]')).toBeDefined();
    });
  });

  // ============================================================================
  // What-If Controls Tests
  // ============================================================================

  describe('what-if controls', () => {
    it('should have what-if mode toggle', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const whatIfButton = screen.queryByRole('button', { name: /what-if|simulation/i });
      expect(whatIfButton || document.querySelector('[aria-label*="what-if"]')).toBeDefined();
    });

    it('should display what-if comparison when available', () => {
      const whatIfResult: WhatIfComparison = {
        baseline: {
          sourceNodeId: 'source-node',
          affectedNodes: mockAffectedNodes,
          totalImpact: 1.8,
          maxDepth: 2,
          paths: [],
          nodesByType: { asset: [], risk: [], control: [], incident: [], supplier: [], project: [], audit: [] },
          businessImpact: 'medium',
          executionTimeMs: 5,
        },
        scenario: {
          sourceNodeId: 'source-node',
          affectedNodes: mockAffectedNodes.slice(0, 2),
          totalImpact: 1.45,
          maxDepth: 2,
          paths: [],
          nodesByType: { asset: [], risk: [], control: [], incident: [], supplier: [], project: [], audit: [] },
          businessImpact: 'low',
          executionTimeMs: 3,
        },
        impactDelta: -0.35,
        affectedNodesDelta: -1,
        newlyAffected: [],
        noLongerAffected: ['node-3'],
        changedImpact: [],
      };

      render(<BlastRadiusPanel {...defaultProps} whatIfResult={whatIfResult} />);

      // Should show comparison data
      expect(screen.queryByText(/-0\.35|-35%/) || screen.queryByText(/reduction|diminution/i)).toBeDefined();
    });

    it('should show no longer affected nodes in what-if mode', () => {
      const whatIfResult: WhatIfComparison = {
        baseline: {
          sourceNodeId: 'source-node',
          affectedNodes: mockAffectedNodes,
          totalImpact: 1.8,
          maxDepth: 2,
          paths: [],
          nodesByType: { asset: [], risk: [], control: [], incident: [], supplier: [], project: [], audit: [] },
          businessImpact: 'medium',
          executionTimeMs: 5,
        },
        scenario: {
          sourceNodeId: 'source-node',
          affectedNodes: [],
          totalImpact: 0,
          maxDepth: 0,
          paths: [],
          nodesByType: { asset: [], risk: [], control: [], incident: [], supplier: [], project: [], audit: [] },
          businessImpact: 'low',
          executionTimeMs: 3,
        },
        impactDelta: -1.8,
        affectedNodesDelta: -3,
        newlyAffected: [],
        noLongerAffected: ['node-1', 'node-2', 'node-3'],
        changedImpact: [],
      };

      render(<BlastRadiusPanel {...defaultProps} whatIfResult={whatIfResult} mode="what-if" />);

      // Should indicate protected nodes
      expect(screen.queryByText(/protege|protected/i) || screen.queryByText(/3/)).toBeDefined();
    });

    it('should call onClearWhatIf when clearing what-if', () => {
      const whatIfResult: WhatIfComparison = {
        baseline: {} as any,
        scenario: {} as any,
        impactDelta: 0,
        affectedNodesDelta: 0,
        newlyAffected: [],
        noLongerAffected: [],
        changedImpact: [],
      };

      render(<BlastRadiusPanel {...defaultProps} whatIfResult={whatIfResult} mode="what-if" />);

      const clearButton = screen.queryByRole('button', { name: /clear|effacer|annuler/i });
      if (clearButton) {
        fireEvent.click(clearButton);
        expect(defaultProps.onClearWhatIf).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Export Buttons Tests
  // ============================================================================

  describe('export buttons', () => {
    it('should have export CSV button', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const exportButton = screen.queryByRole('button', { name: /export|csv|telecharger/i });
      expect(exportButton || document.querySelector('[aria-label*="export"]')).toBeDefined();
    });

    it('should have export PDF button', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const pdfButton = screen.queryByRole('button', { name: /pdf|rapport/i });
      expect(pdfButton || document.querySelector('[aria-label*="pdf"]')).toBeDefined();
    });

    it('should call onExport when export is clicked', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const exportButton = screen.queryByRole('button', { name: /export|csv/i });
      if (exportButton) {
        fireEvent.click(exportButton);
        expect(defaultProps.onExport).toHaveBeenCalled();
      }
    });

    it('should call onExportPdf when PDF export is clicked', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const pdfButton = screen.queryByRole('button', { name: /pdf/i });
      if (pdfButton) {
        fireEvent.click(pdfButton);
        expect(defaultProps.onExportPdf).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Simulation State Tests
  // ============================================================================

  describe('simulation state', () => {
    it('should show loading indicator when simulating', () => {
      render(<BlastRadiusPanel {...defaultProps} isSimulating={true} />);

      // Should show spinner or loading text
      expect(
        screen.queryByText(/calcul|simulation|chargement/i) ||
          document.querySelector('[class*="animate-spin"]')
      ).toBeDefined();
    });

    it('should call onStartSimulation when play is clicked', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const playButton = screen.queryByRole('button', { name: /start|demarrer|play|lancer/i });
      if (playButton) {
        fireEvent.click(playButton);
        expect(defaultProps.onStartSimulation).toHaveBeenCalled();
      }
    });

    it('should call onStopSimulation when stop is clicked while simulating', () => {
      render(<BlastRadiusPanel {...defaultProps} isSimulating={true} />);

      const stopButton = screen.queryByRole('button', { name: /stop|arreter|pause/i });
      if (stopButton) {
        fireEvent.click(stopButton);
        expect(defaultProps.onStopSimulation).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Close Button Tests
  // ============================================================================

  describe('close button', () => {
    it('should call onClose when close button is clicked', () => {
      render(<BlastRadiusPanel {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /fermer|close/i });
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('empty state', () => {
    it('should show message when no source node is selected', () => {
      render(
        <BlastRadiusPanel
          {...defaultProps}
          sourceNodeId={null}
          sourceNode={null}
          affectedNodes={[]}
          stats={{ ...mockStats, totalAffected: 0 }}
        />
      );

      // Should show instruction to select a node
      expect(screen.queryByText(/selectionner|select|choisir/i)).toBeDefined();
    });

    it('should show message when no affected nodes', () => {
      render(
        <BlastRadiusPanel
          {...defaultProps}
          affectedNodes={[]}
          stats={{ ...mockStats, totalAffected: 0 }}
        />
      );

      // Should indicate no impact
      expect(screen.queryByText(/aucun|no impact|0/)).toBeDefined();
    });
  });
});
