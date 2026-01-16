/**
 * Unit tests for SupplierAssessments component
 * Tests supplier assessment history display and actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierAssessments } from '../SupplierAssessments';
import { SupplierQuestionnaireResponse } from '../../../../types';

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
    ClipboardList: () => <span data-testid="clipboard-list-icon" />,
    ChevronRight: () => <span data-testid="chevron-right-icon" />,
    Clock: () => <span data-testid="clock-icon" />,
    CheckCircle2: () => <span data-testid="check-circle-icon" />
}));

// Mock EmptyState
vi.mock('../../../ui/EmptyState', () => ({
    EmptyState: ({ title, description, actionLabel, onAction }: {
        icon: unknown;
        title: string;
        description: string;
        actionLabel?: string;
        onAction?: () => void;
    }) => (
        <div data-testid="empty-state">
            <h3>{title}</h3>
            <p>{description}</p>
            {actionLabel && <button onClick={onAction}>{actionLabel}</button>}
        </div>
    )
}));

// Mock Button
vi.mock('../../../ui/button', () => ({
    Button: ({ children, onClick, variant, size, className }: {
        children: React.ReactNode;
        onClick?: () => void;
        variant?: string;
        size?: string;
        className?: string;
    }) => (
        <button
            onClick={onClick}
            data-variant={variant}
            data-size={size}
            className={className}
        >
            {children}
        </button>
    )
}));

describe('SupplierAssessments', () => {
    const mockOnStartAssessment = vi.fn();
    const mockOnViewAssessment = vi.fn();

    const mockAssessments: SupplierQuestionnaireResponse[] = [
        {
            id: 'assessment-1',
            supplierId: 'supplier-1',
            templateId: 'template-1',
            status: 'Submitted',
            overallScore: 85,
            answers: {},
            updatedAt: { seconds: 1704067200 } as unknown as Date // 2024-01-01
        },
        {
            id: 'assessment-2',
            supplierId: 'supplier-1',
            templateId: 'template-1',
            status: 'In Progress',
            overallScore: 45,
            answers: {},
            updatedAt: { seconds: 1703980800 } as unknown as Date // 2023-12-31
        },
        {
            id: 'assessment-3',
            supplierId: 'supplier-1',
            templateId: 'template-1',
            status: 'Draft',
            overallScore: 0,
            answers: {},
            updatedAt: { seconds: 1703894400 } as unknown as Date // 2023-12-30
        }
    ];

    const defaultProps = {
        canEdit: true,
        onStartAssessment: mockOnStartAssessment,
        assessments: mockAssessments,
        onViewAssessment: mockOnViewAssessment
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('header rendering', () => {
        it('renders section title', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getByText('Évaluations')).toBeInTheDocument();
        });

        it('renders section description', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getByText('Historique des évaluations de conformité DORA et ISO.')).toBeInTheDocument();
        });

        it('renders new assessment button when canEdit', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getByText('Nouvelle Évaluation')).toBeInTheDocument();
        });

        it('hides new assessment button when not canEdit', () => {
            render(<SupplierAssessments {...defaultProps} canEdit={false} />);

            expect(screen.queryByText('Nouvelle Évaluation')).not.toBeInTheDocument();
        });

        it('calls onStartAssessment when button clicked', () => {
            render(<SupplierAssessments {...defaultProps} />);

            fireEvent.click(screen.getByText('Nouvelle Évaluation'));

            expect(mockOnStartAssessment).toHaveBeenCalled();
        });
    });

    describe('empty state', () => {
        it('shows empty state when no assessments', () => {
            render(<SupplierAssessments {...defaultProps} assessments={[]} />);

            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        });

        it('shows empty state title', () => {
            render(<SupplierAssessments {...defaultProps} assessments={[]} />);

            expect(screen.getByText('Aucune évaluation')).toBeInTheDocument();
        });

        it('shows empty state description', () => {
            render(<SupplierAssessments {...defaultProps} assessments={[]} />);

            expect(screen.getByText('Lancez une première évaluation DORA pour ce fournisseur.')).toBeInTheDocument();
        });

        it('shows action button in empty state when canEdit', () => {
            render(<SupplierAssessments {...defaultProps} assessments={[]} />);

            expect(screen.getByText('Lancer une évaluation')).toBeInTheDocument();
        });

        it('hides action button in empty state when not canEdit', () => {
            render(<SupplierAssessments {...defaultProps} assessments={[]} canEdit={false} />);

            expect(screen.queryByText('Lancer une évaluation')).not.toBeInTheDocument();
        });
    });

    describe('assessment list', () => {
        it('renders all assessments', () => {
            render(<SupplierAssessments {...defaultProps} />);

            // All three assessments should render the title
            expect(screen.getAllByText('Questionnaire d\'évaluation').length).toBe(3);
        });

        it('displays view details button for each assessment', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getAllByText('Voir les détails').length).toBe(3);
        });

        it('calls onViewAssessment with correct id', () => {
            render(<SupplierAssessments {...defaultProps} />);

            const viewButtons = screen.getAllByText('Voir les détails');
            fireEvent.click(viewButtons[0]);

            expect(mockOnViewAssessment).toHaveBeenCalledWith('assessment-1');
        });
    });

    describe('status labels', () => {
        it('shows Soumis status label', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getByText('Soumis')).toBeInTheDocument();
        });

        it('shows En cours status label', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getByText('En cours')).toBeInTheDocument();
        });

        it('shows Brouillon status label', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getByText('Brouillon')).toBeInTheDocument();
        });
    });

    describe('score display', () => {
        it('shows score for completed assessments', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getByText('Score: 85%')).toBeInTheDocument();
        });

        it('shows score for in progress assessments', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getByText('Score: 45%')).toBeInTheDocument();
        });

        it('hides score when zero', () => {
            render(<SupplierAssessments {...defaultProps} />);

            // Draft assessment has 0 score and shouldn't show
            expect(screen.queryByText('Score: 0%')).not.toBeInTheDocument();
        });
    });

    describe('icons', () => {
        it('renders check circle for submitted assessments', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
        });

        it('renders clock icons', () => {
            render(<SupplierAssessments {...defaultProps} />);

            // Multiple clock icons exist (in non-submitted assessments and dates)
            expect(screen.getAllByTestId('clock-icon').length).toBeGreaterThan(0);
        });

        it('renders chevron right icons', () => {
            render(<SupplierAssessments {...defaultProps} />);

            expect(screen.getAllByTestId('chevron-right-icon').length).toBe(3);
        });
    });

    describe('date display', () => {
        it('formats dates in French locale', () => {
            render(<SupplierAssessments {...defaultProps} />);

            // Check that dates are displayed (format: DD/MM/YYYY for fr-FR)
            expect(screen.getByText('01/01/2024')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('applies green color for submitted status', () => {
            const { container } = render(<SupplierAssessments {...defaultProps} />);

            expect(container.querySelector('.bg-green-100')).toBeInTheDocument();
        });

        it('applies amber color for in progress status', () => {
            const { container } = render(<SupplierAssessments {...defaultProps} />);

            expect(container.querySelector('.bg-amber-100')).toBeInTheDocument();
        });
    });
});
