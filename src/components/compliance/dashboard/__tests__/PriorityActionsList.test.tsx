/**
 * Unit tests for PriorityActionsList component
 * Tests priority action generation, sorting, and navigation
 *
 * @see Story EU-2.4: Créer le composant ActionsList
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PriorityActionsList } from '../PriorityActionsList';
import { Control } from '../../../../types';

// Mock react-i18next with French translations (default)
const translations: Record<string, string> = {
    'actions.priorityActions': 'Actions Prioritaires',
    'actions.subtitle': 'Maximisez votre score de conformité',
    'actions.pending': 'actions',
    'actions.hint': 'Cliquez sur une action pour commencer',
    'actions.implement': 'Implémenter',
    'actions.complete': 'Finaliser',
    'actions.addEvidence': 'Ajouter preuves',
    'actions.currentStatus': 'Statut',
    'actions.potentialGain': 'gain potentiel',
    'actions.allComplete': 'Excellent travail !',
    'actions.noActions': 'Tous vos contrôles sont implémentés et documentés.',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => translations[key] || fallback || key,
    }),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <button {...props}>{children}</button>
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('PriorityActionsList', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
    });

    const createControl = (overrides: Partial<Control> = {}): Control => ({
        id: 'ctrl-1',
        code: 'A.5.1',
        name: 'Test Control',
        description: 'Test description',
        status: 'Non commencé',
        framework: 'ISO27001',
        organizationId: 'org-1',
        ...overrides,
    });

    const renderWithRouter = (ui: React.ReactElement) => {
        return render(<BrowserRouter>{ui}</BrowserRouter>);
    };

    describe('rendering', () => {
        it('renders the component title', () => {
            const controls = [createControl()];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Actions Prioritaires')).toBeInTheDocument();
        });

        it('renders the subtitle', () => {
            const controls = [createControl()];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Maximisez votre score de conformité')).toBeInTheDocument();
        });

        it('renders empty state when all controls are implemented with evidence', () => {
            const controls = [
                createControl({
                    id: '1',
                    status: 'Implémenté',
                    evidenceIds: ['ev-1']
                }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Excellent travail !')).toBeInTheDocument();
            expect(screen.getByText('Tous vos contrôles sont implémentés et documentés.')).toBeInTheDocument();
        });

        it('renders action count in header', () => {
            const controls = [
                createControl({ id: '1', status: 'Non commencé' }),
                createControl({ id: '2', status: 'En cours' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            // Count and "actions" text are together in the header
            expect(screen.getByText(/2\s*actions/)).toBeInTheDocument();
        });

        it('renders hint at the bottom', () => {
            const controls = [createControl()];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Cliquez sur une action pour commencer')).toBeInTheDocument();
        });
    });

    describe('priority sorting', () => {
        it('sorts actions by impact score (criticality × gap)', () => {
            const controls = [
                // Low priority: A.9 code, Non commencé
                createControl({ id: '1', code: 'A.9.1', name: 'Low Priority', status: 'Non commencé' }),
                // High priority: A.5 code (high criticality), Non commencé
                createControl({ id: '2', code: 'A.5.1', name: 'High Priority', status: 'Non commencé' }),
                // Medium priority: A.6 code, Non commencé
                createControl({ id: '3', code: 'A.6.1', name: 'Medium Priority', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            const actionCards = screen.getAllByRole('button');
            // First action should be high priority (A.5)
            expect(actionCards[0]).toHaveTextContent('High Priority');
        });

        it('prioritizes controls with higher gap scores', () => {
            const controls = [
                // Lower gap: Partiel status
                createControl({ id: '1', code: 'A.5.1', name: 'Partial Control', status: 'Partiel' }),
                // Higher gap: Non commencé status
                createControl({ id: '2', code: 'A.5.2', name: 'Not Started Control', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            const actionCards = screen.getAllByRole('button');
            expect(actionCards[0]).toHaveTextContent('Not Started Control');
        });
    });

    describe('action types', () => {
        it('shows "Implémenter" for non-started controls', () => {
            const controls = [
                createControl({ id: '1', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Implémenter')).toBeInTheDocument();
        });

        it('shows "Finaliser" for partial controls', () => {
            const controls = [
                createControl({ id: '1', status: 'Partiel' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Finaliser')).toBeInTheDocument();
        });

        it('shows "Finaliser" for in-progress controls', () => {
            const controls = [
                createControl({ id: '1', status: 'En cours' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Finaliser')).toBeInTheDocument();
        });

        it('shows "Ajouter preuves" for implemented controls without evidence', () => {
            const controls = [
                createControl({ id: '1', status: 'Implémenté', evidenceIds: [] }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Ajouter preuves')).toBeInTheDocument();
        });
    });

    describe('control code display', () => {
        it('displays the control code', () => {
            const controls = [
                createControl({ id: '1', code: 'A.5.7', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('A.5.7')).toBeInTheDocument();
        });

        it('displays the control name', () => {
            const controls = [
                createControl({ id: '1', name: 'Information Security Policy', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Information Security Policy')).toBeInTheDocument();
        });

        it('displays the current status', () => {
            const controls = [
                createControl({ id: '1', status: 'En cours' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText(/Statut:/)).toBeInTheDocument();
            expect(screen.getByText(/En cours/)).toBeInTheDocument();
        });
    });

    describe('maxActions prop', () => {
        it('limits the number of actions displayed', () => {
            const controls = Array.from({ length: 10 }, (_, i) =>
                createControl({ id: `${i}`, code: `A.5.${i}`, name: `Control ${i}`, status: 'Non commencé' })
            );
            renderWithRouter(<PriorityActionsList controls={controls} maxActions={3} />);

            const actionCards = screen.getAllByRole('button');
            expect(actionCards).toHaveLength(3);
        });

        it('defaults to 5 actions', () => {
            const controls = Array.from({ length: 10 }, (_, i) =>
                createControl({ id: `${i}`, code: `A.5.${i}`, name: `Control ${i}`, status: 'Non commencé' })
            );
            renderWithRouter(<PriorityActionsList controls={controls} />);

            const actionCards = screen.getAllByRole('button');
            expect(actionCards).toHaveLength(5);
        });
    });

    describe('navigation', () => {
        it('navigates to control page when action is clicked', () => {
            const controls = [
                createControl({ id: 'ctrl-123', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            const actionCard = screen.getByRole('button');
            fireEvent.click(actionCard);

            expect(mockNavigate).toHaveBeenCalledWith('/compliance?id=ctrl-123&tab=controls');
        });

        it('calls onActionClick callback when provided', () => {
            const onActionClick = vi.fn();
            const controls = [
                createControl({ id: 'ctrl-123', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} onActionClick={onActionClick} />);

            const actionCard = screen.getByRole('button');
            fireEvent.click(actionCard);

            expect(onActionClick).toHaveBeenCalledWith(controls[0]);
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    describe('criticality calculation', () => {
        it('assigns high criticality to A.5 controls', () => {
            const controls = [
                createControl({ id: '1', code: 'A.5.1', status: 'Non commencé' }),
                createControl({ id: '2', code: 'A.9.1', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} maxActions={1} />);

            // A.5 should be prioritized
            expect(screen.getByRole('button')).toHaveTextContent('A.5.1');
        });

        it('assigns high criticality to A.8 controls', () => {
            const controls = [
                createControl({ id: '1', code: 'A.8.1', status: 'Non commencé' }),
                createControl({ id: '2', code: 'A.9.1', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} maxActions={1} />);

            expect(screen.getByRole('button')).toHaveTextContent('A.8.1');
        });

        it('assigns high criticality to A.12 controls', () => {
            const controls = [
                createControl({ id: '1', code: 'A.12.1', status: 'Non commencé' }),
                createControl({ id: '2', code: 'A.9.1', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} maxActions={1} />);

            expect(screen.getByRole('button')).toHaveTextContent('A.12.1');
        });

        it('assigns medium criticality to A.6 controls', () => {
            const controls = [
                createControl({ id: '1', code: 'A.6.1', status: 'Non commencé' }),
                createControl({ id: '2', code: 'A.9.1', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} maxActions={1} />);

            // A.6 (medium) should be prioritized over A.9 (low)
            expect(screen.getByRole('button')).toHaveTextContent('A.6.1');
        });

        it('assigns high criticality to NIS2 incident controls', () => {
            const controls = [
                createControl({
                    id: '1',
                    code: 'NIS2-1',
                    name: 'Incident Response Plan',
                    framework: 'NIS2',
                    status: 'Non commencé'
                }),
                createControl({
                    id: '2',
                    code: 'A.9.1',
                    name: 'Generic Control',
                    status: 'Non commencé'
                }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} maxActions={1} />);

            expect(screen.getByRole('button')).toHaveTextContent('Incident Response Plan');
        });
    });

    describe('filtering implemented controls', () => {
        it('excludes fully implemented controls with evidence', () => {
            const controls = [
                createControl({
                    id: '1',
                    status: 'Implémenté',
                    evidenceIds: ['ev-1', 'ev-2']
                }),
                createControl({
                    id: '2',
                    status: 'Non commencé'
                }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            const actionCards = screen.getAllByRole('button');
            expect(actionCards).toHaveLength(1);
        });

        it('includes implemented controls without evidence', () => {
            const controls = [
                createControl({
                    id: '1',
                    status: 'Implémenté',
                    evidenceIds: []
                }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            expect(screen.getByText('Ajouter preuves')).toBeInTheDocument();
        });
    });

    describe('potential improvement display', () => {
        it('displays potential improvement percentage', () => {
            const controls = [
                createControl({ id: '1', code: 'A.5.1', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} />);

            // Should show some percentage gain
            expect(screen.getByText(/\+\d+%/)).toBeInTheDocument();
            expect(screen.getByText('gain potentiel')).toBeInTheDocument();
        });
    });

    describe('priority numbering', () => {
        it('displays priority numbers starting from 1', () => {
            const controls = [
                createControl({ id: '1', code: 'A.5.1', status: 'Non commencé' }),
                createControl({ id: '2', code: 'A.5.2', status: 'Non commencé' }),
                createControl({ id: '3', code: 'A.5.3', status: 'Non commencé' }),
            ];
            renderWithRouter(<PriorityActionsList controls={controls} maxActions={3} />);

            expect(screen.getByText('#1')).toBeInTheDocument();
            expect(screen.getByText('#2')).toBeInTheDocument();
            expect(screen.getByText('#3')).toBeInTheDocument();
        });
    });

    describe('className prop', () => {
        it('applies custom className', () => {
            const controls = [createControl()];
            const { container } = renderWithRouter(
                <PriorityActionsList controls={controls} className="custom-class" />
            );

            expect(container.firstChild).toHaveClass('custom-class');
        });
    });
});
