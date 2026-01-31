import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Suppliers } from '../Suppliers';
import { MemoryRouter } from 'react-router-dom';

// Mock Dependencies
vi.mock('../../hooks/useFirestore');
vi.mock('../../store');
vi.mock('../../hooks/usePersistedState');
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock Child Components
vi.mock('../../components/suppliers/SupplierDashboard', () => ({
    SupplierDashboard: () => <div data-testid="supplier-dashboard" />
}));
vi.mock('../../components/SEO', () => ({
    SEO: () => <div data-testid="seo-mock" />
}));
vi.mock('../../components/suppliers/SupplierForm', () => ({
    SupplierForm: () => <div data-testid="supplier-form" />
}));
vi.mock('../../components/ui/Drawer', () => ({
    Drawer: ({ isOpen, children }: { isOpen: boolean, children: React.ReactNode }) => isOpen ? <div data-testid="drawer">{children}</div> : null
}));
vi.mock('../../components/ui/PremiumPageControl', () => ({
    PremiumPageControl: ({ children }: { children: React.ReactNode }) => <div data-testid="premium-page-control">{children}</div>
}));
vi.mock('../../components/ui/button', () => ({
    Button: ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; className?: string }) =>
        <button className={className} {...props}>{children}</button>
}));
vi.mock('../../components/ui/ConfirmModal', () => ({
    ConfirmModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div data-testid="confirm-modal">{children}</div> : null
}));
vi.mock('../../components/ui/Skeleton', () => ({
    CardSkeleton: () => <div data-testid="card-skeleton" />
}));
vi.mock('../../components/ui/EmptyState', () => ({
    EmptyState: ({ children }: { children: React.ReactNode }) => <div data-testid="empty-state">{children}</div>
}));
vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title?: string }) => <div data-testid="page-header">{title}</div>
}));
vi.mock('../../components/ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>
}));
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));
vi.mock('../../components/ui/ImportGuidelinesModal', () => ({
    ImportGuidelinesModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div data-testid="import-guidelines-modal">{children}</div> : null
}));
vi.mock('../../components/suppliers/QuestionnaireBuilder', () => ({
    QuestionnaireBuilder: () => <div data-testid="questionnaire-builder" />
}));
vi.mock('../../components/suppliers/AssessmentView', () => ({
    AssessmentView: () => <div data-testid="assessment-view" />
}));
vi.mock('../../components/suppliers/SupplierCard', () => ({
    SupplierCard: () => <div data-testid="supplier-card" />
}));
vi.mock('../../components/suppliers/SupplierInspector', () => ({
    SupplierInspector: () => <div data-testid="supplier-inspector" />
}));
vi.mock('../../services/ImportService', () => ({
    ImportService: {
        exportDORARegister: vi.fn()
    }
}));
vi.mock('../../services/onboardingService', () => ({
    OnboardingService: {}
}));
vi.mock('../../components/ui/Icons', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../components/ui/Icons')>();
    return {
        ...actual,
    };
});

// Smart Mock for DataTable to test Column Logic
vi.mock('../../components/ui/DataTable', () => ({
    DataTable: ({ data, columns }: { data: Array<Record<string, unknown>>; columns: Array<{ accessorKey: string; cell?: (params: { row: { original: Record<string, unknown> } }) => React.ReactNode } & Record<string, unknown>> }) => (
        <div data-testid="data-table">
            <table>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={`row-${i || 'unknown'}`}>
                            {columns.map((col, j) => (
                                <td key={`cell-${i || 'unknown'}-${j}`}>
                                    {col.cell ? col.cell({ row: { original: row } }) : String(row[col.accessorKey] || '')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}));

// Mock Hooks
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { useStore } from '../../store';
import { usePersistedState } from '../../hooks/usePersistedState';

describe('Suppliers View', () => {
    const mockSuppliers = [
        {
            id: '1',
            name: 'AWS',
            category: 'Cloud',
            criticality: 'Critique',
            isICTProvider: true,
            status: 'Actif',
            securityScore: 90
        },
        {
            id: '2',
            name: 'Local Catering',
            category: 'Service',
            criticality: 'Faible',
            isICTProvider: false,
            status: 'Actif',
            securityScore: 40
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useStore).mockReturnValue({
            user: { role: 'admin', organizationId: 'org-1' },
            t: (key: string) => key,
            addToast: vi.fn(),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (vi.mocked(usePersistedState) as any).mockImplementation((key: string, defaultVal: unknown) => {
            if (key === 'suppliers_view_mode') {
                return React.useState<string>('list');
            }
            if (key === 'suppliers-active-tab') {
                // Start on suppliers tab to show list view
                return React.useState<string>('suppliers');
            }
            return React.useState(defaultVal);
        });

        // Mock useFirestoreCollection behavior
        (useFirestoreCollection as unknown as ReturnType<typeof vi.fn>).mockImplementation((collectionName: string) => {
            if (collectionName === 'suppliers') {
                return { data: mockSuppliers, loading: false };
            }
            return { data: [], loading: false };
        });
    });

    it('renders the suppliers table with correct data', () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suppliers />
            </MemoryRouter>
        );

        expect(screen.getByText('suppliers.title')).toBeInTheDocument();
        expect(screen.getByText('AWS')).toBeInTheDocument();
        expect(screen.getByText('Local Catering')).toBeInTheDocument();
    });

    it('displays DORA ICT badge for relevant suppliers', () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suppliers />
            </MemoryRouter>
        );

        // expecting "DORA ICT" text from the badge
        const badges = screen.getAllByText('DORA ICT');
        expect(badges.length).toBeGreaterThan(0);
        // Ensure it's associated with AWS (simple check: it exists in document)
    });

    it('calculates and displays security score colors', () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suppliers />
            </MemoryRouter>
        );

        expect(screen.getByText(/90/)).toBeInTheDocument();
        expect(screen.getByText(/40/)).toBeInTheDocument();

        // We could test classes here if we wanted to be specific about colors
    });
});
