/**
 * Unit tests for ActivityLogList component
 * Tests activity log display with DataTable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ActivityLogList } from '../ActivityLogList';

// Mock date-fns
vi.mock('date-fns', () => ({
    format: vi.fn((date, formatStr) => {
        if (formatStr.includes('MMM')) return '15 Jan 2024';
        if (formatStr.includes('HH:mm')) return '14:30:00';
        return '2024-01-15';
    })
}));

vi.mock('date-fns/locale', () => ({
    fr: {}
}));

// Mock DataTable
vi.mock('../../ui/DataTable', () => ({
    DataTable: ({ data, columns, emptyState, loading }: {
        data: unknown[];
        columns: unknown[];
        emptyState: React.ReactNode;
        loading: boolean;
    }) => (
        <div data-testid="data-table">
            {loading && <div>Loading...</div>}
            {data.length === 0 && !loading && emptyState}
            {data.length > 0 && (
                <table>
                    <tbody>
                        {data.map((item: { id: string }, index: number) => (
                            <tr key={index} data-testid={`row-${item.id || index}`}>
                                <td>Row {index}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}));

describe('ActivityLogList', () => {
    const mockOnLoadMore = vi.fn();

    const mockLogs = [
        {
            id: 'log-1',
            timestamp: '2024-01-15T10:00:00',
            userEmail: 'user@example.com',
            action: 'create',
            resource: 'Risk',
            resourceId: 'risk-1',
            details: 'Created a new risk',
            changes: []
        },
        {
            id: 'log-2',
            timestamp: '2024-01-15T11:00:00',
            userEmail: 'admin@example.com',
            action: 'update',
            resource: 'Asset',
            resourceId: 'asset-1',
            details: 'Updated asset',
            changes: [
                { field: 'status', oldValue: 'active', newValue: 'inactive' }
            ]
        }
    ];

    const defaultProps = {
        logs: mockLogs,
        loading: false,
        hasMore: true,
        onLoadMore: mockOnLoadMore
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = (props = {}) => {
        return render(
            <BrowserRouter>
                <ActivityLogList {...defaultProps} {...props} />
            </BrowserRouter>
        );
    };

    describe('rendering', () => {
        it('renders DataTable', () => {
            renderComponent();

            expect(screen.getByTestId('data-table')).toBeInTheDocument();
        });

        it('renders rows for each log', () => {
            renderComponent();

            expect(screen.getByTestId('row-log-1')).toBeInTheDocument();
            expect(screen.getByTestId('row-log-2')).toBeInTheDocument();
        });
    });

    describe('load more button', () => {
        it('renders load more button when hasMore is true', () => {
            renderComponent();

            expect(screen.getByText("Charger plus d'activités")).toBeInTheDocument();
        });

        it('does not render load more button when hasMore is false', () => {
            renderComponent({ hasMore: false });

            expect(screen.queryByText("Charger plus d'activités")).not.toBeInTheDocument();
        });

        it('calls onLoadMore when clicked', () => {
            renderComponent();

            fireEvent.click(screen.getByText("Charger plus d'activités"));

            expect(mockOnLoadMore).toHaveBeenCalled();
        });

        it('shows loading text when loading', () => {
            renderComponent({ loading: true });

            expect(screen.getByText('Chargement...')).toBeInTheDocument();
        });

        it('disables button when loading', () => {
            renderComponent({ loading: true });

            expect(screen.getByText('Chargement...')).toBeDisabled();
        });
    });

    describe('empty state', () => {
        it('shows empty state when no logs', () => {
            renderComponent({ logs: [] });

            expect(screen.getByText('Aucune activité enregistrée')).toBeInTheDocument();
        });
    });
});
