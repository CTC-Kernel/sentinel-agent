/**
 * Unit tests for ActionCard component
 * Tests AI action confirmation card
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionCard } from '../ActionCard';
import { AIActionType } from '../../../services/ai/actionRegistry';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
            <div className={className}>{children}</div>
        )
    }
}));

// Mock useAuth
vi.mock('../../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: {
            uid: 'user-1',
            organizationId: 'org-1'
        }
    })
}));

// Mock ErrorLogger
vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock ActionRegistry
const mockExecute = vi.fn();
vi.mock('../../../services/ai/actionRegistry', () => ({
    AIActionType: {
        CREATE_ASSET: 'CREATE_ASSET',
        UPDATE_RISK: 'UPDATE_RISK',
        BULK_DELETE_ASSETS: 'BULK_DELETE_ASSETS'
    },
    ActionRegistry: {
        CREATE_ASSET: { label: 'Créer un Actif' },
        UPDATE_RISK: { label: 'Mettre à jour un Risque' }
    },
    AIActionExecutor: {
        execute: (...args: unknown[]) => mockExecute(...args)
    }
}));

describe('ActionCard', () => {
    const defaultProps = {
        type: AIActionType.CREATE_ASSET,
        payload: { name: 'Test Asset', type: 'Logiciel' },
        reasoning: 'This will help improve security',
        onComplete: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue('Action completed successfully');
    });

    describe('idle state', () => {
        it('renders action header', () => {
            render(<ActionCard {...defaultProps} />);

            expect(screen.getByText('Action Recommandée')).toBeInTheDocument();
        });

        it('renders action label', () => {
            render(<ActionCard {...defaultProps} />);

            expect(screen.getByText('Créer un Actif')).toBeInTheDocument();
        });

        it('renders reasoning', () => {
            render(<ActionCard {...defaultProps} />);

            expect(screen.getByText('"This will help improve security"')).toBeInTheDocument();
        });

        it('renders payload preview', () => {
            render(<ActionCard {...defaultProps} />);

            expect(screen.getByText(/"name": "Test Asset"/)).toBeInTheDocument();
        });

        it('renders confirm button', () => {
            render(<ActionCard {...defaultProps} />);

            expect(screen.getByText('Confirmer')).toBeInTheDocument();
        });

        it('renders refuse button', () => {
            render(<ActionCard {...defaultProps} />);

            expect(screen.getByText('Refuser')).toBeInTheDocument();
        });
    });

    describe('confirm action', () => {
        it('shows loading state when confirming', async () => {
            mockExecute.mockImplementation(() => new Promise(() => {})); // Never resolves

            render(<ActionCard {...defaultProps} />);

            fireEvent.click(screen.getByText('Confirmer'));

            await waitFor(() => {
                expect(screen.getByText('Exécution...')).toBeInTheDocument();
            });
        });

        it('shows success state after completion', async () => {
            render(<ActionCard {...defaultProps} />);

            fireEvent.click(screen.getByText('Confirmer'));

            await waitFor(() => {
                expect(screen.getByText('Action completed successfully')).toBeInTheDocument();
            });
        });

        it('calls onComplete after success', async () => {
            render(<ActionCard {...defaultProps} />);

            fireEvent.click(screen.getByText('Confirmer'));

            await waitFor(() => {
                expect(defaultProps.onComplete).toHaveBeenCalledWith('Action completed successfully');
            });
        });
    });

    describe('refuse action', () => {
        it('shows cancelled message when refused', () => {
            render(<ActionCard {...defaultProps} />);

            fireEvent.click(screen.getByText('Refuser'));

            expect(screen.getByText("Action annulée par l'utilisateur.")).toBeInTheDocument();
        });
    });

    describe('error handling', () => {
        it('shows error message on failure', async () => {
            mockExecute.mockRejectedValue(new Error('Test error'));

            render(<ActionCard {...defaultProps} />);

            fireEvent.click(screen.getByText('Confirmer'));

            await waitFor(() => {
                expect(screen.getByText('Test error')).toBeInTheDocument();
            });
        });
    });

    describe('unknown action', () => {
        it('shows error for unknown action type', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            render(<ActionCard {...defaultProps} type={'UNKNOWN_ACTION' as any} />);

            expect(screen.getByText(/Action inconnue/)).toBeInTheDocument();
        });
    });

    describe('accessibility', () => {
        it('has accessible confirm button', () => {
            render(<ActionCard {...defaultProps} />);

            expect(screen.getByLabelText("Confirmer l'action: Créer un Actif")).toBeInTheDocument();
        });

        it('has accessible refuse button', () => {
            render(<ActionCard {...defaultProps} />);

            expect(screen.getByLabelText("Refuser l'action: Créer un Actif")).toBeInTheDocument();
        });
    });

    describe('without reasoning', () => {
        it('renders without reasoning', () => {
            render(<ActionCard {...defaultProps} reasoning={undefined} />);

            expect(screen.getByText('Créer un Actif')).toBeInTheDocument();
            expect(screen.queryByText(/This will help/)).not.toBeInTheDocument();
        });
    });
});
