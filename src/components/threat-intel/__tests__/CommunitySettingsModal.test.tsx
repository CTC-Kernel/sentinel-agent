/**
 * Unit tests for CommunitySettingsModal component
 * Tests community privacy and trust network settings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommunitySettingsModal } from '../CommunitySettingsModal';
import { TrustRelationship } from '../../../types';

// Mock Headless UI with inline implementation
vi.mock('@headlessui/react', () => {
    const Dialog = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dialog">{children}</div>
    );
    Dialog.Panel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div data-testid="dialog-panel" className={className}>{children}</div>
    );
    Dialog.Title = ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <h2 data-testid="dialog-title" className={className}>{children}</h2>
    );

    return {
        Dialog,
        Transition: {
            Root: ({ show, children }: { show: boolean; children: React.ReactNode }) =>
                show ? <div data-testid="transition">{children}</div> : null,
            Child: ({ children }: { children: React.ReactNode }) => <>{children}</>
        }
    };
});

// Mock store
vi.mock('../../../store', () => ({
    useStore: () => ({
        user: {
            uid: 'user-1',
            organizationId: 'org-1'
        },
        addToast: vi.fn()
    })
}));

// Mock settings actions
vi.mock('../../../hooks/settings/useSettingsActions', () => ({
    useSettingsActions: () => ({
        saveCommunitySettings: vi.fn().mockResolvedValue(undefined)
    })
}));

// Mock Button
vi.mock('../../ui/button', () => ({
    Button: ({ children, onClick, type, isLoading, className }: {
        children: React.ReactNode;
        onClick?: () => void;
        type?: string;
        isLoading?: boolean;
        className?: string;
    }) => (
        <button onClick={onClick} type={type as 'button'} disabled={isLoading} className={className}>
            {isLoading ? 'Loading...' : children}
        </button>
    )
}));

describe('CommunitySettingsModal', () => {
    const mockPartners: TrustRelationship[] = [
        {
            id: 'rel-1',
            sourceOrgId: 'org-1',
            targetOrgId: 'org-2',
            targetOrgName: 'Partner Corp',
            status: 'trusted',
            createdAt: new Date()
        },
        {
            id: 'rel-2',
            sourceOrgId: 'org-1',
            targetOrgId: 'org-3',
            targetOrgName: 'Blocked Inc',
            status: 'blocked',
            createdAt: new Date()
        },
        {
            id: 'rel-3',
            sourceOrgId: 'org-1',
            targetOrgId: 'org-4',
            targetOrgName: 'Pending Ltd',
            status: 'pending',
            createdAt: new Date()
        }
    ];

    const mockOnTrustAction = vi.fn();
    const mockOnClose = vi.fn();

    const defaultProps = {
        isOpen: true,
        onClose: mockOnClose,
        partners: mockPartners,
        onTrustAction: mockOnTrustAction
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering when open', () => {
        it('renders dialog when open', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByTestId('transition')).toBeInTheDocument();
        });

        it('renders modal title', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByText('Gestion de la Communauté')).toBeInTheDocument();
        });

        it('renders subtitle', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByText('Confidentialité et Réseau de Confiance')).toBeInTheDocument();
        });

        it('renders close button', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByLabelText('Fermer la fenêtre')).toBeInTheDocument();
        });

        it('renders save button', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByText('Enregistrer')).toBeInTheDocument();
        });
    });

    describe('tabs', () => {
        it('renders general settings tab', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByText('Paramètres Généraux')).toBeInTheDocument();
        });

        it('renders network tab with count', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            // One trusted partner
            expect(screen.getByText('Mon Réseau (1)')).toBeInTheDocument();
        });

        it('switches to network tab on click', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));

            // Should show search input
            expect(screen.getByPlaceholderText('Rechercher une organisation...')).toBeInTheDocument();
        });
    });

    describe('general settings tab', () => {
        it('renders privacy info box', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByText('Confidentialité par défaut')).toBeInTheDocument();
        });

        it('renders scope options', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByText('Publique (Tout le monde)')).toBeInTheDocument();
            expect(screen.getByText('Communauté Sentinel (Auth)')).toBeInTheDocument();
            expect(screen.getByText('Partenaires de Confiance')).toBeInTheDocument();
            expect(screen.getByText('Privé (Interne seulement)')).toBeInTheDocument();
        });

        it('renders anonymize identity toggle', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByText('Anonymiser mon identité')).toBeInTheDocument();
        });

        it('renders auto-share toggle', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            expect(screen.getByText('Partage auto. (Critique)')).toBeInTheDocument();
        });
    });

    describe('network tab', () => {
        it('renders partner list', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));

            expect(screen.getByText('Partner Corp')).toBeInTheDocument();
            expect(screen.getByText('Blocked Inc')).toBeInTheDocument();
            expect(screen.getByText('Pending Ltd')).toBeInTheDocument();
        });

        it('shows revoke button for trusted partners', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));

            expect(screen.getByText('Révoquer')).toBeInTheDocument();
        });

        it('shows unblock button for blocked partners', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));

            expect(screen.getByText('Débloquer')).toBeInTheDocument();
        });

        it('shows approve/block buttons for pending partners', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));

            expect(screen.getByLabelText('Approuver le partenaire')).toBeInTheDocument();
            expect(screen.getByLabelText('Bloquer le partenaire')).toBeInTheDocument();
        });

        it('filters partners by search', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));
            fireEvent.change(screen.getByPlaceholderText('Rechercher une organisation...'), {
                target: { value: 'Partner' }
            });

            expect(screen.getByText('Partner Corp')).toBeInTheDocument();
            expect(screen.queryByText('Blocked Inc')).not.toBeInTheDocument();
        });
    });

    describe('trust actions', () => {
        it('calls onTrustAction when approve clicked', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));
            fireEvent.click(screen.getByLabelText('Approuver le partenaire'));

            expect(mockOnTrustAction).toHaveBeenCalledWith('rel-3', 'trust');
        });

        it('calls onTrustAction when block clicked', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));
            fireEvent.click(screen.getByLabelText('Bloquer le partenaire'));

            expect(mockOnTrustAction).toHaveBeenCalledWith('rel-3', 'block');
        });

        it('calls onTrustAction when revoke clicked', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));
            fireEvent.click(screen.getByLabelText('Révoquer le statut de confiance'));

            expect(mockOnTrustAction).toHaveBeenCalledWith('rel-1', 'remove');
        });

        it('calls onTrustAction when unblock clicked', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Mon Réseau (1)'));
            fireEvent.click(screen.getByLabelText('Débloquer le partenaire'));

            expect(mockOnTrustAction).toHaveBeenCalledWith('rel-2', 'trust');
        });
    });

    describe('when closed', () => {
        it('does not render when closed', () => {
            render(<CommunitySettingsModal {...defaultProps} isOpen={false} />);

            expect(screen.queryByTestId('transition')).not.toBeInTheDocument();
        });
    });

    describe('close interaction', () => {
        it('calls onClose when close button clicked', () => {
            render(<CommunitySettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Fermer la fenêtre'));

            expect(mockOnClose).toHaveBeenCalled();
        });
    });
});
