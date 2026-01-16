/**
 * Unit tests for ApprovalFlow component
 * Tests document approval workflow and timeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalFlow } from '../ApprovalFlow';
import { Document, UserProfile } from '../../../types';

// Mock Icons
vi.mock('../../ui/Icons', () => ({
    CheckCircle2: () => <span data-testid="check-circle-icon" />,
    XCircle: () => <span data-testid="x-circle-icon" />,
    Send: () => <span data-testid="send-icon" />,
    ShieldCheck: () => <span data-testid="shield-check-icon" />
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: { children?: React.ReactNode; className?: string; [key: string]: unknown }) => (
            <div className={className} {...props}>{children}</div>
        )
    }
}));

// Mock useDocumentWorkflow hook
const mockSubmitForReview = vi.fn();
const mockApproveDocument = vi.fn();
const mockRejectDocument = vi.fn();
const mockPublishDocument = vi.fn();

vi.mock('../../../hooks/useDocumentWorkflow', () => ({
    useDocumentWorkflow: () => ({
        submitForReview: mockSubmitForReview,
        approveDocument: mockApproveDocument,
        rejectDocument: mockRejectDocument,
        publishDocument: mockPublishDocument,
        loading: false
    })
}));

// Mock store
vi.mock('../../../store', () => ({
    useStore: () => ({
        user: {
            uid: 'user-1',
            displayName: 'Current User'
        }
    })
}));

describe('ApprovalFlow', () => {
    const mockUsers: UserProfile[] = [
        {
            uid: 'user-1',
            email: 'current@example.com',
            displayName: 'Current User',
            role: 'admin',
            organizationId: 'org-1'
        },
        {
            uid: 'user-2',
            email: 'reviewer@example.com',
            displayName: 'Reviewer User',
            role: 'user',
            organizationId: 'org-1'
        },
        {
            uid: 'user-3',
            email: 'other@example.com',
            displayName: 'Other User',
            role: 'user',
            organizationId: 'org-1'
        }
    ];

    const draftDocument: Document = {
        id: 'doc-1',
        name: 'Security Policy',
        type: 'Politique',
        status: 'Brouillon',
        ownerId: 'user-1',
        owner: 'Current User',
        createdAt: '2024-01-01',
        workflowHistory: []
    };

    const inReviewDocument: Document = {
        ...draftDocument,
        status: 'En revue',
        reviewers: ['user-1'],
        workflowHistory: [
            {
                id: 'hist-1',
                action: 'soumettre',
                userId: 'user-2',
                userName: 'Reviewer User',
                date: '2024-01-15T10:00:00Z',
                comment: 'Please review this policy'
            }
        ]
    };

    const approvedDocument: Document = {
        ...draftDocument,
        status: 'Approuvé',
        workflowHistory: [
            {
                id: 'hist-1',
                action: 'soumettre',
                userId: 'user-1',
                userName: 'Current User',
                date: '2024-01-15T10:00:00Z'
            },
            {
                id: 'hist-2',
                action: 'approuver',
                userId: 'user-2',
                userName: 'Reviewer User',
                date: '2024-01-16T14:00:00Z',
                comment: 'Looks good!'
            }
        ]
    };

    const documentWithHistory: Document = {
        ...draftDocument,
        workflowHistory: [
            {
                id: 'hist-1',
                action: 'soumettre',
                userId: 'user-1',
                userName: 'Current User',
                date: '2024-01-15T10:00:00Z',
                comment: 'Initial submission'
            },
            {
                id: 'hist-2',
                action: 'rejeter',
                userId: 'user-2',
                userName: 'Reviewer User',
                date: '2024-01-16T11:00:00Z',
                comment: 'Needs more detail'
            }
        ]
    };

    const defaultProps = {
        document: draftDocument,
        users: mockUsers
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('header', () => {
        it('renders workflow title', () => {
            render(<ApprovalFlow {...defaultProps} />);

            expect(screen.getByText('Flux de Validation')).toBeInTheDocument();
        });

        it('renders shield check icon', () => {
            render(<ApprovalFlow {...defaultProps} />);

            expect(screen.getByTestId('shield-check-icon')).toBeInTheDocument();
        });
    });

    describe('owner actions - draft', () => {
        it('shows submit button for owner with draft', () => {
            render(<ApprovalFlow {...defaultProps} />);

            expect(screen.getByLabelText('Soumettre le document pour revue')).toBeInTheDocument();
        });

        it('shows submit form when button clicked', () => {
            render(<ApprovalFlow {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Soumettre le document pour revue'));

            expect(screen.getByText('Sélectionner les réviseurs')).toBeInTheDocument();
        });

        it('shows reviewer select with other users', () => {
            render(<ApprovalFlow {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Soumettre le document pour revue'));

            // Current user should not be in the list
            expect(screen.queryByText('Current User')).not.toBeInTheDocument();
            expect(screen.getByText('Reviewer User')).toBeInTheDocument();
            expect(screen.getByText('Other User')).toBeInTheDocument();
        });

        it('shows message input for reviewers', () => {
            render(<ApprovalFlow {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Soumettre le document pour revue'));

            expect(screen.getByLabelText('Message pour les réviseurs')).toBeInTheDocument();
        });

        it('has cancel button in submit form', () => {
            render(<ApprovalFlow {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Soumettre le document pour revue'));

            expect(screen.getByLabelText('Annuler la soumission')).toBeInTheDocument();
        });

        it('has confirm button in submit form', () => {
            render(<ApprovalFlow {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Soumettre le document pour revue'));

            expect(screen.getByLabelText('Confirmer la soumission')).toBeInTheDocument();
        });
    });

    describe('reviewer actions - in review', () => {
        it('shows approve button for reviewer', () => {
            render(<ApprovalFlow document={inReviewDocument} users={mockUsers} />);

            expect(screen.getByLabelText('Approuver le document')).toBeInTheDocument();
        });

        it('shows reject button for reviewer', () => {
            render(<ApprovalFlow document={inReviewDocument} users={mockUsers} />);

            expect(screen.getByLabelText('Rejeter le document')).toBeInTheDocument();
        });

        it('calls approveDocument when approve clicked', () => {
            render(<ApprovalFlow document={inReviewDocument} users={mockUsers} />);

            fireEvent.click(screen.getByLabelText('Approuver le document'));

            expect(mockApproveDocument).toHaveBeenCalledWith(inReviewDocument);
        });

        it('shows reject form when reject clicked', () => {
            render(<ApprovalFlow document={inReviewDocument} users={mockUsers} />);

            fireEvent.click(screen.getByLabelText('Rejeter le document'));

            expect(screen.getByLabelText('Raison du rejet')).toBeInTheDocument();
        });
    });

    describe('owner actions - approved', () => {
        it('shows publish button for owner with approved document', () => {
            render(<ApprovalFlow document={approvedDocument} users={mockUsers} />);

            expect(screen.getByLabelText('Publier officiellement le document')).toBeInTheDocument();
        });

        it('calls publishDocument when publish clicked', () => {
            render(<ApprovalFlow document={approvedDocument} users={mockUsers} />);

            fireEvent.click(screen.getByLabelText('Publier officiellement le document'));

            expect(mockPublishDocument).toHaveBeenCalledWith(approvedDocument);
        });
    });

    describe('workflow history', () => {
        it('shows empty history message when no history', () => {
            render(<ApprovalFlow {...defaultProps} />);

            expect(screen.getByText('Aucun historique de workflow.')).toBeInTheDocument();
        });

        it('displays history actions', () => {
            render(<ApprovalFlow document={documentWithHistory} users={mockUsers} />);

            expect(screen.getByText('SOUMETTRE')).toBeInTheDocument();
            expect(screen.getByText('REJETER')).toBeInTheDocument();
        });

        it('displays history user names', () => {
            render(<ApprovalFlow document={documentWithHistory} users={mockUsers} />);

            expect(screen.getAllByText('Current User').length).toBeGreaterThan(0);
            expect(screen.getByText('Reviewer User')).toBeInTheDocument();
        });

        it('displays history comments', () => {
            render(<ApprovalFlow document={documentWithHistory} users={mockUsers} />);

            expect(screen.getByText('"Initial submission"')).toBeInTheDocument();
            expect(screen.getByText('"Needs more detail"')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has timeline border', () => {
            const { container } = render(<ApprovalFlow document={documentWithHistory} users={mockUsers} />);

            expect(container.querySelector('.border-l-2')).toBeInTheDocument();
        });
    });
});
