
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Reports } from '../Reports';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        user: { uid: 'test-user', organizationId: 'test-org', role: 'admin' },
        organization: { ownerId: 'test-user', logoUrl: 'logo.png' },
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

vi.mock('../../hooks/usePlanLimits', () => ({
    usePlanLimits: vi.fn().mockReturnValue({
        hasFeature: vi.fn().mockReturnValue(true) // Enable all features
    })
}));

// Mock Firestore
vi.mock('../../hooks/useFirestore', () => ({
    useFirestoreCollection: vi.fn((collectionName) => {
        if (collectionName === 'risks') return { data: [{ id: 'r1', threat: 'Risk 1' }], loading: false };
        if (collectionName === 'audits') return { data: [{ id: 'a1', name: 'Audit 1', scope: 'ISO 27001' }], loading: false };
        if (collectionName === 'assets') return { data: [], loading: false };
        if (collectionName === 'controls') return { data: [], loading: false };
        if (collectionName === 'documents') return { data: [{ id: 'd1', title: 'Report 1', type: 'Rapport', version: '1.0' }], loading: false, refresh: vi.fn() };
        return { data: [], loading: false };
    })
}));

vi.mock('firebase/firestore', () => ({
    where: vi.fn(),
    deleteDoc: vi.fn(),
    doc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    collection: vi.fn(),
    addDoc: vi.fn()
}));

vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    getDownloadURL: vi.fn()
}));

vi.mock('../../firebase', () => ({
    db: {},
    storage: {}
}));

// Mock Services
vi.mock('../../services/PdfService', () => ({
    PdfService: {
        generateRiskExecutiveReport: vi.fn().mockReturnValue({ output: () => new Blob(['pdf'], { type: 'application/pdf' }) }),
        generateAuditExecutiveReport: vi.fn().mockReturnValue({ output: () => new Blob(['pdf'], { type: 'application/pdf' }) }),
        generateTableReport: vi.fn().mockReturnValue({ output: () => new Blob(['pdf'], { type: 'application/pdf' }) }),
        generateComplianceExecutiveReport: vi.fn().mockReturnValue({ output: () => new Blob(['pdf'], { type: 'application/pdf' }) })
    }
}));

vi.mock('../../services/CompliancePackService', () => ({
    CompliancePackService: {
        generatePack: vi.fn()
    }
}));

vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        handleErrorWithToast: vi.fn()
    }
}));

vi.mock('../../utils/permissions', () => ({
    hasPermission: vi.fn().mockReturnValue(true),
    canDeleteResource: vi.fn().mockReturnValue(true)
}));

// Mock Components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => null
}));
vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>
}));
vi.mock('../../components/ui/ScrollableTabs', () => ({
    ScrollableTabs: ({ tabs, onTabChange }: { tabs: Array<{ id: string; label: string }>, onTabChange: (id: string) => void }) => (
        <div>
            {tabs.map((t: { id: string; label: string }) => (
                <button key={t.id} onClick={() => onTabChange(t.id)}>{t.label}</button>
            ))}
        </div>
    )
}));
vi.mock('../../components/ui/LoadingScreen', () => ({
    LoadingScreen: () => <div data-testid="loading-screen" />
}));
vi.mock('../../components/reports/ReportTemplates', () => ({
    ReportTemplates: () => <div data-testid="report-templates" />
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>,
        section: ({ children, className, ...props }: React.ComponentProps<'section'>) => <section className={className} {...props}>{children}</section>,
        tr: ({ children, className, ...props }: React.ComponentProps<'tr'>) => <tr className={className} {...props}>{children}</tr>
    }
}));

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe('Reports View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders generation tab by default', () => {
        render(
            <MemoryRouter>
                <Reports />
            </MemoryRouter>
        );

        expect(screen.getByText('reports.title')).toBeInTheDocument();
        expect(screen.getByText('reports.risksTitle')).toBeInTheDocument();
        expect(screen.getByText('reports.auditsTitle')).toBeInTheDocument();
    });

    it('renders history tab', () => {
        render(
            <MemoryRouter>
                <Reports />
            </MemoryRouter>
        );

        const historyTab = screen.getByText('reports.history');
        fireEvent.click(historyTab);

        expect(screen.getByText('Report 1')).toBeInTheDocument();
    });
});
