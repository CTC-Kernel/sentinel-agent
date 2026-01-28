/**
 * Unit tests for TimelineView component
 * Tests timeline view with event selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineView } from '../TimelineView';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick }: React.PropsWithChildren<{ className?: string; onClick?: () => void }>) => (
            <div
                role="button"
                tabIndex={0}
                className={className}
                onClick={onClick}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
            >
                {children}
            </div>
        )
    },
    AnimatePresence: ({ children }: React.PropsWithChildren<{ mode?: string }>) => <>{children}</>
}));

// Mock react-diff-viewer
vi.mock('react-diff-viewer-continued', () => ({
    default: ({ oldValue, newValue }: { oldValue: string; newValue: string }) => (
        <div data-testid="diff-viewer">
            <pre>{oldValue}</pre>
            <pre>{newValue}</pre>
        </div>
    )
}));

// Mock useTimelineData hook
const mockSystemLogs: Array<{
    id: string;
    resourceId: string;
    resource: string;
    action: string;
    timestamp: string;
    userId: string;
    userDisplayName: string;
    userEmail: string;
    details: string;
    changes?: Array<{ field: string; oldValue: string; newValue: string }>;
    metadata?: Record<string, unknown>;
}> = [];

vi.mock('../../../hooks/timeline/useTimelineData', () => ({
    useTimelineData: vi.fn(() => ({
        systemLogs: mockSystemLogs,
        loading: false
    }))
}));

import { useTimelineData } from '../../../hooks/timeline/useTimelineData';
const mockedUseTimelineData = useTimelineData as unknown as ReturnType<typeof vi.fn>;

describe('TimelineView', () => {
    const defaultProps = {
        resourceId: 'resource-1'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedUseTimelineData.mockReturnValue({
            systemLogs: [],
            loading: false
        });
    });

    describe('loading state', () => {
        it('shows loading spinner when loading', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: [],
                loading: true
            });

            const { container } = render(<TimelineView {...defaultProps} />);

            expect(container.querySelector('.animate-spin')).toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('shows empty state when no logs', () => {
            render(<TimelineView {...defaultProps} />);

            expect(screen.getByText('Aucun historique disponible')).toBeInTheDocument();
        });
    });

    describe('with logs', () => {
        const mockLogs = [
            {
                id: 'log-1',
                resourceId: 'resource-1',
                resource: 'Risk',
                action: 'create',
                timestamp: '2024-01-15T10:00:00',
                userId: 'user-1',
                userDisplayName: 'John Doe',
                userEmail: 'john@example.com',
                details: 'Created risk',
                changes: [
                    { field: 'status', oldValue: '', newValue: 'Open' }
                ]
            },
            {
                id: 'log-2',
                resourceId: 'resource-1',
                resource: 'Risk',
                action: 'update',
                timestamp: '2024-01-16T14:00:00',
                userId: 'user-2',
                userDisplayName: 'Jane Doe',
                userEmail: 'jane@example.com',
                details: 'Updated status',
                changes: [
                    { field: 'status', oldValue: 'Open', newValue: 'Closed' }
                ]
            }
        ];

        it('renders timeline header', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            expect(screen.getByText(/Timeline/)).toBeInTheDocument();
        });

        it('renders log count', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            expect(screen.getByText('Timeline (2)')).toBeInTheDocument();
        });

        it('renders user names', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        });

        it('renders action badges', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            expect(screen.getByText('create')).toBeInTheDocument();
            expect(screen.getByText('update')).toBeInTheDocument();
        });

        it('renders change descriptions', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            expect(screen.getAllByText(/status:/).length).toBeGreaterThan(0);
        });
    });

    describe('event selection', () => {
        const mockLogs = [
            {
                id: 'log-1',
                resourceId: 'resource-1',
                resource: 'Risk',
                action: 'update',
                timestamp: '2024-01-15T10:00:00',
                userId: 'user-1',
                userDisplayName: 'John Doe',
                userEmail: 'john@example.com',
                details: 'Updated risk',
                changes: [
                    { field: 'status', oldValue: 'Open', newValue: 'Closed' }
                ]
            }
        ];

        it('shows selection prompt when no event selected', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            expect(screen.getByText('Sélectionnez un événement')).toBeInTheDocument();
        });

        it('shows event details when event selected', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            // Click on the event card
            const eventCard = screen.getByRole('button');
            fireEvent.click(eventCard);

            expect(screen.getByText("Détails de l'événement")).toBeInTheDocument();
        });

        it('shows author in details panel', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            expect(screen.getByText('Auteur')).toBeInTheDocument();
        });

        it('shows date in details panel', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            expect(screen.getByText('Date')).toBeInTheDocument();
        });

        it('shows close button in details panel', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            expect(screen.getByText('Fermer')).toBeInTheDocument();
        });

        it('closes details panel when close clicked', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            // Open panel
            fireEvent.click(screen.getByRole('button'));
            expect(screen.getByText("Détails de l'événement")).toBeInTheDocument();

            // Close panel
            fireEvent.click(screen.getByText('Fermer'));
            expect(screen.getByText('Sélectionnez un événement')).toBeInTheDocument();
        });
    });

    describe('diff viewer', () => {
        const mockLogs = [
            {
                id: 'log-1',
                resourceId: 'resource-1',
                resource: 'Risk',
                action: 'update',
                timestamp: '2024-01-15T10:00:00',
                userId: 'user-1',
                userDisplayName: 'John Doe',
                userEmail: 'john@example.com',
                details: 'Updated risk',
                changes: [
                    { field: 'status', oldValue: 'Open', newValue: 'Closed' }
                ]
            }
        ];

        it('shows diff viewer for events with changes', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: mockLogs,
                loading: false
            });

            render(<TimelineView {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));

            expect(screen.getByText('Visualisation des changements')).toBeInTheDocument();
            expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
        });
    });

    describe('filtering by resourceId', () => {
        it('only shows logs for the specified resource', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: [
                    {
                        id: 'log-1',
                        resourceId: 'resource-1',
                        action: 'create',
                        timestamp: '2024-01-15',
                        userDisplayName: 'User 1'
                    },
                    {
                        id: 'log-2',
                        resourceId: 'resource-2',
                        action: 'update',
                        timestamp: '2024-01-16',
                        userDisplayName: 'User 2'
                    }
                ],
                loading: false
            });

            render(<TimelineView resourceId="resource-1" />);

            expect(screen.getByText('Timeline (1)')).toBeInTheDocument();
            expect(screen.getByText('User 1')).toBeInTheDocument();
            expect(screen.queryByText('User 2')).not.toBeInTheDocument();
        });
    });

    describe('className prop', () => {
        it('applies custom className', () => {
            mockedUseTimelineData.mockReturnValue({
                systemLogs: [
                    {
                        id: 'log-1',
                        resourceId: 'resource-1',
                        action: 'create',
                        timestamp: '2024-01-15',
                        userDisplayName: 'User 1'
                    }
                ],
                loading: false
            });

            const { container } = render(<TimelineView {...defaultProps} className="custom-class" />);

            expect(container.firstChild).toHaveClass('custom-class');
        });
    });
});
