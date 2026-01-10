import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RSSIDashboardWidget } from '../RSSIDashboardWidget';
import { canViewRSSIDashboard } from '../utils';
import type { UserWithRole } from '../../../utils/roleUtils';

// Mock child components
vi.mock('../RSSICriticalRisksWidget', () => ({
  RSSICriticalRisksWidget: vi.fn(({ organizationId }) => (
    <div data-testid="risks-widget">Risks Widget for {organizationId}</div>
  )),
}));

vi.mock('../RSSIIncidentsWidget', () => ({
  RSSIIncidentsWidget: vi.fn(({ organizationId }) => (
    <div data-testid="incidents-widget">Incidents Widget for {organizationId}</div>
  )),
}));

vi.mock('../RSSIActionsWidget', () => ({
  RSSIActionsWidget: vi.fn(({ organizationId, userId }) => (
    <div data-testid="actions-widget">Actions Widget for {organizationId} user {userId || 'none'}</div>
  )),
}));

describe('RSSIDashboardWidget', () => {
  const mockRSSIUser: UserWithRole = {
    id: 'user-123',
    role: 'rssi',
  };

  const mockAdminUser: UserWithRole = {
    id: 'user-456',
    role: 'admin',
  };

  const mockRegularUser: UserWithRole = {
    id: 'user-789',
    role: 'user',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all 3 widgets for RSSI user', () => {
    render(<RSSIDashboardWidget organizationId="org-123" user={mockRSSIUser} />);

    expect(screen.getByTestId('risks-widget')).toBeInTheDocument();
    expect(screen.getByTestId('incidents-widget')).toBeInTheDocument();
    expect(screen.getByTestId('actions-widget')).toBeInTheDocument();
  });

  it('should render all 3 widgets for admin user', () => {
    render(<RSSIDashboardWidget organizationId="org-123" user={mockAdminUser} />);

    expect(screen.getByTestId('risks-widget')).toBeInTheDocument();
    expect(screen.getByTestId('incidents-widget')).toBeInTheDocument();
    expect(screen.getByTestId('actions-widget')).toBeInTheDocument();
  });

  it('should show not authorized message for regular user', () => {
    render(<RSSIDashboardWidget organizationId="org-123" user={mockRegularUser} />);

    expect(screen.getByText('Acces non autorise')).toBeInTheDocument();
    expect(screen.getByText('Cette vue est reservee aux responsables securite (RSSI)')).toBeInTheDocument();
    expect(screen.queryByTestId('risks-widget')).not.toBeInTheDocument();
  });

  it('should show not authorized when user is null', () => {
    render(<RSSIDashboardWidget organizationId="org-123" user={null} />);

    expect(screen.getByText('Acces non autorise')).toBeInTheDocument();
  });

  it('should skip role check when skipRoleCheck is true', () => {
    render(
      <RSSIDashboardWidget
        organizationId="org-123"
        user={mockRegularUser}
        skipRoleCheck={true}
      />
    );

    expect(screen.getByTestId('risks-widget')).toBeInTheDocument();
    expect(screen.getByTestId('incidents-widget')).toBeInTheDocument();
    expect(screen.getByTestId('actions-widget')).toBeInTheDocument();
  });

  it('should display dashboard title', () => {
    render(<RSSIDashboardWidget organizationId="org-123" user={mockRSSIUser} />);

    expect(screen.getByText('Vue Securite (RSSI)')).toBeInTheDocument();
    expect(screen.getByText('Risques critiques, incidents actifs et actions en cours')).toBeInTheDocument();
  });

  it('should have accessible region role', () => {
    render(<RSSIDashboardWidget organizationId="org-123" user={mockRSSIUser} />);

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Tableau de bord RSSI');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <RSSIDashboardWidget
        organizationId="org-123"
        user={mockRSSIUser}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should pass user id to actions widget', () => {
    render(<RSSIDashboardWidget organizationId="org-123" user={mockRSSIUser} />);

    expect(screen.getByTestId('actions-widget')).toHaveTextContent('user user-123');
  });
});

describe('canViewRSSIDashboard', () => {
  it('should return true for rssi role', () => {
    const user: UserWithRole = { id: 'user-1', role: 'rssi' };
    expect(canViewRSSIDashboard(user)).toBe(true);
  });

  it('should return true for admin role', () => {
    const user: UserWithRole = { id: 'user-1', role: 'admin' };
    expect(canViewRSSIDashboard(user)).toBe(true);
  });

  it('should return false for regular user role', () => {
    const user: UserWithRole = { id: 'user-1', role: 'user' };
    expect(canViewRSSIDashboard(user)).toBe(false);
  });

  it('should return false for direction role', () => {
    const user: UserWithRole = { id: 'user-1', role: 'direction' };
    expect(canViewRSSIDashboard(user)).toBe(false);
  });

  it('should return false for auditor role', () => {
    const user: UserWithRole = { id: 'user-1', role: 'auditor' };
    expect(canViewRSSIDashboard(user)).toBe(false);
  });

  it('should return false for project_manager role', () => {
    const user: UserWithRole = { id: 'user-1', role: 'project_manager' };
    expect(canViewRSSIDashboard(user)).toBe(false);
  });

  it('should return false for null user', () => {
    expect(canViewRSSIDashboard(null)).toBe(false);
  });

  it('should return false for undefined user', () => {
    expect(canViewRSSIDashboard(undefined)).toBe(false);
  });

  it('should return true for user with rssi in roles array', () => {
    const user: UserWithRole = {
      id: 'user-1',
      role: 'user',
      roles: ['user', 'rssi']
    };
    expect(canViewRSSIDashboard(user)).toBe(true);
  });
});
