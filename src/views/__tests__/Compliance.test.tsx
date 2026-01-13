import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import React from 'react';
import { Compliance } from '../Compliance';

// Mock React Router
vi.mock('react-router-dom', () => ({
    useLocation: () => ({
        pathname: '/compliance',
        search: '',
        hash: '',
        state: null,
        key: 'default'
    }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    BrowserRouter: ({ children }: { children: React.ReactNode }) => children
}));

// Mock store
vi.mock('../../store', () => {
    const mockGetState = vi.fn(() => ({
        customRoles: [],
        user: { organizationId: 'test-org', role: 'rssi', uid: 'test-user' },
        language: 'fr',
        addToast: vi.fn(),
        t: (key: string): string => {
            const translations: Record<string, string> = {
                'compliance.title': 'Conformité',
                'compliance.subtitle': 'Gérez votre conformité',
                'compliance.overview': 'Vue d\'ensemble',
                'compliance.controls': 'Contrôles',
                'compliance.soa': 'SoA',
                'compliance.newRisk': 'Nouveau Risque',
                'frameworks.ISO27001': 'ISO 27001 (Sécurité SI)',
                'frameworks.ISO22301': 'ISO 22301 (Continuité)',
                'frameworks.NIS2': 'NIS 2 (Cyber UE)'
            };
            return translations[key] || key;
        }
    }));

    const useStore = vi.fn((selector) => {
        const state = mockGetState();
        return selector ? selector(state) : state;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useStore as any).getState = mockGetState;

    return { useStore };
});

// Mock hooks
vi.mock('../../hooks/useComplianceData', () => ({
    useComplianceData: () => ({
        filteredControls: [],
        risks: [],
        findings: [],
        documents: [],
        usersList: [],
        assets: [],
        suppliers: [],
        projects: [],
        loading: false,
    }),
}));

vi.mock('../../hooks/useComplianceDataSeeder', () => ({
    useComplianceDataSeeder: () => ({
        seedControls: vi.fn(),
    }),
}));

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
    collection: vi.fn(() => ({ type: 'collection' })),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    doc: vi.fn(() => ({ id: 'test-id' })),
    updateDoc: vi.fn(),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        commit: vi.fn()
    })),
    arrayUnion: vi.fn(),
    query: vi.fn(() => ({ type: 'query' })),
    where: vi.fn(() => ({ type: 'constraint' })),
    limit: vi.fn(() => ({ type: 'constraint' })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'test-doc-id' })),
    memoryLocalCache: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn())
}));

// Mock composants
vi.mock('../../components/compliance/ComplianceInspector', () => ({
    ComplianceInspector: vi.fn(() => <div data-testid="compliance-inspector">Inspector</div>),
}));

vi.mock('../../components/compliance/ComplianceDashboard', () => ({
    ComplianceDashboard: vi.fn(() => <div data-testid="compliance-dashboard">Dashboard</div>),
}));

vi.mock('../../components/compliance/ComplianceList', () => ({
    ComplianceList: vi.fn(() => <div data-testid="compliance-list">List</div>),
}));

vi.mock('../../components/compliance/SoAView', () => ({
    SoAView: vi.fn(() => <div data-testid="soa-view">SoA</div>),
}));

describe('Compliance View', () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    const renderWithProviders = (component: React.ReactElement) => {
        return render(
            <HelmetProvider>
                <QueryClientProvider client={queryClient}>
                    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                        {component}
                    </BrowserRouter>
                </QueryClientProvider>
            </HelmetProvider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient.clear();
    });

    it('renders without crashing', () => {
        act(() => {
            renderWithProviders(<Compliance />);
        });
        expect(screen.getByText('Conformité')).toBeInTheDocument();
    });

    it('displays framework selector', () => {
        act(() => {
            renderWithProviders(<Compliance />);
        });
        expect(screen.getByText('ISO 27001 (Sécurité SI)')).toBeInTheDocument();
        expect(screen.getByText('ISO 22301 (Continuité)')).toBeInTheDocument();
        expect(screen.getByText('NIS 2 (Cyber UE)')).toBeInTheDocument();
    });

    it('displays navigation tabs', () => {
        act(() => {
            renderWithProviders(<Compliance />);
        });
        expect(screen.getByText('Vue d\'ensemble')).toBeInTheDocument();
        expect(screen.getByText('Contrôles')).toBeInTheDocument();
        expect(screen.getByText('SoA')).toBeInTheDocument();
    });

    it('displays dashboard when no controls', () => {
        act(() => {
            renderWithProviders(<Compliance />);
        });
        expect(screen.getByTestId('compliance-dashboard')).toBeInTheDocument();
    });
});
