/**
 * RoleGuard Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGuard } from '../RoleGuard';

// Mock store
const mockUseStore = vi.fn();
vi.mock('../../../store', () => ({
    useStore: () => mockUseStore()
}));

vi.mock('../../ui/ContentBlockerError', () => ({
    ContentBlockerError: () => React.createElement('div', { 'data-testid': 'content-blocker-error' }, 'Access Denied')
}));

// Mock react-router-dom to avoid routing hangs
vi.mock('react-router-dom', () => ({
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
    Outlet: () => <div data-testid="outlet" />,
    useLocation: () => ({ pathname: '/test' }),
    useNavigate: () => vi.fn()
}));

describe('RoleGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render children when user has allowed role', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: 'project_manager' }
        });

        render(
            <RoleGuard allowedRoles={['project_manager', 'admin']}>
                <div data-testid="protected-content">Protected</div>
            </RoleGuard>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should render children for admin user regardless of allowed roles', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: 'admin' }
        });

        render(
            <RoleGuard allowedRoles={['project_manager']}>
                <div data-testid="protected-content">Protected</div>
            </RoleGuard>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should redirect to login when no user', () => {
        mockUseStore.mockReturnValue({
            user: null
        });

        render(
            <RoleGuard allowedRoles={['admin']}>
                <div>Protected</div>
            </RoleGuard>
        );

        expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    });

    it('should show access denied when user role not allowed', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: 'user' }
        });

        render(
            <RoleGuard allowedRoles={['admin', 'project_manager']}>
                <div>Protected</div>
            </RoleGuard>
        );

        expect(screen.getByTestId('content-blocker-error')).toBeInTheDocument();
        expect(screen.getByText(/Vous n'avez pas les droits/)).toBeInTheDocument();
    });

    it('should use default role "user" when role is undefined', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: undefined }
        });

        render(
            <RoleGuard allowedRoles={['user']}>
                <div data-testid="protected-content">Protected</div>
            </RoleGuard>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should deny access when default role is not in allowed list', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: undefined }
        });

        render(
            <RoleGuard allowedRoles={['admin']}>
                <div>Protected</div>
            </RoleGuard>
        );

        expect(screen.getByTestId('content-blocker-error')).toBeInTheDocument();
    });
});
