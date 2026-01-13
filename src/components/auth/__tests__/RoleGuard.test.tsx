/**
 * RoleGuard Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { RoleGuard } from '../RoleGuard';

// Mock store
const mockUseStore = vi.fn();
vi.mock('../../../store', () => ({
    useStore: () => mockUseStore()
}));

// Mock ContentBlockerError
vi.mock('../../ui/ContentBlockerError', () => ({
    ContentBlockerError: () => React.createElement('div', { 'data-testid': 'content-blocker-error' }, 'Access Denied')
}));

describe('RoleGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render children when user has allowed role', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: 'manager' }
        });

        render(
            <BrowserRouter>
                <RoleGuard allowedRoles={['manager', 'admin']}>
                    <div data-testid="protected-content">Protected</div>
                </RoleGuard>
            </BrowserRouter>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should render children for admin user regardless of allowed roles', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: 'admin' }
        });

        render(
            <BrowserRouter>
                <RoleGuard allowedRoles={['manager']}>
                    <div data-testid="protected-content">Protected</div>
                </RoleGuard>
            </BrowserRouter>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should redirect to login when no user', () => {
        mockUseStore.mockReturnValue({
            user: null
        });

        render(
            <MemoryRouter initialEntries={['/admin']}>
                <RoleGuard allowedRoles={['admin']}>
                    <div>Protected</div>
                </RoleGuard>
            </MemoryRouter>
        );

        expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    });

    it('should show access denied when user role not allowed', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: 'user' }
        });

        render(
            <BrowserRouter>
                <RoleGuard allowedRoles={['admin', 'manager']}>
                    <div>Protected</div>
                </RoleGuard>
            </BrowserRouter>
        );

        expect(screen.getByTestId('content-blocker-error')).toBeInTheDocument();
        expect(screen.getByText(/Vous n'avez pas les droits/)).toBeInTheDocument();
    });

    it('should use default role "user" when role is undefined', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: undefined }
        });

        render(
            <BrowserRouter>
                <RoleGuard allowedRoles={['user']}>
                    <div data-testid="protected-content">Protected</div>
                </RoleGuard>
            </BrowserRouter>
        );

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should deny access when default role is not in allowed list', () => {
        mockUseStore.mockReturnValue({
            user: { id: 'user-1', role: undefined }
        });

        render(
            <BrowserRouter>
                <RoleGuard allowedRoles={['admin']}>
                    <div>Protected</div>
                </RoleGuard>
            </BrowserRouter>
        );

        expect(screen.getByTestId('content-blocker-error')).toBeInTheDocument();
    });
});
