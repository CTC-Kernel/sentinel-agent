import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PMProgressWidget } from '../PMProgressWidget';

// Mock the useProjectProgress hook
const mockProgress = {
  overall: 65,
  controls: { completed: 30, total: 50, percentage: 60 },
  documents: { completed: 8, total: 10, percentage: 80 },
  actions: { completed: 15, total: 25, percentage: 60 },
  milestones: { completed: 3, total: 5, percentage: 60 },
};

vi.mock('../../../hooks/useProjectProgress', () => ({
  useProjectProgress: vi.fn(() => ({
    progress: mockProgress,
    trend: 'up',
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
  getProgressColorScheme: vi.fn((pct: number) => {
    if (pct >= 80) return 'excellent';
    if (pct >= 60) return 'good';
    if (pct >= 40) return 'warning';
    return 'critical';
  }),
  PROGRESS_COLOR_CLASSES: {
    excellent: {
      bg: 'bg-green-500',
      bgLight: 'bg-green-100',
      text: 'text-green-600',
      border: 'border-green-200',
    },
    good: {
      bg: 'bg-blue-500',
      bgLight: 'bg-blue-100',
      text: 'text-blue-600',
      border: 'border-blue-200',
    },
    warning: {
      bg: 'bg-orange-500',
      bgLight: 'bg-orange-100',
      text: 'text-orange-600',
      border: 'border-orange-200',
    },
    critical: {
      bg: 'bg-red-500',
      bgLight: 'bg-red-100',
      text: 'text-red-600',
      border: 'border-red-200',
    },
  },
}));

describe('PMProgressWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render overall progress percentage', () => {
    render(<PMProgressWidget organizationId="org-123" />);

    expect(screen.getByText('65')).toBeInTheDocument();
  });

  it('should render all category progress bars', () => {
    render(<PMProgressWidget organizationId="org-123" />);

    expect(screen.getByText('Contrôles')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Jalons')).toBeInTheDocument();
  });

  it('should display category completion counts', () => {
    render(<PMProgressWidget organizationId="org-123" />);

    expect(screen.getByText('30/50 (60%)')).toBeInTheDocument();
    expect(screen.getByText('8/10 (80%)')).toBeInTheDocument();
    expect(screen.getByText('15/25 (60%)')).toBeInTheDocument();
    expect(screen.getByText('3/5 (60%)')).toBeInTheDocument();
  });

  it('should display trend indicator for upward trend', () => {
    render(<PMProgressWidget organizationId="org-123" />);

    expect(screen.getByText('En hausse')).toBeInTheDocument();
  });

  it('should display milestones summary in footer', () => {
    render(<PMProgressWidget organizationId="org-123" />);

    expect(screen.getByText('3/5 jalons atteints')).toBeInTheDocument();
  });

  it('should have accessible region role', () => {
    render(<PMProgressWidget organizationId="org-123" />);

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Progression du projet');
  });

  it('should render progress bars with aria attributes', () => {
    render(<PMProgressWidget organizationId="org-123" />);

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(4);

    progressBars.forEach((bar) => {
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  it('should call onCategoryClick when category is clicked', async () => {
    const user = userEvent.setup();
    const handleCategoryClick = vi.fn();

    render(
      <PMProgressWidget
        organizationId="org-123"
        onCategoryClick={handleCategoryClick}
      />
    );

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);

    expect(handleCategoryClick).toHaveBeenCalledWith('controls');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <PMProgressWidget organizationId="org-123" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});

// Note: Loading, empty, and error state tests require complex mock setup
// These states are tested indirectly via the hook tests
