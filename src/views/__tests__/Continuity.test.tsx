
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Continuity } from '../Continuity';
import { MemoryRouter } from 'react-router-dom';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
    __esModule: true,
    ...vi.importActual('firebase/firestore'),
    collection: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    onSnapshot: vi.fn((_query, onNext) => {
        onNext({
            docs: [],
            empty: true,
            forEach: (callback: () => void) => { callback(); }
        });
        return () => ({}); // Return unsubscribe function
    }),
    doc: vi.fn().mockReturnThis(),
    getDoc: vi.fn().mockResolvedValue({
        exists: () => false,
        data: () => ({}),
        id: 'test-doc',
    }),
    getDocs: vi.fn().mockResolvedValue({
        docs: [],
        empty: true,
        forEach: (callback: () => void) => { callback(); }
    }),
    setDoc: vi.fn().mockResolvedValue(undefined),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    addDoc: vi.fn().mockResolvedValue({ id: 'new-doc' }),
    serverTimestamp: vi.fn(() => new Date().toISOString()),
}));

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        user: { uid: 'test-user', organizationId: 'test-org', role: 'admin' },
        addToast: vi.fn(),
        t: (k: string) => k
    }),
}));


vi.mock('../../hooks/usePersistedState', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        usePersistedState: (_key: string, defaultVal: unknown) => React.useState(defaultVal)
    };
});

// Mock useFirestoreCollection
const mockProcesses = [
    { id: 'p1', name: 'Process A', rto: '4h', rpo: '1h', status: 'Active' },
    { id: 'p2', name: 'Process B', rto: '24h', rpo: '4h', status: 'Draft' }
];

vi.mock('../../hooks/useFirestore', () => ({
    useFirestoreCollection: vi.fn((collectionName) => {
        if (collectionName === 'business_processes') return { data: mockProcesses, loading: false, refresh: vi.fn() };
        if (collectionName === 'bcp_drills') return { data: [], loading: false, refresh: vi.fn() };
        return { data: [], loading: false, refresh: vi.fn() };
    })
}));

// Mock Firebase functions
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    deleteDoc: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    collection: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn()
}));

vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock Child Components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => null
}));
vi.mock('../../components/SEO', () => ({
    SEO: () => null
}));
vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>
}));
vi.mock('../../components/ui/ScrollableTabs', () => ({
    ScrollableTabs: ({ tabs, onTabChange }: { tabs: Array<{ id: string; label: string }>, onTabChange: (id: string) => void }) => (
        <div>
            {tabs.map((t: { id: string; label: string }) => (
                <button aria-label={t.label} key={t.id} onClick={() => onTabChange(t.id)}>{t.label}</button>
            ))}
        </div>
    )
}));
vi.mock('../../components/ui/PremiumPageControl', () => ({
    PremiumPageControl: ({ onSearchChange, actions }: { onSearchChange: (val: string) => void, actions?: React.ReactNode }) => (
        <div>
            <input aria-label="Search" data-testid="search-input" onChange={(e) => onSearchChange(e.target.value)} />
            {actions}
        </div>
    )
}));

// Mock Sub-components
vi.mock('../../components/continuity/ContinuityDashboard', () => ({
    ContinuityDashboard: () => <div data-testid="continuity-dashboard" />
}));
vi.mock('../../components/continuity/ContinuityBIA', () => ({
    ContinuityBIA: ({ processes }: { processes: Array<{ id: string; name: string }> }) => (
        <div data-testid="continuity-bia">
            {processes.map((p: { id: string; name: string }) => <div key={p.id}>{p.name}</div>)}
        </div>
    )
}));
vi.mock('../../components/continuity/ContinuityDrills', () => ({
    ContinuityDrills: () => <div data-testid="continuity-drills" />
}));
vi.mock('../../components/continuity/ContinuityStrategies', () => ({
    ContinuityStrategies: () => <div data-testid="continuity-strategies" />
}));
vi.mock('../../components/continuity/ContinuityCrisis', () => ({
    ContinuityCrisis: () => <div data-testid="continuity-crisis" />
}));
vi.mock('../../components/continuity/ProcessFormModal', () => ({
    ProcessFormModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="process-form-modal" /> : null
}));
vi.mock('../../components/continuity/DrillModal', () => ({
    DrillModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="drill-modal" /> : null
}));
vi.mock('../../components/continuity/ProcessInspector', () => ({
    ProcessInspector: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="process-inspector" /> : null
}));
vi.mock('../../utils/pdfGenerator', () => ({
    generateContinuityReport: vi.fn()
}));

// Mock useContinuityData
vi.mock('../../hooks/continuity/useContinuityData', () => ({
    useContinuityData: () => ({
        processes: [
            { id: 'p1', name: 'Process A', rto: '4h', rpo: '1h', status: 'Active' },
            { id: 'p2', name: 'Process B', rto: '24h', rpo: '4h', status: 'Draft' }
        ],
        drills: [],
        assets: [],
        risks: [],
        suppliers: [],
        users: [],
        incidents: [],
        loading: false
    })
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe('Continuity View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the continuity dashboard by default', () => {
        render(
            <MemoryRouter>
                <Continuity />
            </MemoryRouter>
        );

        expect(screen.getByText('continuity.title')).toBeInTheDocument();
        expect(screen.getByTestId('continuity-dashboard')).toBeInTheDocument();
    });

    it('switches to BIA tab and renders processes', () => {
        render(
            <MemoryRouter>
                <Continuity />
            </MemoryRouter>
        );

        const biaTab = screen.getByText('continuity.tabs.bia');
        fireEvent.click(biaTab);

        expect(screen.getByTestId('continuity-bia')).toBeInTheDocument();
    });
});
