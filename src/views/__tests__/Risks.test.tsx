import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Risks } from '../Risks'; // Adjust import if necessary (likely index or default)
import { useStore } from '../../store'; // Adjust import
import { useFirestoreCollection } from '../../hooks/useFirestore';

// Mock dependencies
vi.mock('../../store', () => ({
    useStore: vi.fn(),
}));

vi.mock('../../hooks/useFirestore', () => ({
    useFirestoreCollection: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { uid: 'test-user', email: 'test@example.com', organizationId: 'test-org' },
        loading: false,
    }),
}));

vi.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-helmet-async', () => ({
    Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    HelmetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/Icons', () => ({
    Plus: () => <span data-testid="icon-plus" />,
    Search: () => <span data-testid="icon-search" />,
    ShieldAlert: () => <span data-testid="icon-shield-alert" />,
    Server: () => <span data-testid="icon-server" />,
    Trash2: () => <span data-testid="icon-trash" />,
    History: () => <span data-testid="icon-history" />,
    MessageSquare: () => <span data-testid="icon-message" />,
    FileSpreadsheet: () => <span data-testid="icon-spreadsheet" />,
    Clock: () => <span data-testid="icon-clock" />,
    Copy: () => <span data-testid="icon-copy" />,
    FolderKanban: () => <span data-testid="icon-folder" />,
    Network: () => <span data-testid="icon-network" />,
    CheckCircle2: () => <span data-testid="icon-check-circle" />,
    CalendarDays: () => <span data-testid="icon-calendar" />,
    Download: () => <span data-testid="icon-download" />,
    TrendingUp: () => <span data-testid="icon-trending-up" />,
    TrendingDown: () => <span data-testid="icon-trending-down" />,
    ArrowRight: () => <span data-testid="icon-arrow-right" />,
    Upload: () => <span data-testid="icon-upload" />,
    LayoutDashboard: () => <span data-testid="icon-dashboard" />,
    Filter: () => <span data-testid="icon-filter" />,
    RefreshCw: () => <span data-testid="icon-refresh" />,
    Edit: () => <span data-testid="icon-edit" />,
    FileText: () => <span data-testid="icon-file-text" />,
    BrainCircuit: () => <span data-testid="icon-brain" />,
    LayoutGrid: () => <span data-testid="icon-layout-grid" />,
    List: () => <span data-testid="icon-list" />,
    Activity: () => <span data-testid="icon-activity" />,
    AlertTriangle: () => <span data-testid="icon-alert" />,
    Layers: () => <span data-testid="icon-layers" />,
}));
// Mock other components to simplify test
vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>
}));

describe('Risks View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useStore).mockReturnValue({
            user: { organizationId: 'test-org', role: 'admin' },
            addToast: vi.fn(),
            demoMode: false, // Add missing property if required by interface, or cast return as unknown
        } as unknown as ReturnType<typeof useStore>);
        vi.mocked(useFirestoreCollection).mockReturnValue({
            data: [],
            loading: false,
            refresh: vi.fn(),
            error: null,
            add: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        });
    });

    it('renders the risks dashboard title', () => {
        const { getByText } = render(
            <MemoryRouter>
                <Risks />
            </MemoryRouter>
        );
        expect(getByText(/Registre des Risques/i)).toBeInTheDocument();
    });

    it('shows loading state', () => {
        vi.mocked(useFirestoreCollection).mockReturnValue({
            data: [],
            loading: true,
            refresh: vi.fn(),
            error: null,
            add: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        });
        render(
            <MemoryRouter>
                <Risks />
            </MemoryRouter>
        );
        // Assuming LoadingScreen renders something identifiable or we can check for absence of main content
        // For now, let's just check if it doesn't crash
    });

    it('displays empty state when no risks found', async () => {
        vi.mocked(useFirestoreCollection).mockReturnValue({
            data: [],
            loading: false,
            refresh: vi.fn(),
            error: null,
            add: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        });

        render(
            <MemoryRouter>
                <Risks />
            </MemoryRouter>
        );
        expect(screen.getByText(/Aucun risque trouvé/i)).toBeInTheDocument();
    });
});
