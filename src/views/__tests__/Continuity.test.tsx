
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Continuity from '../Continuity';
import { MemoryRouter } from 'react-router-dom';

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
    const React = await vi.importActual<any>('react');
    return {
        usePersistedState: (key: any, defaultVal: any) => React.useState(defaultVal)
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
    PageHeader: ({ title }: any) => <h1>{title}</h1>
}));
vi.mock('../../components/ui/ScrollableTabs', () => ({
    ScrollableTabs: ({ tabs, onTabChange }: any) => (
        <div>
            {tabs.map((t: any) => (
                <button key={t.id} onClick={() => onTabChange(t.id)}>{t.label}</button>
            ))}
        </div>
    )
}));
vi.mock('../../components/ui/PremiumPageControl', () => ({
    PremiumPageControl: ({ onSearchChange, actions }: any) => (
        <div>
            <input data-testid="search-input" onChange={(e) => onSearchChange(e.target.value)} />
            {actions}
        </div>
    )
}));

// Mock Sub-components
vi.mock('../../components/continuity/ContinuityDashboard', () => ({
    ContinuityDashboard: () => <div data-testid="continuity-dashboard" />
}));
vi.mock('../../components/continuity/ContinuityBIA', () => ({
    ContinuityBIA: ({ processes }: any) => (
        <div data-testid="continuity-bia">
            {processes.map((p: any) => <div key={p.id}>{p.name}</div>)}
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
    ProcessFormModal: ({ isOpen }: any) => isOpen ? <div data-testid="process-form-modal" /> : null
}));
vi.mock('../../components/continuity/DrillModal', () => ({
    DrillModal: ({ isOpen }: any) => isOpen ? <div data-testid="drill-modal" /> : null
}));
vi.mock('../../components/continuity/ProcessInspector', () => ({
    ProcessInspector: ({ isOpen }: any) => isOpen ? <div data-testid="process-inspector" /> : null
}));
vi.mock('../../utils/pdfGenerator', () => ({
    generateContinuityReport: vi.fn()
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
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
