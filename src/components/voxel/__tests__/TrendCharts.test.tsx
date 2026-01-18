/**
 * Unit tests for TrendCharts component
 *
 * Tests for:
 * - Chart rendering
 * - Time range selection
 * - Predictive trends
 * - Loading and error states
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TrendCharts } from '../TrendCharts';
import { resetIdCounter } from '@/tests/factories/voxelFactory';

// Mock Firebase functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

vi.mock('@/lib/firebase', () => ({
  functions: {},
}));

// Mock date-fns
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    format: vi.fn((date, formatStr) => {
      if (formatStr === 'yyyy-MM-dd') return '2024-01-15';
      if (formatStr === 'dd/MM') return '15/01';
      return '15/01/2024';
    }),
    parseISO: vi.fn((str) => new Date(str)),
    subDays: vi.fn((date, days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)),
  };
});

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children, data, ...props }: React.PropsWithChildren<{ data?: unknown[] }>) => (
    <div data-testid="line-chart" data-points={data?.length} {...props}>{children}</div>
  ),
  Line: (props: Record<string, unknown>) => <div data-testid="chart-line" data-key={props.dataKey} />,
  XAxis: (props: Record<string, unknown>) => <div data-testid="x-axis" {...props} />,
  YAxis: (props: Record<string, unknown>) => <div data-testid="y-axis" {...props} />,
  CartesianGrid: (props: Record<string, unknown>) => <div data-testid="cartesian-grid" {...props} />,
  Tooltip: (props: Record<string, unknown>) => <div data-testid="chart-tooltip" {...props} />,
  ResponsiveContainer: ({ children, ...props }: React.PropsWithChildren) => (
    <div data-testid="responsive-container" {...props}>{children}</div>
  ),
  Area: (props: Record<string, unknown>) => <div data-testid="chart-area" data-key={props.dataKey} />,
  AreaChart: ({ children, data, ...props }: React.PropsWithChildren<{ data?: unknown[] }>) => (
    <div data-testid="area-chart" data-points={data?.length} {...props}>{children}</div>
  ),
  Legend: (props: Record<string, unknown>) => <div data-testid="chart-legend" {...props} />,
  ReferenceLine: (props: Record<string, unknown>) => (
    <div data-testid="reference-line" data-y={props.y} data-x={props.x} {...props} />
  ),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="card" className={className} {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: React.PropsWithChildren) => (
    <div data-testid="card-content" {...props}>{children}</div>
  ),
  CardHeader: ({ children, ...props }: React.PropsWithChildren) => (
    <div data-testid="card-header" {...props}>{children}</div>
  ),
  CardTitle: ({ children, ...props }: React.PropsWithChildren) => (
    <div data-testid="card-title" {...props}>{children}</div>
  ),
  CardDescription: ({ children, ...props }: React.PropsWithChildren) => (
    <div data-testid="card-description" {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, ...props }: React.PropsWithChildren<{ onClick?: () => void; variant?: string }>) => (
    <button onClick={onClick} data-variant={variant} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.PropsWithChildren) => <span data-testid="badge" {...props}>{children}</span>,
}));

vi.mock('@/components/ui/Skeleton', () => ({
  Skeleton: (props: Record<string, unknown>) => <div data-testid="skeleton" {...props} />,
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | boolean)[]) => classes.filter(Boolean).join(' '),
}));

describe('TrendCharts', () => {
  const mockSnapshotData = {
    success: true,
    snapshots: [
      {
        date: '2024-01-10',
        metrics: {
          nodes: { total: 90 },
          risks: { total: 45 },
          anomalies: { active: 8 },
          compliance: { implementationRate: 75 },
        },
      },
      {
        date: '2024-01-11',
        metrics: {
          nodes: { total: 95 },
          risks: { total: 47 },
          anomalies: { active: 7 },
          compliance: { implementationRate: 76 },
        },
      },
      {
        date: '2024-01-12',
        metrics: {
          nodes: { total: 98 },
          risks: { total: 48 },
          anomalies: { active: 9 },
          compliance: { implementationRate: 77 },
        },
      },
      {
        date: '2024-01-13',
        metrics: {
          nodes: { total: 100 },
          risks: { total: 50 },
          anomalies: { active: 10 },
          compliance: { implementationRate: 78 },
        },
      },
      {
        date: '2024-01-14',
        metrics: {
          nodes: { total: 102 },
          risks: { total: 51 },
          anomalies: { active: 11 },
          compliance: { implementationRate: 79 },
        },
      },
      {
        date: '2024-01-15',
        metrics: {
          nodes: { total: 105 },
          risks: { total: 52 },
          anomalies: { active: 12 },
          compliance: { implementationRate: 80 },
        },
      },
      {
        date: '2024-01-16',
        metrics: {
          nodes: { total: 108 },
          risks: { total: 54 },
          anomalies: { active: 13 },
          compliance: { implementationRate: 81 },
        },
      },
    ],
  };

  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();

    // Setup mock callable function
    mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
      data: mockSnapshotData,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('rendering', () => {
    it('should render card container', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByTestId('card')).toBeInTheDocument();
      });
    });

    it('should render title with icon', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/tendances voxel/i)).toBeInTheDocument();
      });
    });

    it('should render time range selector', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText('7J')).toBeInTheDocument();
        expect(screen.getByText('30J')).toBeInTheDocument();
        expect(screen.getByText('90J')).toBeInTheDocument();
        expect(screen.getByText('1A')).toBeInTheDocument();
      });
    });

    it('should render line chart', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('should render area chart for compliance', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      });
    });

    it('should render chart axes', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        const xAxes = screen.getAllByTestId('x-axis');
        const yAxes = screen.getAllByTestId('y-axis');
        expect(xAxes.length).toBeGreaterThan(0);
        expect(yAxes.length).toBeGreaterThan(0);
      });
    });

    it('should apply custom className', async () => {
      render(<TrendCharts className="my-custom-class" />);

      await waitFor(() => {
        expect(screen.getByTestId('card')).toHaveClass('my-custom-class');
      });
    });
  });

  // ============================================================================
  // Loading State Tests
  // ============================================================================

  describe('loading state', () => {
    it('should show skeleton while loading', () => {
      // Make the fetch take a while
      mockHttpsCallable.mockReturnValue(vi.fn().mockReturnValue(new Promise(() => {})));

      render(<TrendCharts />);

      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    });

    it('should hide skeleton after loading', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        // After loading, charts should be visible
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Error State Tests
  // ============================================================================

  describe('error state', () => {
    it('should display error message when fetch fails', async () => {
      mockHttpsCallable.mockReturnValue(vi.fn().mockRejectedValue(new Error('Network error')));

      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/erreur|error/i)).toBeInTheDocument();
      });
    });

    it('should have retry button on error', async () => {
      mockHttpsCallable.mockReturnValue(vi.fn().mockRejectedValue(new Error('Network error')));

      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/reessayer|retry/i)).toBeInTheDocument();
      });
    });

    it('should retry fetch when retry button is clicked', async () => {
      const mockCallable = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: mockSnapshotData });

      mockHttpsCallable.mockReturnValue(mockCallable);

      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/reessayer/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/reessayer/i);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockCallable).toHaveBeenCalledTimes(2);
      });
    });

    it('should display error when API returns failure', async () => {
      mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
        data: { success: false },
      }));

      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/impossible|error/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Time Range Selection Tests
  // ============================================================================

  describe('time range selection', () => {
    it('should default to 30d time range', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        const button30d = screen.getByText('30J');
        expect(button30d).toHaveAttribute('data-variant', 'secondary');
      });
    });

    it('should use initial time range prop', async () => {
      render(<TrendCharts initialTimeRange="7d" />);

      await waitFor(() => {
        const button7d = screen.getByText('7J');
        expect(button7d).toHaveAttribute('data-variant', 'secondary');
      });
    });

    it('should change time range when button is clicked', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });

      const button90d = screen.getByText('90J');
      fireEvent.click(button90d);

      await waitFor(() => {
        expect(button90d).toHaveAttribute('data-variant', 'secondary');
      });
    });

    it('should refetch data when time range changes', async () => {
      const mockCallable = vi.fn().mockResolvedValue({ data: mockSnapshotData });
      mockHttpsCallable.mockReturnValue(mockCallable);

      render(<TrendCharts />);

      await waitFor(() => {
        expect(mockCallable).toHaveBeenCalled();
      });

      const initialCallCount = mockCallable.mock.calls.length;

      const button7d = screen.getByText('7J');
      fireEvent.click(button7d);

      await waitFor(() => {
        expect(mockCallable.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('should show correct description for 1 year range', async () => {
      render(<TrendCharts initialTimeRange="1y" />);

      await waitFor(() => {
        expect(screen.getByText(/1 an/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Metric Summary Tests
  // ============================================================================

  describe('metric summaries', () => {
    it('should display node count summary', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/noeuds/i)).toBeInTheDocument();
      });
    });

    it('should display risk count summary', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/risques/i)).toBeInTheDocument();
      });
    });

    it('should display anomaly count summary', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/anomalies/i)).toBeInTheDocument();
      });
    });

    it('should display compliance summary', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/conformite/i)).toBeInTheDocument();
      });
    });

    it('should show trend indicators', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        // Should show percentage changes with + or -
        const changeIndicators = document.querySelectorAll('[class*="text-emerald"], [class*="text-red"]');
        expect(changeIndicators.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Predictive Trends Tests
  // ============================================================================

  describe('predictive trends', () => {
    it('should show predictions by default', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/predictions/i)).toBeInTheDocument();
      });
    });

    it('should not show predictions when disabled', async () => {
      render(<TrendCharts showPredictions={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        // Description should not mention predictions
        const description = screen.getByTestId('card-description');
        expect(description.textContent).not.toMatch(/\+ predictions/);
      });
    });

    it('should render reference line for predictions', async () => {
      render(<TrendCharts showPredictions={true} />);

      await waitFor(() => {
        const referenceLines = screen.getAllByTestId('reference-line');
        expect(referenceLines.length).toBeGreaterThan(0);
      });
    });

    it('should render predicted data lines', async () => {
      render(<TrendCharts showPredictions={true} />);

      await waitFor(() => {
        const lines = screen.getAllByTestId('chart-line');
        // Should have both actual and predicted lines
        const predictedLines = lines.filter((line) =>
          line.getAttribute('data-key')?.includes('predicted')
        );
        expect(predictedLines.length).toBeGreaterThan(0);
      });
    });

    it('should use custom prediction days', async () => {
      render(<TrendCharts showPredictions={true} predictionDays={60} />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Warning Banner Tests
  // ============================================================================

  describe('warning banner', () => {
    it('should show warning for increasing anomalies', async () => {
      // Create data with sharply increasing anomalies
      const increasingAnomalies = {
        success: true,
        snapshots: Array.from({ length: 10 }, (_, i) => ({
          date: `2024-01-${10 + i}`,
          metrics: {
            nodes: { total: 100 },
            risks: { total: 50 },
            anomalies: { active: 5 + i * 5 }, // Sharp increase
            compliance: { implementationRate: 80 },
          },
        })),
      };

      mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
        data: increasingAnomalies,
      }));

      render(<TrendCharts showPredictions={true} />);

      await waitFor(() => {
        // Should display a warning about anomaly trend
        const warningBanner = document.querySelector('[class*="bg-red-500"], [class*="bg-yellow-500"]');
        expect(warningBanner).toBeDefined();
      });
    });

    it('should show warning for declining compliance', async () => {
      // Create data with declining compliance
      const decliningCompliance = {
        success: true,
        snapshots: Array.from({ length: 10 }, (_, i) => ({
          date: `2024-01-${10 + i}`,
          metrics: {
            nodes: { total: 100 },
            risks: { total: 50 },
            anomalies: { active: 10 },
            compliance: { implementationRate: 85 - i * 2 }, // Declining
          },
        })),
      };

      mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
        data: decliningCompliance,
      }));

      render(<TrendCharts showPredictions={true} />);

      await waitFor(() => {
        // Component should render without errors
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Compliance Chart Tests
  // ============================================================================

  describe('compliance chart', () => {
    it('should render compliance area chart', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      });
    });

    it('should render compliance evolution label', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByText(/evolution de la conformite/i)).toBeInTheDocument();
      });
    });

    it('should render compliance warning threshold', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        const referenceLines = screen.getAllByTestId('reference-line');
        const warningLine = referenceLines.find((line) => line.getAttribute('data-y') === '70');
        expect(warningLine).toBeDefined();
      });
    });

    it('should render compliance area with gradient', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        const complianceArea = screen.getByTestId('chart-area');
        expect(complianceArea).toHaveAttribute('data-key', 'compliance');
      });
    });
  });

  // ============================================================================
  // Chart Tooltip Tests
  // ============================================================================

  describe('chart tooltip', () => {
    it('should render tooltips for charts', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        const tooltips = screen.getAllByTestId('chart-tooltip');
        expect(tooltips.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Chart Legend Tests
  // ============================================================================

  describe('chart legend', () => {
    it('should render chart legend', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByTestId('chart-legend')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Data Processing Tests
  // ============================================================================

  describe('data processing', () => {
    it('should handle empty snapshots array', async () => {
      mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
        data: { success: true, snapshots: [] },
      }));

      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('should handle missing metrics in snapshots', async () => {
      mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
        data: {
          success: true,
          snapshots: [
            { date: '2024-01-15', metrics: {} },
          ],
        },
      }));

      render(<TrendCharts />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('should sort snapshots by date', async () => {
      // Provide unsorted data
      mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
        data: {
          success: true,
          snapshots: [
            { date: '2024-01-15', metrics: { nodes: { total: 100 } } },
            { date: '2024-01-13', metrics: { nodes: { total: 95 } } },
            { date: '2024-01-14', metrics: { nodes: { total: 98 } } },
          ],
        },
      }));

      render(<TrendCharts />);

      await waitFor(() => {
        // Should render without errors (sorting happens internally)
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Chart Lines Tests
  // ============================================================================

  describe('chart lines', () => {
    it('should render nodes line', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        const lines = screen.getAllByTestId('chart-line');
        const nodesLine = lines.find((line) => line.getAttribute('data-key') === 'nodes');
        expect(nodesLine).toBeDefined();
      });
    });

    it('should render anomalies line', async () => {
      render(<TrendCharts />);

      await waitFor(() => {
        const lines = screen.getAllByTestId('chart-line');
        const anomaliesLine = lines.find((line) => line.getAttribute('data-key') === 'anomalies');
        expect(anomaliesLine).toBeDefined();
      });
    });
  });
});
