/**
 * Unit tests for ResourceHistory component
 * Tests resource history display with timeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceHistory } from '../ResourceHistory';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) || key,
        i18n: { language: 'en', changeLanguage: vi.fn() }
    }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useLocale hook
vi.mock('../../../hooks/useLocale', () => ({
    useLocale: () => ({
        dateFnsLocale: undefined,
        locale: 'en',
        config: { intlLocale: 'en-US' },
        t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) || key
    })
}));

// Mock useResourceLogs hook
const mockLoadMore = vi.fn();
vi.mock('../../../hooks/useResourceLogs', () => ({
    useResourceLogs: vi.fn(() => ({
        logs: [],
        loading: false,
        hasMore: false,
        loadMore: mockLoadMore
    }))
}));

import { useResourceLogs } from '../../../hooks/useResourceLogs';
const mockedUseResourceLogs = useResourceLogs as unknown as ReturnType<typeof vi.fn>;

describe('ResourceHistory', () => {
    const defaultProps = {
        resourceId: 'resource-1',
        resourceType: 'Risk'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedUseResourceLogs.mockReturnValue({
            logs: [],
            loading: false,
            hasMore: false,
            loadMore: mockLoadMore
        });
    });

    describe('loading state', () => {
        it('shows loading state when loading and no logs', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [],
                loading: true,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText(/Loading history/)).toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('shows empty state when no logs', () => {
            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText('No history available for this item.')).toBeInTheDocument();
        });
    });

    describe('with logs', () => {
        const mockLogs = [
            {
                id: 'log-1',
                action: 'CREATE',
                timestamp: new Date('2024-01-15'),
                details: 'Created resource',
                userDisplayName: 'John Doe',
                userEmail: 'john@example.com'
            },
            {
                id: 'log-2',
                action: 'UPDATE',
                timestamp: new Date('2024-01-16'),
                details: 'Updated status',
                userDisplayName: 'Jane Doe',
                changes: [
                    { field: 'status', oldValue: 'Open', newValue: 'Closed' }
                ]
            }
        ];

        it('renders logs', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: mockLogs,
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText('Change History')).toBeInTheDocument();
        });

        it('shows log actions', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: mockLogs,
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText('CREATE')).toBeInTheDocument();
            expect(screen.getByText('UPDATE')).toBeInTheDocument();
        });

        it('shows log details', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: mockLogs,
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText('Created resource')).toBeInTheDocument();
            expect(screen.getByText('Updated status')).toBeInTheDocument();
        });

        it('shows user names', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: mockLogs,
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        });

        it('renders changes when available', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: mockLogs,
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText('status:')).toBeInTheDocument();
            expect(screen.getByText('Open')).toBeInTheDocument();
            expect(screen.getByText('Closed')).toBeInTheDocument();
        });
    });

    describe('load more', () => {
        it('shows load more button when hasMore', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{ id: 'log-1', action: 'CREATE', timestamp: new Date(), details: 'Test' }],
                loading: false,
                hasMore: true,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText('View more history')).toBeInTheDocument();
        });

        it('calls loadMore when button clicked', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{ id: 'log-1', action: 'CREATE', timestamp: new Date(), details: 'Test' }],
                loading: false,
                hasMore: true,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            fireEvent.click(screen.getByText('View more history'));

            expect(mockLoadMore).toHaveBeenCalled();
        });

        it('shows loading text when loading more', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{ id: 'log-1', action: 'CREATE', timestamp: new Date(), details: 'Test' }],
                loading: true,
                hasMore: true,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('hides load more button when no more logs', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{ id: 'log-1', action: 'CREATE', timestamp: new Date(), details: 'Test' }],
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.queryByText('View more history')).not.toBeInTheDocument();
        });
    });

    describe('action styling', () => {
        it('applies green styling for create action', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{ id: 'log-1', action: 'create', timestamp: new Date(), details: 'Created' }],
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            const { container } = render(<ResourceHistory {...defaultProps} />);

            expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
        });

        it('applies red styling for delete action', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{ id: 'log-1', action: 'delete', timestamp: new Date(), details: 'Deleted' }],
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            const { container } = render(<ResourceHistory {...defaultProps} />);

            expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
        });

        it('applies blue styling for update action', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{ id: 'log-1', action: 'update', timestamp: new Date(), details: 'Updated' }],
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            const { container } = render(<ResourceHistory {...defaultProps} />);

            expect(container.querySelector('.bg-blue-500')).toBeInTheDocument();
        });
    });

    describe('timestamp handling', () => {
        it('handles Firebase timestamp object', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{
                    id: 'log-1',
                    action: 'CREATE',
                    timestamp: { seconds: 1705340400 },
                    details: 'Test'
                }],
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            // Should not crash and should display date
            expect(screen.getByText('CREATE')).toBeInTheDocument();
        });

        it('handles Date object', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{
                    id: 'log-1',
                    action: 'CREATE',
                    timestamp: new Date('2024-01-15'),
                    details: 'Test'
                }],
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText(/January/)).toBeInTheDocument();
        });

        it('handles string timestamp', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{
                    id: 'log-1',
                    action: 'CREATE',
                    timestamp: '2024-01-15',
                    details: 'Test'
                }],
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            render(<ResourceHistory {...defaultProps} />);

            expect(screen.getByText('CREATE')).toBeInTheDocument();
        });
    });

    describe('className prop', () => {
        it('applies custom className', () => {
            mockedUseResourceLogs.mockReturnValue({
                logs: [{ id: 'log-1', action: 'CREATE', timestamp: new Date(), details: 'Test' }],
                loading: false,
                hasMore: false,
                loadMore: mockLoadMore
            });

            const { container } = render(<ResourceHistory {...defaultProps} className="custom-class" />);

            expect(container.firstChild).toHaveClass('custom-class');
        });
    });
});
