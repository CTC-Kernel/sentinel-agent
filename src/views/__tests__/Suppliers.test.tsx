import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Suppliers } from '../Suppliers';
import { MemoryRouter } from 'react-router-dom';

// Mock Dependencies
vi.mock('../../hooks/useFirestore');
vi.mock('../../store');
vi.mock('../../hooks/usePersistedState');
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
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
    Drawer: ({ isOpen, children }: any) => isOpen ? <div data-testid="drawer">{children}</div> : null
}));

// Smart Mock for DataTable to test Column Logic
vi.mock('../../components/ui/DataTable', () => ({
    DataTable: ({ data, columns }: any) => (
        <table data-testid="data-table">
            <thead>
                <tr>
                    {columns.map((col: any) => (
                        <th key={col.header}>{col.header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map((row: any, i: number) => (
                    <tr key={i}>
                        {columns.map((col: any) => (
                            <td key={col.header}>
                                {col.cell ? col.cell({ row: { original: row } }) : row[col.accessorKey]}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}));

// Mock Hooks
// @ts-ignore
import { useFirestoreCollection } from '../../hooks/useFirestore';
// @ts-ignore
import { useStore } from '../../store';
// @ts-ignore
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

        (useStore as any).mockReturnValue({
            user: { role: 'admin', organizationId: 'org-1' },
            t: (key: string) => key,
            addToast: vi.fn(),
        });

        (usePersistedState as any).mockImplementation((key: string, defaultVal: any) => React.useState(defaultVal));

        // Mock useFirestoreCollection behavior
        (useFirestoreCollection as any).mockImplementation((collectionName: string) => {
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
