import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PMActionsOverdueWidget } from '../PMActionsOverdueWidget';
import type { OverdueActionItem } from '../../../hooks/useOverdueActions';

// Mock overdue actions
const mockActions: OverdueActionItem[] = [
  {
    id: 'action-1',
    title: 'Mise a jour politique securite',
    description: 'Revision annuelle',
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    daysOverdue: 5,
    status: 'pending',
    assigneeName: 'Jean Dupont',
  },
  {
    id: 'action-2',
    title: 'Formation phishing',
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    daysOverdue: 2,
    status: 'in_progress',
  },
  {
    id: 'action-3',
    title: 'Audit conformite',
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    daysOverdue: 10,
    status: 'pending',
    assigneeName: 'Marie Martin',
  },
];

vi.mock('../../../hooks/useOverdueActions', () => ({
  useOverdueActions: vi.fn(() => ({
    actions: mockActions,
    count: 3,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
  getOverdueSeverityColorScheme: vi.fn((days: number) => {
    if (days >= 7) return 'critical';
    if (days >= 3) return 'high';
    return 'medium';
  }),
  OVERDUE_SEVERITY_COLOR_CLASSES: {
    critical: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-300',
      badge: 'bg-red-600 text-white',
    },
    high: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      border: 'border-orange-300',
      badge: 'bg-orange-500 text-white',
    },
    medium: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      border: 'border-yellow-300',
      badge: 'bg-yellow-500 text-white',
    },
  },
}));

describe('PMActionsOverdueWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render header with count', () => {
    render(<PMActionsOverdueWidget organizationId="org-123" />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Actions en Retard')).toBeInTheDocument();
  });

  it('should render all overdue actions', () => {
    render(<PMActionsOverdueWidget organizationId="org-123" />);

    expect(screen.getByText('Mise a jour politique securite')).toBeInTheDocument();
    expect(screen.getByText('Formation phishing')).toBeInTheDocument();
    expect(screen.getByText('Audit conformite')).toBeInTheDocument();
  });

  it('should display days overdue for each action', () => {
    render(<PMActionsOverdueWidget organizationId="org-123" />);

    expect(screen.getByText('+5j')).toBeInTheDocument();
    expect(screen.getByText('+2j')).toBeInTheDocument();
    expect(screen.getByText('+10j')).toBeInTheDocument();
  });

  it('should display assignee names when present', () => {
    render(<PMActionsOverdueWidget organizationId="org-123" />);

    expect(screen.getByText('Assigne a: Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Assigne a: Marie Martin')).toBeInTheDocument();
  });

  it('should show "En retard" badges', () => {
    render(<PMActionsOverdueWidget organizationId="org-123" />);

    const badges = screen.getAllByText('En retard');
    expect(badges.length).toBe(3);
  });

  it('should have accessible region role', () => {
    render(<PMActionsOverdueWidget organizationId="org-123" />);

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Actions en retard');
  });

  it('should call onActionClick when action is clicked', async () => {
    const user = userEvent.setup();
    const handleActionClick = vi.fn();

    render(
      <PMActionsOverdueWidget
        organizationId="org-123"
        onActionClick={handleActionClick}
      />
    );

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);

    expect(handleActionClick).toHaveBeenCalledWith('action-1');
  });

  it('should show view all button when onViewAllClick is provided', () => {
    render(
      <PMActionsOverdueWidget
        organizationId="org-123"
        onViewAllClick={() => {}}
      />
    );

    expect(screen.getByText('Voir toutes les actions en retard (3)')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <PMActionsOverdueWidget organizationId="org-123" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});

// Note: Loading, empty, and error state tests require complex mock setup
// These states are tested indirectly via the hook tests
