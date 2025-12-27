import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Audits } from '../Audits';
import { MemoryRouter } from 'react-router-dom';

// Mock Dependencies
vi.mock('../../hooks/audits/useAudits');
vi.mock('../../store');
vi.mock('../../hooks/usePersistedState');
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>
    }
}));

// Mock Components to isolate View logic
vi.mock('../../components/audits/AuditDashboard', () => ({
    AuditDashboard: () => <div data-testid="audit-dashboard">Dashboard</div>
}));
vi.mock('../../components/audits/AuditsList', () => ({
    AuditsList: ({ audits }: { audits: Array<unknown> }) => <div data-testid="audits-list">{audits.length} Audits</div>
}));
vi.mock('../../components/audits/AuditCalendar', () => ({
    AuditCalendar: () => <div data-testid="audit-calendar" />
}));
vi.mock('../../components/audits/FindingsList', () => ({
    FindingsList: () => <div data-testid="findings-list" />
}));
vi.mock('../../components/SEO', () => ({
    SEO: () => <div data-testid="seo-mock" />
}));
vi.mock('../../components/audits/AuditForm', () => ({
    AuditForm: () => <div data-testid="audit-form" />
}));
vi.mock('../../components/audits/AuditInspector', () => ({
    AuditInspector: () => <div data-testid="audit-inspector" />
}));
vi.mock('../../components/ui/Drawer', () => ({
    Drawer: ({ isOpen, children }: { isOpen: boolean, children: React.ReactNode }) => isOpen ? <div data-testid="drawer">{children}</div> : null
}));

// Import mocked hooks to set return values
import { useAudits } from '../../hooks/audits/useAudits';
import { useStore } from '../../store';
import { usePersistedState } from '../../hooks/usePersistedState';

describe('Audits View', () => {
    const mockAudits = [
        { id: '1', name: 'Audit 27001', status: 'Planifié', type: 'Certification' },
        { id: '2', name: 'Audit Interne', status: 'En cours', type: 'Interne' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useStore).mockReturnValue({
            user: { role: 'admin', organizationId: 'org-1' },
            t: (key: string) => key,
            addToast: vi.fn(),
        });

        vi.mocked(useAudits).mockReturnValue({
            audits: mockAudits,
            loading: false,
            canEdit: true,
            canDelete: true,
            refreshAudits: vi.fn(),
            handleDeleteAudit: vi.fn(),
            checkDependencies: vi.fn().mockResolvedValue({ hasDependencies: false }),
        } as unknown as ReturnType<typeof useAudits>);

        vi.mocked(usePersistedState).mockImplementation((_key: string, defaultVal: unknown) => React.useState(defaultVal));
    });

    it('renders the dashboard by default', () => {
        render(
            <MemoryRouter>
                <Audits />
            </MemoryRouter>
        );

        expect(screen.getByTestId('audit-dashboard')).toBeInTheDocument();
        expect(screen.getByText('audits.title_admin')).toBeInTheDocument();
    });

    it('renders the list view when tab is switched', async () => {
        render(
            <MemoryRouter>
                <Audits />
            </MemoryRouter>
        );

        // Click on "List" tab (mocked scrollable tabs would be better, but we rely on text matching for buttons usually)
        // Since ScrollableTabs is NOT mocked, we interact with real buttons if possible, 
        // OR we can rely on CustomSelect output if tabs are dropdowns on mobile? 
        // Actually ScrollableTabs renders buttons.

        const listTab = screen.getByText('audits.list');
        fireEvent.click(listTab);

        expect(screen.getByTestId('audits-list')).toBeInTheDocument();
        expect(screen.getByText('2 Audits')).toBeInTheDocument();
    });

    it('opens creation drawer when "New Audit" is clicked', () => {
        render(
            <MemoryRouter>
                <Audits />
            </MemoryRouter>
        );

        const newBtn = screen.getByText('audits.newAudit');
        fireEvent.click(newBtn);

        expect(screen.getByTestId('drawer')).toBeInTheDocument();
        expect(screen.getByTestId('audit-form')).toBeInTheDocument();
    });

    it('filters audits correctly', async () => {
        render(
            <MemoryRouter>
                <Audits />
            </MemoryRouter>
        );

        // Verify default count
        const listTab = screen.getByText('audits.list');
        fireEvent.click(listTab);

        // We need to type into the search bar. 
        // PremiumPageControl renders an input with placeholder "audits.searchPlaceholder" (mocked t)
        const searchInput = screen.getByPlaceholderText('audits.searchPlaceholder');
        fireEvent.change(searchInput, { target: { value: '27001' } });

        // The AuditsList calls {audits.length} Audits. 
        // filteredAudits should be 1.
        expect(screen.getByText('1 Audits')).toBeInTheDocument();
    });
});
