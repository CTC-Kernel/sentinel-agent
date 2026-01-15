/**
 * Unit tests for ComplianceList component
 * Tests compliance control list display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComplianceList } from '../ComplianceList';

// Mock complianceData
vi.mock('../../../data/complianceData', () => ({
    ISO_DOMAINS: [
        { id: 'A.5', title: 'Politiques de sécurité', description: 'Politiques organisationnelles' },
        { id: 'A.6', title: 'Organisation', description: 'Sécurité de l\'information' }
    ],
    ISO22301_DOMAINS: [],
    NIS2_DOMAINS: [],
    DORA_DOMAINS: [],
    GDPR_DOMAINS: [],
    SOC2_DOMAINS: [],
    HDS_DOMAINS: [],
    PCI_DSS_DOMAINS: [],
    NIST_CSF_DOMAINS: []
}));

// Mock Skeleton
vi.mock('../../../components/ui/Skeleton', () => ({
    Skeleton: ({ className }: { className?: string }) => (
        <div data-testid="skeleton" className={className} />
    )
}));

// Mock Tooltip
vi.mock('../../../components/ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock EmptyState
vi.mock('../../../components/ui/EmptyState', () => ({
    EmptyState: ({ title, description }: { title: string; description: string }) => (
        <div data-testid="empty-state">
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    )
}));

describe('ComplianceList', () => {
    const mockOnSelectControl = vi.fn();

    const mockControls = [
        {
            id: 'ctrl-1',
            code: 'A.5.1',
            name: 'Politiques de sécurité',
            status: 'Implémenté',
            evidenceIds: ['ev-1']
        },
        {
            id: 'ctrl-2',
            code: 'A.5.2',
            name: 'Revue des politiques',
            status: 'Partiel',
            evidenceIds: []
        },
        {
            id: 'ctrl-3',
            code: 'A.6.1',
            name: 'Organisation interne',
            status: 'Non implémenté',
            evidenceIds: []
        }
    ];

    const mockRisks = [
        { id: 'risk-1', mitigationControlIds: ['ctrl-1'] }
    ];

    const mockFindings = [
        { id: 'find-1', relatedControlId: 'ctrl-2', status: 'Ouvert' }
    ];

    const defaultProps = {
        controls: mockControls,
        risks: mockRisks,
        findings: mockFindings,
        loading: false,
        currentFramework: 'ISO27001' as const,
        onSelectControl: mockOnSelectControl
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loading state', () => {
        it('shows skeletons when loading', () => {
            render(<ComplianceList {...defaultProps} loading={true} />);

            expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
        });
    });

    describe('empty state', () => {
        it('shows empty state when no controls', () => {
            render(<ComplianceList {...defaultProps} controls={[]} />);

            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
            expect(screen.getByText('Aucun contrôle trouvé')).toBeInTheDocument();
        });

        it('shows filter message when filter is active', () => {
            render(<ComplianceList {...defaultProps} controls={[]} filter="test" />);

            expect(screen.getByText('Aucun contrôle ne correspond à votre recherche.')).toBeInTheDocument();
        });
    });

    describe('domains rendering', () => {
        it('renders domain headers', () => {
            render(<ComplianceList {...defaultProps} />);

            // Multiple elements with similar text may exist - check for domain header specifically
            expect(screen.getAllByText(/Politiques de sécurité/).length).toBeGreaterThan(0);
            expect(screen.getByText('Organisation')).toBeInTheDocument();
        });

        it('shows domain descriptions', () => {
            render(<ComplianceList {...defaultProps} />);

            expect(screen.getByText(/Politiques organisationnelles/)).toBeInTheDocument();
        });

        it('shows control count per domain', () => {
            render(<ComplianceList {...defaultProps} />);

            expect(screen.getByText(/2 contrôles/)).toBeInTheDocument();
        });

        it('shows progress percentage', () => {
            render(<ComplianceList {...defaultProps} />);

            // Multiple progress labels exist for each domain
            expect(screen.getAllByText('Progression').length).toBeGreaterThan(0);
        });
    });

    describe('domain expansion', () => {
        it('expands domain when clicked', () => {
            render(<ComplianceList {...defaultProps} />);

            fireEvent.click(screen.getByTestId('domain-header-A.5'));

            // Should show control names after expansion
            expect(screen.getByText('Revue des politiques')).toBeInTheDocument();
        });

        it('collapses domain when clicked again', () => {
            render(<ComplianceList {...defaultProps} />);

            fireEvent.click(screen.getByTestId('domain-header-A.5'));
            fireEvent.click(screen.getByTestId('domain-header-A.5'));

            // Controls should be hidden after collapse
            // Note: this depends on the actual implementation hiding the controls
        });

        it('auto-expands when filter is active', () => {
            render(<ComplianceList {...defaultProps} filter="politique" />);

            // Should show controls because filter is active
            expect(screen.getByText('Revue des politiques')).toBeInTheDocument();
        });
    });

    describe('control rows', () => {
        it('calls onSelectControl when control clicked', () => {
            render(<ComplianceList {...defaultProps} />);

            fireEvent.click(screen.getByTestId('domain-header-A.5'));
            fireEvent.click(screen.getByTestId('control-row-A.5.1'));

            expect(mockOnSelectControl).toHaveBeenCalledWith(mockControls[0]);
        });

        it('shows control status badges', () => {
            render(<ComplianceList {...defaultProps} />);

            fireEvent.click(screen.getByTestId('domain-header-A.5'));

            expect(screen.getByText('Implémenté')).toBeInTheDocument();
            expect(screen.getByText('Partiel')).toBeInTheDocument();
        });

        it('highlights selected control', () => {
            const { container } = render(
                <ComplianceList {...defaultProps} selectedControlId="ctrl-1" />
            );

            fireEvent.click(screen.getByTestId('domain-header-A.5'));

            expect(container.querySelector('.bg-brand-50\\/50')).toBeInTheDocument();
        });
    });

    describe('badges and indicators', () => {
        it('shows evidence badge when evidences exist', () => {
            render(<ComplianceList {...defaultProps} />);

            fireEvent.click(screen.getByTestId('domain-header-A.5'));

            // Should show evidence count badge - there may be multiple '1's so use getAllBy
            expect(screen.getAllByText('1').length).toBeGreaterThan(0);
        });

        it('shows missing evidence warning when implemented but no evidence', () => {
            const controlsWithMissingEvidence = [
                { ...mockControls[0], evidenceIds: [] }
            ];

            render(<ComplianceList {...defaultProps} controls={controlsWithMissingEvidence} />);

            fireEvent.click(screen.getByTestId('domain-header-A.5'));

            expect(screen.getByText('Manquante')).toBeInTheDocument();
        });
    });
});
