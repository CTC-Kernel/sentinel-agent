import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RSSIActionsWidget } from '../RSSIActionsWidget';

// Mock the hook
vi.mock('../../../hooks/useAssignedActions', () => ({
  useAssignedActions: vi.fn(),
  getDueStatusColorScheme: vi.fn((isOverdue, isDueSoon) => {
    if (isOverdue) return 'danger';
    if (isDueSoon) return 'warning';
    return 'neutral';
  }),
  DUE_STATUS_COLOR_CLASSES: {
    danger: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', badge: 'bg-red-500' },
    warning: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', badge: 'bg-orange-500' },
    neutral: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', badge: 'bg-slate-500' },
  },
}));

import { useAssignedActions } from '../../../hooks/useAssignedActions';

describe('RSSIActionsWidget', () => {
  const mockRefetch = vi.fn();
  const mockActions = [
    {
      id: 'action-1',
      title: 'Mettre a jour la politique de securite',
      description: 'Revision annuelle',
      type: 'policy',
      status: 'pending',
      dueDate: '2026-01-07T00:00:00Z',
      isOverdue: true,
      isDueSoon: false,
      daysUntilDue: -3,
    },
    {
      id: 'action-2',
      title: 'Former les employes au phishing',
      description: 'Formation trimestrielle',
      type: 'audit',
      status: 'in_progress',
      dueDate: '2026-01-13T00:00:00Z',
      isOverdue: false,
      isDueSoon: true,
      daysUntilDue: 3,
    },
    {
      id: 'action-3',
      title: 'Audit des acces',
      type: 'audit',
      status: 'pending',
      dueDate: '2026-02-10T00:00:00Z',
      isOverdue: false,
      isDueSoon: false,
      daysUntilDue: 31,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAssignedActions).mockReturnValue({
      actions: mockActions,
      count: 3,
      overdueCount: 1,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('should render the widget with correct count', () => {
    render(<RSSIActionsWidget organizationId="org-123" />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Actions Assignees')).toBeInTheDocument();
  });

  it('should display overdue count when there are overdue actions', () => {
    render(<RSSIActionsWidget organizationId="org-123" />);

    expect(screen.getByText('(1 en retard)')).toBeInTheDocument();
  });

  it('should display all action items', () => {
    render(<RSSIActionsWidget organizationId="org-123" />);

    expect(screen.getByText('Mettre a jour la politique de securite')).toBeInTheDocument();
    expect(screen.getByText('Former les employes au phishing')).toBeInTheDocument();
    expect(screen.getByText('Audit des acces')).toBeInTheDocument();
  });

  it('should display "En retard" badge for overdue actions', () => {
    render(<RSSIActionsWidget organizationId="org-123" />);

    expect(screen.getByText('En retard')).toBeInTheDocument();
  });

  it('should display days until due for due soon actions', () => {
    render(<RSSIActionsWidget organizationId="org-123" />);

    expect(screen.getByText('Dans 3 jours')).toBeInTheDocument();
  });

  it('should call onActionClick when an action is clicked', () => {
    const handleClick = vi.fn();
    render(<RSSIActionsWidget organizationId="org-123" onActionClick={handleClick} />);

    const firstAction = screen.getByText('Mettre a jour la politique de securite').closest('button');
    fireEvent.click(firstAction!);

    expect(handleClick).toHaveBeenCalledWith('action-1');
  });

  it('should call onViewAllClick when "Voir toutes les actions" is clicked', () => {
    const handleViewAll = vi.fn();
    render(<RSSIActionsWidget organizationId="org-123" onViewAllClick={handleViewAll} />);

    const viewAllButton = screen.getByText('Voir toutes les actions');
    fireEvent.click(viewAllButton);

    expect(handleViewAll).toHaveBeenCalled();
  });

  it('should show loading skeleton when loading', () => {
    vi.mocked(useAssignedActions).mockReturnValue({
      actions: [],
      count: 0,
      overdueCount: 0,
      previousCount: null,
      trend: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<RSSIActionsWidget organizationId="org-123" />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show empty state when no actions', () => {
    vi.mocked(useAssignedActions).mockReturnValue({
      actions: [],
      count: 0,
      overdueCount: 0,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<RSSIActionsWidget organizationId="org-123" />);

    expect(screen.getByText('Aucune action en attente')).toBeInTheDocument();
    expect(screen.getByText('Toutes les actions sont completees')).toBeInTheDocument();
  });

  it('should show error state and allow retry', () => {
    vi.mocked(useAssignedActions).mockReturnValue({
      actions: [],
      count: 0,
      overdueCount: 0,
      previousCount: null,
      trend: null,
      loading: false,
      error: new Error('Erreur de connexion'),
      refetch: mockRefetch,
    });

    render(<RSSIActionsWidget organizationId="org-123" />);

    expect(screen.getByText('Erreur de connexion')).toBeInTheDocument();

    const retryButton = screen.getByText('Reessayer');
    fireEvent.click(retryButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should have accessible region role', () => {
    render(<RSSIActionsWidget organizationId="org-123" />);

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Actions assignees');
  });

  it('should render different sizes', () => {
    const { rerender } = render(
      <RSSIActionsWidget organizationId="org-123" size="lg" />
    );

    expect(screen.getByText('3')).toHaveClass('text-4xl');

    rerender(<RSSIActionsWidget organizationId="org-123" size="sm" />);

    expect(screen.getByText('3')).toHaveClass('text-2xl');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <RSSIActionsWidget organizationId="org-123" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should show count in red when there are overdue actions', () => {
    render(<RSSIActionsWidget organizationId="org-123" />);

    const count = screen.getByText('3');
    expect(count).toHaveClass('text-red-600');
  });

  it('should show count in blue when no overdue actions', () => {
    vi.mocked(useAssignedActions).mockReturnValue({
      actions: [mockActions[2]],
      count: 1,
      overdueCount: 0,
      previousCount: null,
      trend: 'stable',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<RSSIActionsWidget organizationId="org-123" />);

    const count = screen.getByText('1');
    expect(count).toHaveClass('text-blue-600');
  });

  it('should pass userId to hook', () => {
    render(<RSSIActionsWidget organizationId="org-123" userId="user-456" />);

    expect(useAssignedActions).toHaveBeenCalledWith('org-123', 'user-456', 10);
  });
});
