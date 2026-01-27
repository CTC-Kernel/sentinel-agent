/**
 * AdminDashboard Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminDashboard from '../admin/AdminDashboard';

// Mock child components
vi.mock('../admin/components/GlobalMetrics', () => ({
    GlobalMetrics: () => <div data-testid="global-metrics">Global Metrics</div>
}));

vi.mock('../admin/components/TenantList', () => ({
    TenantList: () => <div data-testid="tenant-list">Tenant List</div>
}));

vi.mock('../admin/components/UserManagement', () => ({
    UserManagement: () => <div data-testid="user-management">User Management</div>
}));

vi.mock('../admin/components/SystemHealth', () => ({
    SystemHealth: () => <div data-testid="system-health">System Health</div>
}));

vi.mock('../admin/components/AuditLogList', () => ({
    AuditLogList: () => <div data-testid="audit-log-list">Audit Log List</div>
}));

describe('AdminDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render header with title', () => {
        render(<AdminDashboard />);

        expect(screen.getByText('Super Admin Console')).toBeInTheDocument();
        expect(screen.getByText(/Supervision globale/)).toBeInTheDocument();
    });

    it('should render all navigation tabs', () => {
        render(<AdminDashboard />);

        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Tenants')).toBeInTheDocument();
        expect(screen.getByText('Users')).toBeInTheDocument();
        expect(screen.getByText('System')).toBeInTheDocument();
        expect(screen.getByText('Audit')).toBeInTheDocument();
    });

    it('should show GlobalMetrics by default (overview tab)', () => {
        render(<AdminDashboard />);

        expect(screen.getByTestId('global-metrics')).toBeInTheDocument();
    });

    it('should switch to TenantList when tenants tab is clicked', () => {
        render(<AdminDashboard />);

        fireEvent.click(screen.getByText('Tenants'));

        expect(screen.getByTestId('tenant-list')).toBeInTheDocument();
        expect(screen.queryByTestId('global-metrics')).not.toBeInTheDocument();
    });

    it('should switch to UserManagement when users tab is clicked', () => {
        render(<AdminDashboard />);

        fireEvent.click(screen.getByText('Users'));

        expect(screen.getByTestId('user-management')).toBeInTheDocument();
    });

    it('should switch to SystemHealth when system tab is clicked', () => {
        render(<AdminDashboard />);

        fireEvent.click(screen.getByText('System'));

        expect(screen.getByTestId('system-health')).toBeInTheDocument();
    });

    it('should switch to AuditLogList when audit tab is clicked', () => {
        render(<AdminDashboard />);

        fireEvent.click(screen.getByText('Audit'));

        expect(screen.getByTestId('audit-log-list')).toBeInTheDocument();
    });

    it('should highlight active tab', () => {
        render(<AdminDashboard />);

        const overviewTab = screen.getByText('Overview');
        expect(overviewTab.className).toContain('bg-brand-50');

        fireEvent.click(screen.getByText('Tenants'));
        const tenantsTab = screen.getByText('Tenants');
        expect(tenantsTab.className).toContain('bg-brand-50');
    });
});
