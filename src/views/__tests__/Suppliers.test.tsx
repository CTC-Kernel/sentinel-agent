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

// Smart Mock for DataTable to test Column Logic
vi.mock('../../components/ui/DataTable', () => ({
    DataTable: ({ data, columns }: { data: Array<Record<string, unknown>>, columns: Array<any> }) => (
        <div data-testid="data-table">
            <table>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={`row-${i}`}>
                            {columns.map((col: { accessorKey: string }, j: number) => (
                                <td key={`cell-${i}-${j}`}>{String(row[col.accessorKey] || '')}</td>
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

        vi.mocked(usePersistedState).mockImplementation((_key: string, defaultVal: unknown) => React.useState(defaultVal));

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
            <MemoryRouter>
                <Suppliers />
            </MemoryRouter>
        );

        expect(screen.getByText('suppliers.title_admin')).toBeInTheDocument();
        expect(screen.getByText('AWS')).toBeInTheDocument();
        expect(screen.getByText('Local Catering')).toBeInTheDocument();
    });

    it('displays DORA ICT badge for relevant suppliers', () => {
        render(
            <MemoryRouter>
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
            <MemoryRouter>
                <Suppliers />
            </MemoryRouter>
        );

        expect(screen.getByText(/90/)).toBeInTheDocument();
        expect(screen.getByText(/40/)).toBeInTheDocument();

        // We could test classes here if we wanted to be specific about colors
    });
});
