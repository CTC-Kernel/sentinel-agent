/**
 * Unit tests for AuditFindings component
 * Tests audit findings display and form
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditFindings } from '../AuditFindings';
import { Audit, Control, Finding } from '../../../../types';

// Mock store
vi.mock('../../../../store', () => ({
    useStore: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            const translations: Record<string, string> = {
                'audits.findingsSection.newFinding': 'Nouveau Constat',
                'audits.findingsSection.add': 'Ajouter',
                'audits.findingsSection.listTitle': `Constats (${params?.count || 0})`,
                'audits.findingsSection.emptyTitle': 'Aucun constat',
                'audits.findingsSection.emptyDesc': 'Aucun constat n\'a été enregistré pour cet audit.',
                'audits.findingsSection.uploadEvidence': 'Télécharger une preuve',
                'audits.findingsSection.delete': 'Supprimer',
                'audits.findingsSection.form.description': 'Description',
                'audits.findingsSection.form.descriptionPlaceholder': 'Décrivez le constat...',
                'audits.findingsSection.form.linkControl': 'Lier à un contrôle',
                'audits.findingsSection.form.type.minor': 'Mineure',
                'audits.findingsSection.form.type.major': 'Majeure',
                'audits.findingsSection.form.type.observation': 'Observation',
                'audits.findingsSection.form.type.opportunity': 'Opportunité',
                'audits.findingsSection.form.severity.critical': 'Critique',
                'audits.findingsSection.form.severity.high': 'Haute',
                'audits.findingsSection.form.severity.medium': 'Moyenne',
                'audits.findingsSection.form.severity.low': 'Faible',
                'audits.findingsSection.form.severity.info': 'Info'
            };
            return translations[key] || key;
        }
    })
}));

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
    useForm: () => ({
        register: (name: string) => ({ name }),
        handleSubmit: (fn: (data: unknown) => void) => (e: React.FormEvent) => {
            e.preventDefault();
            fn({ description: 'Test description', type: 'Mineure', severity: 'Moyenne', status: 'Ouvert', relatedControlId: '' });
        },
        setValue: vi.fn(),
        reset: vi.fn()
    })
}));

// Mock zod resolver
vi.mock('@hookform/resolvers/zod', () => ({
    zodResolver: () => vi.fn()
}));

// Mock EmptyState
vi.mock('../../../ui/EmptyState', () => ({
    EmptyState: ({ title, description }: { title: string; description: string }) => (
        <div data-testid="empty-state">
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    )
}));

// Mock Tooltip
vi.mock('../../../ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock FloatingLabelTextarea
vi.mock('../../../ui/FloatingLabelInput', () => ({
    FloatingLabelTextarea: (props: { label: string }) => (
        <textarea data-testid="description-textarea" aria-label={props.label} />
    )
}));

// Mock AIAssistButton
vi.mock('../../../ai/AIAssistButton', () => ({
    AIAssistButton: () => <button data-testid="ai-assist">AI Assist</button>
}));

// Mock ErrorLogger
vi.mock('../../../../services/errorLogger', () => ({
    ErrorLogger: {
        handleErrorWithToast: vi.fn()
    }
}));

describe('AuditFindings', () => {
    const mockOnAddFinding = vi.fn();
    const mockOnDeleteFinding = vi.fn();
    const mockOnUploadEvidence = vi.fn();

    const mockAudit: Audit = {
        id: 'audit-1',
        organizationId: 'org-1',
        name: 'ISO 27001 Audit',
        type: 'Certification',
        status: 'En cours',
        dateScheduled: '2024-02-01',
        auditor: 'John Doe',
        findingsCount: 3
    };

    const mockControls: Control[] = [
        { id: 'ctrl-1', organizationId: 'org-1', code: 'A.5.1', name: 'Policies for information security', status: 'Implémenté', evidenceIds: [] },
        { id: 'ctrl-2', organizationId: 'org-1', code: 'A.6.1', name: 'Internal organization', status: 'Partiel', evidenceIds: [] }
    ];

    const mockFindings: Finding[] = [
        {
            id: 'find-1',
            organizationId: 'org-1',
            auditId: 'audit-1',
            description: 'Missing access control policy',
            type: 'Majeure',
            severity: 'Haute',
            status: 'Ouvert',
            relatedControlId: 'ctrl-1',
            createdAt: '2024-01-15'
        },
        {
            id: 'find-2',
            organizationId: 'org-1',
            auditId: 'audit-1',
            description: 'Incomplete documentation',
            type: 'Mineure',
            severity: 'Moyenne',
            status: 'Ouvert',
            relatedControlId: 'ctrl-2',
            createdAt: '2024-01-14'
        },
        {
            id: 'find-3',
            organizationId: 'org-1',
            auditId: 'audit-1',
            description: 'Opportunity for automation',
            type: 'Opportunité',
            severity: 'Faible',
            status: 'Ouvert',
            relatedControlId: '',
            createdAt: '2024-01-13'
        }
    ];

    const defaultProps = {
        audit: mockAudit,
        controls: mockControls,
        findings: [],
        canEdit: true,
        onAddFinding: mockOnAddFinding,
        onDeleteFinding: mockOnDeleteFinding,
        onUploadEvidence: mockOnUploadEvidence
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnAddFinding.mockResolvedValue(undefined);
        mockOnDeleteFinding.mockResolvedValue(undefined);
        mockOnUploadEvidence.mockResolvedValue('evidence-1');
    });

    describe('form rendering', () => {
        it('shows form when canEdit is true', () => {
            render(<AuditFindings {...defaultProps} />);

            expect(screen.getByText('Nouveau Constat')).toBeInTheDocument();
        });

        it('hides form when canEdit is false', () => {
            render(<AuditFindings {...defaultProps} canEdit={false} />);

            expect(screen.queryByText('Nouveau Constat')).not.toBeInTheDocument();
        });

        it('renders description textarea', () => {
            render(<AuditFindings {...defaultProps} />);

            expect(screen.getByTestId('description-textarea')).toBeInTheDocument();
        });

        it('renders AI assist button', () => {
            render(<AuditFindings {...defaultProps} />);

            expect(screen.getByTestId('ai-assist')).toBeInTheDocument();
        });

        it('renders submit button', () => {
            render(<AuditFindings {...defaultProps} />);

            expect(screen.getByLabelText('Ajouter')).toBeInTheDocument();
        });

        it('renders type select with options', () => {
            render(<AuditFindings {...defaultProps} />);

            expect(screen.getByText('Mineure')).toBeInTheDocument();
            expect(screen.getByText('Majeure')).toBeInTheDocument();
            expect(screen.getByText('Observation')).toBeInTheDocument();
            expect(screen.getByText('Opportunité')).toBeInTheDocument();
        });

        it('renders severity select with options', () => {
            render(<AuditFindings {...defaultProps} />);

            expect(screen.getByText('Critique')).toBeInTheDocument();
            expect(screen.getByText('Haute')).toBeInTheDocument();
            expect(screen.getByText('Moyenne')).toBeInTheDocument();
            expect(screen.getByText('Faible')).toBeInTheDocument();
            expect(screen.getByText('Info')).toBeInTheDocument();
        });

        it('renders control linking select', () => {
            render(<AuditFindings {...defaultProps} />);

            expect(screen.getByText('Lier à un contrôle')).toBeInTheDocument();
            expect(screen.getByText(/A.5.1/)).toBeInTheDocument();
            expect(screen.getByText(/A.6.1/)).toBeInTheDocument();
        });
    });

    describe('form submission', () => {
        it('calls onAddFinding when form submitted', async () => {
            render(<AuditFindings {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Ajouter'));

            expect(mockOnAddFinding).toHaveBeenCalled();
        });
    });

    describe('findings list', () => {
        it('shows finding count in header', () => {
            render(<AuditFindings {...defaultProps} findings={mockFindings} />);

            expect(screen.getByText('Constats (3)')).toBeInTheDocument();
        });

        it('shows empty state when no findings', () => {
            render(<AuditFindings {...defaultProps} findings={[]} />);

            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
            expect(screen.getByText('Aucun constat')).toBeInTheDocument();
        });

        it('displays finding descriptions', () => {
            render(<AuditFindings {...defaultProps} findings={mockFindings} />);

            expect(screen.getByText('Missing access control policy')).toBeInTheDocument();
            expect(screen.getByText('Incomplete documentation')).toBeInTheDocument();
        });

        it('shows finding type badges', () => {
            render(<AuditFindings {...defaultProps} findings={mockFindings} />);

            // Multiple type badges exist
            expect(screen.getAllByText('Majeure').length).toBeGreaterThan(0);
        });

        it('shows finding severity badges', () => {
            render(<AuditFindings {...defaultProps} findings={mockFindings} />);

            // Multiple severity badges exist
            expect(screen.getAllByText('Haute').length).toBeGreaterThan(0);
        });
    });

    describe('finding actions', () => {
        it('shows delete button when canEdit', () => {
            render(<AuditFindings {...defaultProps} findings={mockFindings} />);

            expect(screen.getAllByLabelText('Supprimer').length).toBe(3);
        });

        it('hides delete button when canEdit is false', () => {
            render(<AuditFindings {...defaultProps} findings={mockFindings} canEdit={false} />);

            expect(screen.queryByLabelText('Supprimer')).not.toBeInTheDocument();
        });

        it('calls onDeleteFinding when delete clicked', () => {
            render(<AuditFindings {...defaultProps} findings={mockFindings} />);

            const deleteButtons = screen.getAllByLabelText('Supprimer');
            fireEvent.click(deleteButtons[0]);

            expect(mockOnDeleteFinding).toHaveBeenCalledWith('find-1');
        });

        it('shows upload button when canEdit', () => {
            render(<AuditFindings {...defaultProps} findings={mockFindings} />);

            expect(screen.getAllByLabelText('Upload de preuve pour le constat').length).toBe(3);
        });
    });

    describe('finding styling', () => {
        it('applies correct color for major findings', () => {
            const { container } = render(<AuditFindings {...defaultProps} findings={mockFindings} />);

            // Check for red styling on major findings
            expect(container.querySelector('.bg-red-100')).toBeInTheDocument();
        });

        it('applies correct color for opportunity findings', () => {
            const { container } = render(<AuditFindings {...defaultProps} findings={mockFindings} />);

            // Check for green styling on opportunity findings
            expect(container.querySelector('.bg-green-100')).toBeInTheDocument();
        });
    });
});
