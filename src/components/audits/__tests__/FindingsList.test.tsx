/**
 * Unit tests for FindingsList component
 * Tests findings list display and filtering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FindingsList } from '../FindingsList';
import { Audit, Finding } from '../../../types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        tr: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <tr {...props}>{children}</tr>
    }
}));

// Mock PremiumPageControl
vi.mock('../../ui/PremiumPageControl', () => ({
    PremiumPageControl: ({ searchQuery, onSearchChange, actions }: {
        searchQuery: string;
        onSearchChange: (value: string) => void;
        searchPlaceholder: string;
        actions: React.ReactNode;
    }) => (
        <div data-testid="premium-page-control">
            <input
                data-testid="search-input"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Rechercher..."
            />
            {actions}
        </div>
    )
}));

// Mock EmptyState
vi.mock('../../ui/EmptyState', () => ({
    EmptyState: ({ title, description }: { title: string; description: string }) => (
        <div data-testid="empty-state">
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    )
}));

// Mock Skeleton
vi.mock('../../ui/Skeleton', () => ({
    Skeleton: ({ className }: { className: string }) => (
        <div data-testid="skeleton" className={className} />
    )
}));

describe('FindingsList', () => {
    const createFinding = (overrides: Partial<Finding> = {}): Finding => ({
        id: 'find-1',
        organizationId: 'org-1',
        auditId: 'audit-1',
        description: 'Test finding description',
        type: 'Majeure',
        severity: 'Moyenne',
        status: 'Ouvert',
        createdAt: new Date().toISOString(),
        ...overrides
    });

    const createAudit = (overrides: Partial<Audit> = {}): Audit => ({
        id: 'audit-1',
        name: 'Test Audit',
        type: 'Interne',
        auditor: 'Bob Auditor',
        status: 'En cours',
        organizationId: 'org-1',
        dateScheduled: new Date().toISOString(),
        findings: [createFinding()],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        findingsCount: 1,
        ...overrides
    });

    const mockAudits: Audit[] = [
        createAudit({
            id: 'audit-1',
            name: 'Security Audit',
            findings: [
                createFinding({ id: 'f1', description: 'Critical vulnerability found', type: 'Majeure' }),
                createFinding({ id: 'f2', description: 'Minor config issue', type: 'Mineure' })
            ]
        }),
        createAudit({
            id: 'audit-2',
            name: 'Compliance Audit',
            findings: [
                createFinding({ id: 'f3', description: 'Observation about process', type: 'Observation' })
            ]
        })
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders empty state when no audits have findings', () => {
            render(<FindingsList audits={[createAudit({ findings: [] })]} />);

            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
            expect(screen.getByText('Aucun constat')).toBeInTheDocument();
        });

        it('renders findings table when findings exist', () => {
            render(<FindingsList audits={mockAudits} />);

            expect(screen.getByText('Critical vulnerability found')).toBeInTheDocument();
            expect(screen.getByText('Minor config issue')).toBeInTheDocument();
            expect(screen.getByText('Observation about process')).toBeInTheDocument();
        });

        it('renders table headers', () => {
            render(<FindingsList audits={mockAudits} />);

            expect(screen.getByText('Statut')).toBeInTheDocument();
            expect(screen.getByText('Description')).toBeInTheDocument();
            expect(screen.getByText('Type')).toBeInTheDocument();
            expect(screen.getByText('Audit Source')).toBeInTheDocument();
            expect(screen.getByText('Date')).toBeInTheDocument();
        });

        it('renders audit name for each finding', () => {
            render(<FindingsList audits={mockAudits} />);

            expect(screen.getAllByText('Security Audit')).toHaveLength(2);
            expect(screen.getByText('Compliance Audit')).toBeInTheDocument();
        });

        it('renders type badges', () => {
            render(<FindingsList audits={mockAudits} />);

            // Use getAllByText because "Majeure", "Mineure", etc appear both as filter buttons and as badges
            expect(screen.getAllByText('Majeure').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Mineure').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Observation').length).toBeGreaterThan(0);
        });
    });

    describe('filtering', () => {
        it('renders filter buttons', () => {
            render(<FindingsList audits={mockAudits} />);

            const filterButtons = screen.getAllByRole('button');
            const typeButtons = filterButtons.filter(b =>
                ['Majeure', 'Mineure', 'Observation', 'Opportunité'].includes(b.textContent || '')
            );
            expect(typeButtons).toHaveLength(4);
        });

        it('filters by type when button clicked', () => {
            render(<FindingsList audits={mockAudits} />);

            // Click Majeure filter
            fireEvent.click(screen.getByRole('button', { name: 'Majeure' }));

            // Should only show Majeure findings
            expect(screen.getByText('Critical vulnerability found')).toBeInTheDocument();
            expect(screen.queryByText('Minor config issue')).not.toBeInTheDocument();
            expect(screen.queryByText('Observation about process')).not.toBeInTheDocument();
        });

        it('clears filter when same button clicked again', () => {
            render(<FindingsList audits={mockAudits} />);

            // Click Majeure filter twice
            fireEvent.click(screen.getByRole('button', { name: 'Majeure' }));
            fireEvent.click(screen.getByRole('button', { name: 'Majeure' }));

            // Should show all findings again
            expect(screen.getByText('Critical vulnerability found')).toBeInTheDocument();
            expect(screen.getByText('Minor config issue')).toBeInTheDocument();
        });

        it('filters by search term', () => {
            render(<FindingsList audits={mockAudits} />);

            const searchInput = screen.getByTestId('search-input');
            fireEvent.change(searchInput, { target: { value: 'Critical' } });

            expect(screen.getByText('Critical vulnerability found')).toBeInTheDocument();
            expect(screen.queryByText('Minor config issue')).not.toBeInTheDocument();
        });

        it('shows no results message when filter matches nothing', () => {
            render(<FindingsList audits={mockAudits} />);

            const searchInput = screen.getByTestId('search-input');
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

            expect(screen.getByText('Aucun résultat trouvé pour cette recherche.')).toBeInTheDocument();
        });
    });

    describe('loading state', () => {
        it('renders skeletons when loading', () => {
            render(<FindingsList audits={mockAudits} loading />);

            expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
        });
    });

    describe('interactions', () => {
        it('calls onOpenAudit when audit name is clicked', () => {
            const onOpenAudit = vi.fn();
            render(<FindingsList audits={mockAudits} onOpenAudit={onOpenAudit} />);

            // Click on audit name
            fireEvent.click(screen.getAllByText('Security Audit')[0]);

            expect(onOpenAudit).toHaveBeenCalledWith(mockAudits[0]);
        });

        it('handles keyboard navigation for audit links', () => {
            const onOpenAudit = vi.fn();
            render(<FindingsList audits={mockAudits} onOpenAudit={onOpenAudit} />);

            const auditLink = screen.getAllByText('Security Audit')[0];
            fireEvent.keyDown(auditLink, { key: 'Enter' });

            expect(onOpenAudit).toHaveBeenCalled();
        });
    });

    describe('status display', () => {
        it('displays open status correctly', () => {
            render(<FindingsList audits={mockAudits} />);

            expect(screen.getAllByText('Ouvert').length).toBeGreaterThan(0);
        });

        it('displays closed status correctly', () => {
            const auditsWithClosed = [
                createAudit({
                    findings: [createFinding({ status: 'Fermé' })]
                })
            ];
            render(<FindingsList audits={auditsWithClosed} />);

            expect(screen.getByText('Fermé')).toBeInTheDocument();
        });
    });
});
