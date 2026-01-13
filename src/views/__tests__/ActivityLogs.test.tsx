/**
 * ActivityLogs View Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ActivityLogs } from '../ActivityLogs';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) =>
            <div {...props}>{children}</div>
    }
}));

// Mock store
vi.mock('../../store', () => ({
    useStore: () => ({
        t: (key: string) => key
    })
}));

// Mock useActivityLogs hook
const mockRefresh = vi.fn();
const mockLoadMore = vi.fn();
const mockExportLogs = vi.fn();
const mockSetFilter = vi.fn();

vi.mock('../../hooks/useActivityLogs', () => ({
    useActivityLogs: () => ({
        logs: [
            { id: 'log-1', action: 'CREATE', resource: 'Risk', timestamp: '2024-01-01T00:00:00Z' }
        ],
        loading: false,
        hasMore: true,
        loadMore: mockLoadMore,
        refresh: mockRefresh,
        filter: { action: '', resource: '' },
        setFilter: mockSetFilter,
        stats: { scansToday: 10, criticalAlerts: 2, activeAdmins: 5 },
        exportLogs: mockExportLogs
    })
}));

// Mock components
vi.mock('../../components/activity/ActivityLogList', () => ({
    ActivityLogList: () => <div data-testid="activity-log-list">Activity Log List</div>
}));

vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title, actions }: { title: string; actions: React.ReactNode }) => (
        <div data-testid="page-header">
            <h1>{title}</h1>
            <div>{actions}</div>
        </div>
    )
}));

vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

vi.mock('../../components/ui/PremiumPageControl', () => ({
    PremiumPageControl: () => <div data-testid="premium-page-control" />
}));

vi.mock('../../components/ui/CustomSelect', () => ({
    CustomSelect: () => <select data-testid="custom-select" />
}));

describe('ActivityLogs View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <ActivityLogs />
            </BrowserRouter>
        );
    };

    it('should render page header with title', () => {
        renderComponent();

        expect(screen.getByTestId('page-header')).toBeInTheDocument();
        expect(screen.getByText('activity.title')).toBeInTheDocument();
    });

    it('should render MasterpieceBackground', () => {
        renderComponent();

        expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
    });

    it('should render export button', () => {
        renderComponent();

        expect(screen.getByText('activity.exportCsv')).toBeInTheDocument();
    });

    it('should call exportLogs when export button is clicked', () => {
        renderComponent();

        const exportButton = screen.getAllByText('activity.exportCsv')[0];
        fireEvent.click(exportButton.closest('button')!);

        expect(mockExportLogs).toHaveBeenCalled();
    });

    it('should call refresh when refresh button is clicked', () => {
        renderComponent();

        const refreshButton = screen.getByTitle('activity.refresh');
        fireEvent.click(refreshButton);

        expect(mockRefresh).toHaveBeenCalled();
    });

    it('should display stats', () => {
        renderComponent();

        expect(screen.getByText('10')).toBeInTheDocument(); // scansToday
        expect(screen.getByText('2')).toBeInTheDocument(); // criticalAlerts
        expect(screen.getByText('5')).toBeInTheDocument(); // activeAdmins
    });

    it('should display stat labels', () => {
        renderComponent();

        expect(screen.getByText('activity.stats.today')).toBeInTheDocument();
        expect(screen.getByText('activity.stats.critical')).toBeInTheDocument();
        expect(screen.getByText('activity.stats.admins')).toBeInTheDocument();
    });
});
