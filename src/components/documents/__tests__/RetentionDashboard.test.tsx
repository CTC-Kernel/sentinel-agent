/**
 * RetentionDashboard Tests
 *
 * Tests for the RetentionDashboard component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RetentionDashboard from '../RetentionDashboard';
import {
    getRetentionStats,
    getPolicies,
    getDocumentsNearExpiry,
    getExpiredDocuments,
    getDocumentAgeDistribution
} from '@/services/retentionService';

// Mock dependencies
vi.mock('@/store', () => ({
    useStore: () => ({
        user: { id: 'test-user', organizationId: 'org-test' },
        organization: { id: 'org-test' },
    }),
}));

vi.mock('@/hooks/documents/useDocumentsData', () => ({
    useDocumentsData: () => ({
        refresh: vi.fn(),
    }),
}));
// Also mock the relative path just in case
vi.mock('../../hooks/documents/useDocumentsData', () => ({
    useDocumentsData: () => ({
        refresh: vi.fn(),
    }),
}));

vi.mock('@/hooks/useLocale', () => ({
    useLocale: () => ({
        formatDate: (_date: unknown) => '01/01/2023',
        t: (key: string, fallback?: string) => fallback || key,
        locale: 'fr',
    }),
}));

vi.mock('@/services/retentionService', () => ({
    RetentionService: {
        getRetentionStats: vi.fn(),
        getDocumentsNearExpiry: vi.fn(),
        getExpiredDocuments: vi.fn(),
        getDocumentAgeDistribution: vi.fn(),
        getPolicies: vi.fn(),
        getPolicy: vi.fn(),
        createPolicy: vi.fn(),
        updatePolicy: vi.fn(),
        deletePolicy: vi.fn(),
    },
    getRetentionStats: vi.fn(),
    getDocumentsNearExpiry: vi.fn(),
    getExpiredDocuments: vi.fn(),
    getDocumentAgeDistribution: vi.fn(),
    getPolicies: vi.fn(),
    getPolicy: vi.fn(),
    createPolicy: vi.fn(),
    updatePolicy: vi.fn(),
    deletePolicy: vi.fn(),
}));

// Mock UI components that might cause issues in jsdom or are not relevant for logic testing
// Mock UI components that might cause issues in jsdom or are not relevant for logic testing
vi.mock('@/components/ui/card', () => ({
    Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={`mock-card ${className}`}>{children}</div>,
    CardHeader: ({ children }: { children: React.ReactNode }) => <div className="mock-card-header">{children}</div>,
    CardTitle: ({ children }: { children: React.ReactNode }) => <div className="mock-card-title">{children}</div>,
    CardContent: ({ children }: { children: React.ReactNode }) => <div className="mock-card-content">{children}</div>,
    CardDescription: ({ children }: { children: React.ReactNode }) => <div className="mock-card-description">{children}</div>,
}));

// Mock Recharts mainly because it does not render well in JSDOM sometimes
vi.mock('recharts', () => {
    const OriginalModule = vi.importActual('recharts');
    return {
        ...OriginalModule,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div className="recharts-responsive-container">{children}</div>,
        BarChart: ({ children }: { children: React.ReactNode }) => <div className="recharts-bar-chart">{children}</div>,
        Bar: () => <div />,
        XAxis: () => <div />,
        YAxis: () => <div />,
        CartesianGrid: () => <div />,
        Tooltip: () => <div />,
        Legend: () => <div />,
        PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Pie: () => <div />,
        Cell: () => <div />,
    };
});


describe('RetentionDashboard', () => {
    const mockStats = {
        totalPolicies: 5,
        activePolicies: 3,
        documentsWithPolicy: 100,
        documentsExpiringSoon: 10,
        documentsExpired: 2,
        documentsUnderLegalHold: 5,
    };

    const mockPolicies = [
        {
            id: 'policy-1',
            name: 'Test Policy 1',
            retentionDays: 365,
            action: 'notify',
            isActive: true,
            priority: 1,
        },
        {
            id: 'policy-2',
            name: 'Test Policy 2',
            retentionDays: 730,
            action: 'archive',
            isActive: false,
            priority: 0,
        },
    ];

    const mockDistribution = {
        under30Days: 10,
        under90Days: 20,
        under1Year: 30,
        under3Years: 40,
        over3Years: 50,
        total: 150
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (getRetentionStats as any).mockResolvedValue(mockStats);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (getPolicies as any).mockResolvedValue(mockPolicies);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (getDocumentsNearExpiry as any).mockResolvedValue([]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (getExpiredDocuments as any).mockResolvedValue([]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (getDocumentAgeDistribution as any).mockResolvedValue(mockDistribution);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should render dashboard with stats', async () => {
        render(<RetentionDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/Politiques de Retention/i)).toBeInTheDocument();
            expect(screen.getByText(/Politiques Actives/i)).toBeInTheDocument();
            expect(screen.getByText(/Expirent Bientot/i)).toBeInTheDocument();
            expect(screen.getByText(/Sous Legal Hold/i)).toBeInTheDocument();
        });
    });

    it('should list policies', async () => {
        render(<RetentionDashboard />);

        // Switch to policies tab
        const policiesTab = screen.getByRole('tab', { name: /^Politiques$/i });
        fireEvent.click(policiesTab);

        await waitFor(() => {
            expect(screen.getByText(/Test Policy 1/i)).toBeInTheDocument();
            expect(screen.getByText(/Test Policy 2/i)).toBeInTheDocument();
        });
    });

    it('should open create policy dialog', async () => {
        render(<RetentionDashboard />);

        const createButton = screen.getByRole('button', { name: /Nouvelle politique/i });
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText(/Nom \*/i)).toBeInTheDocument(); // Label in the dialog
            expect(screen.getByText(/Action a l'expiration/i)).toBeInTheDocument();
        });
    });

    // Add more tests for interactions as needed
});
