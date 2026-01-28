/**
 * Unit tests for SupplierContractCompliance component
 * Tests DORA contract compliance checklist functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SupplierContractCompliance } from '../SupplierContractCompliance';
import { Supplier, Criticality } from '../../../../types';

// Mock UI icons
vi.mock('../../../ui/Icons', () => ({
    Check: () => <span data-testid="check-icon" />,
    ShieldCheck: () => <span data-testid="shield-check-icon" />,
    AlertTriangle: () => <span data-testid="alert-triangle-icon" />,
    FileText: () => <span data-testid="file-text-icon" />,
    Scale: () => <span data-testid="scale-icon" />,
    Siren: () => <span data-testid="siren-icon" />,
    LogOut: () => <span data-testid="logout-icon" />,
    Globe: () => <span data-testid="globe-icon" />
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: { children?: React.ReactNode; className?: string;[key: string]: unknown }) => (
            <div className={className} {...props}>{children}</div>
        )
    }
}));

// Mock ErrorLogger
vi.mock('../../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

describe('SupplierContractCompliance', () => {
    const mockOnUpdate = vi.fn();

    const mockSupplier: Supplier = {
        id: 'supplier-1',
        organizationId: 'org-1',
        name: 'Cloud Provider Inc',
        category: 'SaaS',
        criticality: Criticality.HIGH,
        status: 'Actif',
        doraContractClauses: {
            auditRights: true,
            slaDefined: true,
            dataLocation: false,
            subcontractingConditions: false,
            incidentNotification: true,
            exitStrategy: false
        },
        riskAssessment: {
            overallScore: 75
        },
        contract: {
            endDate: '2025-12-31'
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-01T00:00:00Z',
        reviewDates: {
            contractReview: '2024-03-01',
            securityReview: '2024-03-15',
            complianceReview: '2024-04-01'
        }
    };

    const supplierWithNoClauses: Supplier = {
        ...mockSupplier,
        doraContractClauses: undefined
    };

    const supplierWithAllClauses: Supplier = {
        ...mockSupplier,
        doraContractClauses: {
            auditRights: true,
            slaDefined: true,
            dataLocation: true,
            subcontractingConditions: true,
            incidentNotification: true,
            exitStrategy: true
        }
    };

    const defaultProps = {
        supplier: mockSupplier,
        canEdit: true,
        onUpdate: mockOnUpdate
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnUpdate.mockResolvedValue(undefined);
    });

    describe('header rendering', () => {
        it('renders section title', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText('Conformité Contractuelle DORA')).toBeInTheDocument();
        });

        it('renders description', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText('Vérifiez la présence des clauses obligatoires pour les prestataires TIC critiques.')).toBeInTheDocument();
        });

        it('renders conformité label', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText('Conformité')).toBeInTheDocument();
        });
    });

    describe('progress calculation', () => {
        it('shows correct percentage with partial compliance', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            // 3 out of 6 = 50%
            expect(screen.getByText('50%')).toBeInTheDocument();
        });

        it('shows 100% with full compliance', () => {
            render(<SupplierContractCompliance {...defaultProps} supplier={supplierWithAllClauses} />);

            expect(screen.getByText('100%')).toBeInTheDocument();
        });

        it('shows 0% with no clauses', () => {
            render(<SupplierContractCompliance {...defaultProps} supplier={supplierWithNoClauses} />);

            expect(screen.getByText('0%')).toBeInTheDocument();
        });
    });

    describe('checklist items', () => {
        it('renders audit rights item', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText("Droit d'Audit et d'Inspection")).toBeInTheDocument();
        });

        it('renders SLA item', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText('Niveaux de Service (SLA)')).toBeInTheDocument();
        });

        it('renders data location item', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText('Localisation des Données')).toBeInTheDocument();
        });

        it('renders subcontracting item', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText('Contrôle de la Sous-traitance')).toBeInTheDocument();
        });

        it('renders incident notification item', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText("Notification d'Incidents")).toBeInTheDocument();
        });

        it('renders exit strategy item', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText('Stratégie de Sortie (Réversibilité)')).toBeInTheDocument();
        });
    });

    describe('item descriptions', () => {
        it('shows DORA article reference', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText(/DORA Art\. 30/)).toBeInTheDocument();
        });

        it('shows data sovereignty reference', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.getByText(/Souveraineté, RGPD/)).toBeInTheDocument();
        });
    });

    describe('toggle functionality', () => {
        it('calls onUpdate when item clicked', async () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            // Click on data location item (currently false)
            fireEvent.click(screen.getByText('Localisation des Données'));

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalled();
            });
        });

        it('does not call onUpdate when canEdit is false', () => {
            render(<SupplierContractCompliance {...defaultProps} canEdit={false} />);

            fireEvent.click(screen.getByText('Localisation des Données'));

            expect(mockOnUpdate).not.toHaveBeenCalled();
        });
    });

    describe('read-only notice', () => {
        it('shows read-only notice when canEdit is false', () => {
            render(<SupplierContractCompliance {...defaultProps} canEdit={false} />);

            expect(screen.getByText(/Lecture seule/)).toBeInTheDocument();
        });

        it('hides read-only notice when canEdit is true', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            expect(screen.queryByText(/Lecture seule/)).not.toBeInTheDocument();
        });
    });

    describe('icons', () => {
        it('renders shield check icons', () => {
            render(<SupplierContractCompliance {...defaultProps} />);

            // Multiple shield-check icons: one in header, one in subcontracting item
            expect(screen.getAllByTestId('shield-check-icon').length).toBeGreaterThan(0);
        });

        it('renders alert triangle icon for read-only mode', () => {
            render(<SupplierContractCompliance {...defaultProps} canEdit={false} />);

            expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has glass-premium container', () => {
            const { container } = render(<SupplierContractCompliance {...defaultProps} />);

            expect(container.querySelector('.glass-premium')).toBeInTheDocument();
        });

        it('applies emerald color for completed items', () => {
            const { container } = render(<SupplierContractCompliance {...defaultProps} />);

            expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument();
        });

        it('applies emerald color to progress bar when 100%', () => {
            const { container } = render(<SupplierContractCompliance {...defaultProps} supplier={supplierWithAllClauses} />);

            expect(container.querySelector('.text-emerald-500')).toBeInTheDocument();
        });
    });
});
