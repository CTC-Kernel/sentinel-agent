/**
 * Unit tests for BlastRadiusPanel component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BlastRadiusPanel from '../BlastRadiusPanel';

import { VoxelNodeType } from '@/types/voxel';

// Mock dependencies
vi.mock('framer-motion', () => ({
  motion: {
    aside: ({ children, className, ...props }: React.ComponentProps<'aside'>) => <aside className={className} {...props}>{children}</aside>,
    div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>,
    button: ({ children, className, ...props }: React.ComponentProps<'button'>) => <button className={className} {...props}>{children}</button>,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn(() => ({
    nodes: new Map(),
    edges: new Map(),
  })),
}));

// Mock lucide-react icons components
vi.mock('lucide-react', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = ({ className, ...props }: any) => <span className={`icon ${className}`} {...props} />;
  return {
    Activity: Icon,
    AlertTriangle: Icon,
    AlertCircle: Icon,
    Target: Icon,
    Layers: Icon,
    TrendingUp: Icon,
    TrendingDown: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Search: Icon,
    Filter: Icon,
    X: Icon,
    Play: Icon,
    Pause: Icon,
    RefreshCw: Icon,
    Eye: Icon,
    Download: Icon,
    FileText: Icon,
    Plus: Icon,
    Minus: Icon,
    GitBranch: Icon,
    Shield: Icon,
    Server: Icon,
    Briefcase: Icon,
    Users: Icon,
    ClipboardCheck: Icon,
    Bell: Icon,
    Sliders: Icon,
    BarChart3: Icon,
  };
});

describe('BlastRadiusPanel', () => {
  const mockClose = vi.fn();
  const mockStartSimulation = vi.fn();
  const mockStopSimulation = vi.fn();
  const mockSetConfig = vi.fn();
  const mockApplyWhatIf = vi.fn();
  const mockClearWhatIf = vi.fn();
  const mockFocusNode = vi.fn();
  const mockClearResults = vi.fn();
  const mockSetMode = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultProps: any = {
    isOpen: true,
    onClose: mockClose,
    sourceNodeId: 'node-1',
    sourceNode: {
      id: 'node-1',
      label: 'Test Source Node',
      type: 'asset',
      position: [0, 0, 0],
      impactScore: 0.8,
    },
    mode: 'blast-radius',
    isSimulating: false,
    affectedNodes: [
      {
        nodeId: 'node-2',
        impactScore: 0.5,
        pathDistance: 1,
        propagationPath: ['node-1', 'node-2'],
        node: { // Nested VoxelNode structure required by AffectedNodeItem
          id: 'node-2',
          label: 'Affected Node',
          type: 'asset',
          priority: 'high',
        }
      }
    ],
    stats: {
      totalAffected: 1,
      totalImpact: 0.5,
      maxDepth: 1,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      byType: {
        asset: 1,
        risk: 0,
        control: 0,
        incident: 0,
        supplier: 0,
        project: 0,
        audit: 0,
      } as Record<VoxelNodeType, number>,
    },
    businessImpact: 'medium',
    whatIfResult: null,
    whatIfScenario: null,
    config: {
      maxDepth: 3,
      impactThreshold: 0.1,
      decayFactor: 0.5,
      includeTypes: ['asset', 'risk'],
      direction: 'downstream',
    },
    onStartSimulation: mockStartSimulation,
    onStopSimulation: mockStopSimulation,
    onSetConfig: mockSetConfig,
    onApplyWhatIf: mockApplyWhatIf,
    onClearWhatIf: mockClearWhatIf,
    onFocusNode: mockFocusNode,
    onClearResults: mockClearResults,
    onSetMode: mockSetMode,
  };

  it('renders successfully with required props', () => {
    render(<BlastRadiusPanel {...defaultProps} />);

    // Check for title
    expect(screen.getByText('Blast Radius')).toBeInTheDocument();

    // Check source node is displayed
    expect(screen.getByText('Test Source Node')).toBeInTheDocument();

    // Check affected node (using label from nested node object)
    expect(screen.getByText('Affected Node')).toBeInTheDocument();
  });

  it('renders What-If section correctly', () => {
    render(<BlastRadiusPanel {...defaultProps} />);
    expect(screen.getByText('Scenario What-If')).toBeInTheDocument();
  });

  it('does not crash when props are minimal/empty', () => {
    const minimalProps = {
      ...defaultProps,
      sourceNodeId: null,
      sourceNode: null,
      affectedNodes: [],
    };

    render(<BlastRadiusPanel {...minimalProps} />);
    expect(screen.getByText('Blast Radius')).toBeInTheDocument();
    // When sourceNodeId is null, it displays "Selectionnez un noeud source"
    expect(screen.getByText('Selectionnez un noeud source')).toBeInTheDocument();
  });
});
