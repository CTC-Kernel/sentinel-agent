import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PMDashboardWidget } from '../PMDashboardWidget';
import { canViewPMDashboard } from '../utils';
import type { UserWithRole } from '../../../utils/roleUtils';

// Mock child components
vi.mock('../PMProgressWidget', () => ({
 PMProgressWidget: vi.fn(({ organizationId }) => (
 <div data-testid="progress-widget">Progress Widget for {organizationId}</div>
 )),
}));

vi.mock('../PMTimelineWidget', () => ({
 PMTimelineWidget: vi.fn(({ organizationId }) => (
 <div data-testid="timeline-widget">Timeline Widget for {organizationId}</div>
 )),
}));

vi.mock('../PMActionsOverdueWidget', () => ({
 PMActionsOverdueWidget: vi.fn(({ organizationId }) => (
 <div data-testid="overdue-widget">Overdue Widget for {organizationId}</div>
 )),
}));

describe('PMDashboardWidget', () => {
 const mockPMUser: UserWithRole = {
 id: 'user-123',
 role: 'project_manager',
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

 it('should render all 3 widgets for project_manager user', () => {
 render(<PMDashboardWidget organizationId="org-123" user={mockPMUser} />);

 expect(screen.getByTestId('progress-widget')).toBeInTheDocument();
 expect(screen.getByTestId('timeline-widget')).toBeInTheDocument();
 expect(screen.getByTestId('overdue-widget')).toBeInTheDocument();
 });

 it('should render all 3 widgets for admin user', () => {
 render(<PMDashboardWidget organizationId="org-123" user={mockAdminUser} />);

 expect(screen.getByTestId('progress-widget')).toBeInTheDocument();
 expect(screen.getByTestId('timeline-widget')).toBeInTheDocument();
 expect(screen.getByTestId('overdue-widget')).toBeInTheDocument();
 });

 it('should show not authorized message for regular user', () => {
 render(<PMDashboardWidget organizationId="org-123" user={mockRegularUser} />);

 expect(screen.getByText('Accès non autorisé')).toBeInTheDocument();
 expect(screen.getByText('Cette vue est réservée aux chefs de projet')).toBeInTheDocument();
 expect(screen.queryByTestId('progress-widget')).not.toBeInTheDocument();
 });

 it('should show not authorized when user is null', () => {
 render(<PMDashboardWidget organizationId="org-123" user={null} />);

 expect(screen.getByText('Accès non autorisé')).toBeInTheDocument();
 });

 it('should skip role check when skipRoleCheck is true', () => {
 render(
 <PMDashboardWidget
 organizationId="org-123"
 user={mockRegularUser}
 skipRoleCheck={true}
 />
 );

 expect(screen.getByTestId('progress-widget')).toBeInTheDocument();
 expect(screen.getByTestId('timeline-widget')).toBeInTheDocument();
 expect(screen.getByTestId('overdue-widget')).toBeInTheDocument();
 });

 it('should display dashboard title', () => {
 render(<PMDashboardWidget organizationId="org-123" user={mockPMUser} />);

 expect(screen.getByText('Vue Chef de Projet')).toBeInTheDocument();
 expect(screen.getByText('Progression du projet, échéances et actions en retard')).toBeInTheDocument();
 });

 it('should have accessible region role', () => {
 render(<PMDashboardWidget organizationId="org-123" user={mockPMUser} />);

 expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Tableau de bord Chef de Projet');
 });

 it('should apply custom className', () => {
 const { container } = render(
 <PMDashboardWidget
 organizationId="org-123"
 user={mockPMUser}
 className="custom-class"
 />
 );

 expect(container.firstChild).toHaveClass('custom-class');
 });
});

describe('canViewPMDashboard', () => {
 it('should return true for project_manager role', () => {
 const user: UserWithRole = { id: 'user-1', role: 'project_manager' };
 expect(canViewPMDashboard(user)).toBe(true);
 });

 it('should return true for admin role', () => {
 const user: UserWithRole = { id: 'user-1', role: 'admin' };
 expect(canViewPMDashboard(user)).toBe(true);
 });

 it('should return false for regular user role', () => {
 const user: UserWithRole = { id: 'user-1', role: 'user' };
 expect(canViewPMDashboard(user)).toBe(false);
 });

 it('should return false for rssi role', () => {
 const user: UserWithRole = { id: 'user-1', role: 'rssi' };
 expect(canViewPMDashboard(user)).toBe(false);
 });

 it('should return false for direction role', () => {
 const user: UserWithRole = { id: 'user-1', role: 'direction' };
 expect(canViewPMDashboard(user)).toBe(false);
 });

 it('should return false for auditor role', () => {
 const user: UserWithRole = { id: 'user-1', role: 'auditor' };
 expect(canViewPMDashboard(user)).toBe(false);
 });

 it('should return false for null user', () => {
 expect(canViewPMDashboard(null)).toBe(false);
 });

 it('should return false for undefined user', () => {
 expect(canViewPMDashboard(undefined)).toBe(false);
 });

 it('should return true for user with project_manager in roles array', () => {
 const user: UserWithRole = {
 id: 'user-1',
 role: 'user',
 roles: ['user', 'project_manager']
 };
 expect(canViewPMDashboard(user)).toBe(true);
 });
});
