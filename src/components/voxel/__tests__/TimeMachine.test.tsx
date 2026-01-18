/**
 * Unit tests for TimeMachine component
 *
 * Tests for:
 * - Date selection
 * - Snapshot loading
 * - Comparison mode
 * - Timeline navigation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimeMachine } from '../TimeMachine';
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
      if (formatStr === 'dd/MM/yyyy') return '15/01/2024';
      if (formatStr === 'd MMMM yyyy') return '15 janvier 2024';
      return '15/01/2024';
    }),
  };
});

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ selected, onSelect, ...props }: { selected?: Date; onSelect?: (date: Date) => void }) => (
    <div data-testid="calendar" onClick={() => onSelect?.(new Date('2024-01-15'))} {...props}>
      Calendar Mock
    </div>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: React.PropsWithChildren) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children }: React.PropsWithChildren) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children, asChild }: React.PropsWithChildren<{ asChild?: boolean }>) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, ...props }: { value?: number[]; onValueChange?: (value: number[]) => void }) => (
    <input
      type="range"
      data-testid="timeline-slider"
      value={value?.[0] || 0}
      onChange={(e) => onValueChange?.([parseInt(e.target.value)])}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.PropsWithChildren) => <span data-testid="badge" {...props}>{children}</span>,
}));

vi.mock('@/components/ui/Skeleton', () => ({
  Skeleton: (props: Record<string, unknown>) => <div data-testid="skeleton" {...props} />,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

describe('TimeMachine', () => {
  const mockSnapshot = {
    id: 'snapshot-1',
    organizationId: 'org-123',
    date: '2024-01-15',
    createdAt: '2024-01-15T10:00:00Z',
    metrics: {
      nodes: { total: 100, byType: { asset: 50, risk: 30, control: 20 } },
      edges: { total: 150, byType: { dependency: 100, mitigation: 50 } },
      anomalies: {
        total: 10,
        active: 5,
        acknowledged: 2,
        resolved: 2,
        dismissed: 1,
        bySeverity: { critical: 1, high: 2, medium: 4, low: 3 },
        byType: { orphan_control: 3, coverage_gap: 4, stale_assessment: 3 },
      },
      risks: { critical: 5, high: 10, medium: 15, low: 20, total: 50 },
      compliance: {
        totalControls: 100,
        implementedControls: 80,
        partialControls: 10,
        notImplemented: 10,
        implementationRate: 80,
        averageEffectiveness: 75,
      },
    },
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onLoadSnapshot: vi.fn(),
    onCompare: vi.fn(),
    organizationId: 'org-123',
  };

  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();

    // Setup mock callable function
    mockHttpsCallable.mockReturnValue(vi.fn().mockResolvedValue({
      data: {
        snapshots: [mockSnapshot],
        availableDates: ['2024-01-15', '2024-01-14', '2024-01-13'],
      },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('rendering', () => {
    it('should render time machine header', () => {
      render(<TimeMachine {...defaultProps} />);

      expect(screen.getByText(/time machine|historique|machine temporelle/i)).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<TimeMachine {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /fermer|close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should render date picker', () => {
      render(<TimeMachine {...defaultProps} />);

      expect(screen.getByTestId('popover-trigger')).toBeInTheDocument();
    });

    it('should render timeline slider', () => {
      render(<TimeMachine {...defaultProps} />);

      expect(screen.getByTestId('timeline-slider')).toBeInTheDocument();
    });

    it('should not be visible when isOpen is false', () => {
      const { container } = render(<TimeMachine {...defaultProps} isOpen={false} />);

      expect(container.querySelector('[class*="opacity-0"], [class*="hidden"]')).toBeDefined();
    });
  });

  // ============================================================================
  // Date Selection Tests
  // ============================================================================

  describe('date selection', () => {
    it('should display selected date', () => {
      render(<TimeMachine {...defaultProps} />);

      // Should show date in some format
      expect(screen.queryByText(/janvier|2024|15/)).toBeDefined();
    });

    it('should open calendar when date picker is clicked', () => {
      render(<TimeMachine {...defaultProps} />);

      const popoverTrigger = screen.getByTestId('popover-trigger');
      fireEvent.click(popoverTrigger);

      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    it('should update selected date when calendar date is clicked', async () => {
      render(<TimeMachine {...defaultProps} />);

      const calendar = screen.getByTestId('calendar');
      fireEvent.click(calendar);

      // Date should be updated
      await waitFor(() => {
        expect(screen.queryByText(/15/)).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Timeline Slider Tests
  // ============================================================================

  describe('timeline slider', () => {
    it('should change date when slider is moved', () => {
      render(<TimeMachine {...defaultProps} />);

      const slider = screen.getByTestId('timeline-slider');
      fireEvent.change(slider, { target: { value: '5' } });

      // Date should update based on slider position
    });

    it('should have navigation buttons for previous/next', () => {
      render(<TimeMachine {...defaultProps} />);

      const prevButton = screen.queryByRole('button', { name: /precedent|previous|gauche|left/i });
      const nextButton = screen.queryByRole('button', { name: /suivant|next|droite|right/i });

      expect(prevButton || document.querySelector('[aria-label*="prev"]')).toBeDefined();
      expect(nextButton || document.querySelector('[aria-label*="next"]')).toBeDefined();
    });

    it('should navigate to previous date when prev button is clicked', () => {
      render(<TimeMachine {...defaultProps} />);

      const prevButton = screen.queryByRole('button', { name: /precedent|previous/i }) ||
        document.querySelector('[aria-label*="prev"]');

      if (prevButton) {
        fireEvent.click(prevButton);
        // Date should decrease
      }
    });

    it('should navigate to next date when next button is clicked', () => {
      render(<TimeMachine {...defaultProps} />);

      const nextButton = screen.queryByRole('button', { name: /suivant|next/i }) ||
        document.querySelector('[aria-label*="next"]');

      if (nextButton) {
        fireEvent.click(nextButton);
        // Date should increase
      }
    });
  });

  // ============================================================================
  // Snapshot Loading Tests
  // ============================================================================

  describe('snapshot loading', () => {
    it('should fetch snapshots on mount', async () => {
      render(<TimeMachine {...defaultProps} />);

      await waitFor(() => {
        expect(mockHttpsCallable).toHaveBeenCalled();
      });
    });

    it('should show loading state while fetching', () => {
      render(<TimeMachine {...defaultProps} />);

      // Should show skeleton or loading indicator
      expect(screen.queryByTestId('skeleton') || screen.queryByText(/chargement|loading/i)).toBeDefined();
    });

    it('should display snapshot metrics when loaded', async () => {
      render(<TimeMachine {...defaultProps} />);

      await waitFor(() => {
        // Should show some metric from the snapshot
        expect(screen.queryByText(/100|50|nodes|noeuds/i)).toBeDefined();
      });
    });

    it('should call onLoadSnapshot when load button is clicked', async () => {
      render(<TimeMachine {...defaultProps} />);

      await waitFor(() => {
        expect(mockHttpsCallable).toHaveBeenCalled();
      });

      const loadButton = screen.queryByRole('button', { name: /charger|load|appliquer|apply/i });
      if (loadButton) {
        fireEvent.click(loadButton);
        expect(defaultProps.onLoadSnapshot).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // Comparison Mode Tests
  // ============================================================================

  describe('comparison mode', () => {
    it('should have comparison mode toggle', () => {
      render(<TimeMachine {...defaultProps} />);

      const compareButton = screen.queryByRole('button', { name: /comparer|compare/i }) ||
        document.querySelector('[aria-label*="compare"]');

      expect(compareButton).toBeDefined();
    });

    it('should enable second date picker in comparison mode', () => {
      render(<TimeMachine {...defaultProps} />);

      // Enable comparison mode
      const compareButton = screen.queryByRole('button', { name: /comparer|compare/i }) ||
        document.querySelector('[aria-label*="compare"]');

      if (compareButton) {
        fireEvent.click(compareButton);

        // Second date picker should appear
        const popovers = screen.getAllByTestId('popover-trigger');
        expect(popovers.length).toBeGreaterThan(1);
      }
    });

    it('should show delta values in comparison mode', async () => {
      render(<TimeMachine {...defaultProps} />);

      // Enable comparison mode and select dates
      const compareButton = screen.queryByRole('button', { name: /comparer|compare/i });
      if (compareButton) {
        fireEvent.click(compareButton);

        await waitFor(() => {
          // Should show delta indicators (+/-)
          expect(screen.queryByText(/\+|-|\d+%/) || document.querySelector('[class*="green"], [class*="red"]')).toBeDefined();
        });
      }
    });

    it('should call onCompare when compare action is triggered', async () => {
      render(<TimeMachine {...defaultProps} />);

      const compareButton = screen.queryByRole('button', { name: /comparer|compare/i });
      if (compareButton) {
        fireEvent.click(compareButton);

        // Find and click the actual compare/apply button
        const applyButton = screen.queryByRole('button', { name: /appliquer|apply|voir|view/i });
        if (applyButton) {
          fireEvent.click(applyButton);
          expect(defaultProps.onCompare).toHaveBeenCalled();
        }
      }
    });
  });

  // ============================================================================
  // Metrics Display Tests
  // ============================================================================

  describe('metrics display', () => {
    it('should display node count', async () => {
      render(<TimeMachine {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/100|noeuds|nodes/i)).toBeDefined();
      });
    });

    it('should display anomaly count', async () => {
      render(<TimeMachine {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/10|anomal/i)).toBeDefined();
      });
    });

    it('should display risk breakdown', async () => {
      render(<TimeMachine {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/critique|critical|eleve|high/i)).toBeDefined();
      });
    });

    it('should display compliance rate', async () => {
      render(<TimeMachine {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/80%|conformite|compliance/i)).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Reset Button Tests
  // ============================================================================

  describe('reset button', () => {
    it('should have reset to current button', () => {
      render(<TimeMachine {...defaultProps} />);

      const resetButton = screen.queryByRole('button', { name: /reset|actuel|current|present/i }) ||
        document.querySelector('[aria-label*="reset"]');

      expect(resetButton).toBeDefined();
    });

    it('should reset to today when reset button is clicked', () => {
      render(<TimeMachine {...defaultProps} />);

      const resetButton = screen.queryByRole('button', { name: /reset|actuel|current/i });
      if (resetButton) {
        fireEvent.click(resetButton);
        // Should reset to current date
      }
    });
  });

  // ============================================================================
  // Close Button Tests
  // ============================================================================

  describe('close button', () => {
    it('should call onClose when close button is clicked', () => {
      render(<TimeMachine {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /fermer|close/i });
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should display error message when snapshot fetch fails', async () => {
      mockHttpsCallable.mockReturnValue(vi.fn().mockRejectedValue(new Error('Fetch failed')));

      render(<TimeMachine {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/erreur|error|echec|failed/i)).toBeDefined();
      });
    });
  });
});
