
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        user: { uid: 'test-user', organizationId: 'test-org', role: 'admin' },
        theme: 'light',
        addToast: vi.fn(),
        t: (k: string) => k
    }),
}));

vi.mock('../../hooks/dashboard/useDashboardData', () => ({
    useDashboardData: vi.fn().mockReturnValue({
        controls: [],
        recentActivity: [],
        historyStats: [],
        allRisks: [],
        allAssets: [],
        allSuppliers: [],
        myProjects: [],
        myAudits: [],
        myDocs: [],
        publishedDocs: [],
        pendingReviews: [],
        myIncidents: [],
        activeIncidentsCount: 0,
        openAuditsCount: 0,
        organizationName: 'Test Org',
        organizationLogo: null,
        loading: false,
        error: null
    })
}));

vi.mock('../../hooks/dashboard/useDashboardMetrics', () => ({
    useDashboardMetrics: vi.fn().mockReturnValue({
        historyData: [],
        topRisks: [],
        stats: { financialRisk: 0 },
        radarData: [],
        complianceScore: 85,
        scoreGrade: 'A'
    })
}));

vi.mock('../../hooks/dashboard/useDashboardInsights', () => ({
    useDashboardInsights: vi.fn().mockReturnValue({
        insight: { type: 'success', message: 'Test Insight' },
        healthIssues: [],
        myActionItems: []
    })
}));

vi.mock('../../hooks/dashboard/useDashboardStatsHistory', () => ({
    useDashboardStatsHistory: vi.fn()
}));

vi.mock('../../hooks/dashboard/useDashboardReports', () => ({
    useDashboardReports: vi.fn().mockReturnValue({
        isGeneratingReport: false,
        generateICal: vi.fn(),
        generateExecutiveReport: vi.fn()
    })
}));

vi.mock('../../utils/permissions', () => ({
    hasPermission: vi.fn().mockReturnValue(true)
}));

// Mock Child Components
vi.mock('../../components/dashboard/widgets/DashboardHeader', () => ({
    DashboardHeader: () => <div data-testid="dashboard-header" />
}));
vi.mock('../../components/dashboard/widgets/QuickActions', () => ({
    QuickActions: () => <div data-testid="quick-actions" />
}));
vi.mock('../../components/dashboard/widgets/GettingStartedWidget', () => ({
    GettingStartedWidget: () => <div data-testid="getting-started-widget" />
}));
vi.mock('../../components/dashboard/ApprovalsWidget', () => ({
    ApprovalsWidget: () => <div data-testid="approvals-widget" />
}));
vi.mock('../../components/skeletons/DashboardSkeleton', () => ({
    DashboardSkeleton: () => <div data-testid="dashboard-skeleton" />
}));
vi.mock('../../components/dashboard/views/AdminDashboardView', () => ({
    AdminDashboardView: () => <div data-testid="admin-dashboard-view" />
}));
vi.mock('../../components/dashboard/views/DirectionDashboardView', () => ({
    DirectionDashboardView: () => <div data-testid="direction-dashboard-view" />
}));
vi.mock('../../components/dashboard/views/AuditorDashboardView', () => ({
    AuditorDashboardView: () => <div data-testid="auditor-dashboard-view" />
}));
vi.mock('../../components/dashboard/views/ProjectManagerDashboardView', () => ({
    ProjectManagerDashboardView: () => <div data-testid="project-manager-dashboard-view" />
}));
vi.mock('../../components/dashboard/views/OperationalDashboardView', () => ({
    OperationalDashboardView: () => <div data-testid="operational-dashboard-view" />
}));

vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => null
}));

vi.mock('../../components/SEO', () => ({
    SEO: () => null
}));

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe('Dashboard View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the dashboard with header and default widgets', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
        expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
        expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
    });

    it('renders the admin view when user has permission', () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        expect(screen.getByTestId('admin-dashboard-view')).toBeInTheDocument();
    });
});
