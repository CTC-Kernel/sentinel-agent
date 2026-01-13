/**
 * PageHeader Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../PageHeader';

// Mock SecurityBadge
vi.mock('../SecurityBadge', () => ({
    SecurityBadge: ({ feature }: { feature: string }) =>
        React.createElement('span', { 'data-testid': 'security-badge' }, feature)
}));

describe('PageHeader', () => {
    it('should render title', () => {
        render(<PageHeader title="Dashboard" />);

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
    });

    it('should render subtitle when provided', () => {
        render(
            <PageHeader
                title="Settings"
                subtitle="Manage your account settings"
            />
        );

        expect(screen.getByText('Manage your account settings')).toBeInTheDocument();
    });

    it('should not render subtitle when not provided', () => {
        render(<PageHeader title="Settings" />);

        expect(screen.queryByText('Manage your account settings')).not.toBeInTheDocument();
    });

    it('should render actions when provided', () => {
        render(
            <PageHeader
                title="Users"
                actions={<button data-testid="add-user-btn">Add User</button>}
            />
        );

        expect(screen.getByTestId('add-user-btn')).toBeInTheDocument();
        expect(screen.getByText('Add User')).toBeInTheDocument();
    });

    it('should render icon when provided', () => {
        render(
            <PageHeader
                title="Dashboard"
                icon={<img src="/icon.png" alt="Dashboard icon" />}
            />
        );

        expect(screen.getByAltText('Dashboard icon')).toBeInTheDocument();
    });

    it('should render security badge when trustType is provided', () => {
        render(
            <PageHeader
                title="Secure Page"
                trustType="encryption"
            />
        );

        expect(screen.getByTestId('security-badge')).toBeInTheDocument();
        expect(screen.getByText('encryption')).toBeInTheDocument();
    });

    it('should not render security badge when trustType is not provided', () => {
        render(<PageHeader title="Regular Page" />);

        expect(screen.queryByTestId('security-badge')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
        const { container } = render(
            <PageHeader title="Test" className="custom-header-class" />
        );

        expect(container.firstChild).toHaveClass('custom-header-class');
    });

    it('should render multiple actions', () => {
        render(
            <PageHeader
                title="Documents"
                actions={
                    <>
                        <button data-testid="btn-1">Export</button>
                        <button data-testid="btn-2">Import</button>
                    </>
                }
            />
        );

        expect(screen.getByTestId('btn-1')).toBeInTheDocument();
        expect(screen.getByTestId('btn-2')).toBeInTheDocument();
    });

    it('should render icon and title together', () => {
        render(
            <PageHeader
                title="Reports"
                icon={<span data-testid="report-icon">📊</span>}
            />
        );

        expect(screen.getByTestId('report-icon')).toBeInTheDocument();
        expect(screen.getByText('Reports')).toBeInTheDocument();
    });
});
