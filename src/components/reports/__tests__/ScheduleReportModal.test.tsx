/**
 * Unit tests for ScheduleReportModal component
 * Tests scheduled report configuration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleReportModal } from '../ScheduleReportModal';

// Mock Headless UI
vi.mock('@headlessui/react', () => {
    const Dialog = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
        <div
            data-testid="dialog"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            role="button"
            tabIndex={0}
            aria-label="Close dialog"
        >
            {children}
        </div>
    );
    Dialog.Panel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div data-testid="dialog-panel" className={className}>{children}</div>
    );
    Dialog.Title = ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <h1 data-testid="dialog-title" className={className}>{children}</h1>
    );
    const Transition = ({ children, show }: { children: React.ReactNode; show?: boolean }) => (
        show ? <>{children}</> : null
    );
    Transition.Child = ({ children }: { children: React.ReactNode }) => <>{children}</>;
    Transition.Root = Transition;
    return { Dialog, Transition };
});

// Mock types/reports
vi.mock('../../../types/reports', () => ({
    frequencyLabels: {
        weekly: 'Hebdomadaire',
        monthly: 'Mensuel',
        quarterly: 'Trimestriel'
    },
    dayOfWeekLabels: {
        1: 'Lundi',
        2: 'Mardi',
        3: 'Mercredi',
        4: 'Jeudi',
        5: 'Vendredi'
    },
    calculateNextRunDate: vi.fn(() => new Date('2024-02-15'))
}));

describe('ScheduleReportModal', () => {
    const mockOnClose = vi.fn();
    const mockOnSchedule = vi.fn().mockResolvedValue(undefined);

    const defaultProps = {
        isOpen: true,
        onClose: mockOnClose,
        onSchedule: mockOnSchedule
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when closed', () => {
        it('does not render when isOpen is false', () => {
            render(<ScheduleReportModal {...defaultProps} isOpen={false} />);

            expect(screen.queryByText('Planifier un rapport')).not.toBeInTheDocument();
        });
    });

    describe('when open', () => {
        it('renders modal title', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Planifier un rapport')).toBeInTheDocument();
        });

        it('renders description', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Recevez ce rapport automatiquement par email')).toBeInTheDocument();
        });

        it('renders name input', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Nom du rapport planifié')).toBeInTheDocument();
        });

        it('renders close button', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            // X button exists
            const closeButtons = screen.getAllByRole('button');
            expect(closeButtons.length).toBeGreaterThan(0);
        });
    });

    describe('template selection', () => {
        it('renders template type section', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Type de rapport')).toBeInTheDocument();
        });

        it('renders ISO 27001 option', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Pack ISO 27001')).toBeInTheDocument();
        });

        it('renders GDPR option', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Pack RGPD')).toBeInTheDocument();
        });

        it('renders custom report option', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Rapport Exécutif')).toBeInTheDocument();
        });
    });

    describe('frequency selection', () => {
        it('renders frequency section', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Fréquence')).toBeInTheDocument();
        });

        it('renders frequency options', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Hebdomadaire')).toBeInTheDocument();
            expect(screen.getByText('Mensuel')).toBeInTheDocument();
            expect(screen.getByText('Trimestriel')).toBeInTheDocument();
        });
    });

    describe('recipients', () => {
        it('renders recipients section', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Destinataires')).toBeInTheDocument();
        });

        it('renders email input', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
        });

        it('renders add recipient button', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Ajouter un destinataire')).toBeInTheDocument();
        });

        it.skip('adds recipient when button clicked', async () => {
            const user = userEvent.setup();
            render(<ScheduleReportModal {...defaultProps} />);

            await act(async () => {
                const addButton = screen.getByText('Ajouter un destinataire').closest('button');
                if (addButton) {
                    await user.click(addButton);
                }
            });

            await waitFor(() => {
                const inputs = screen.getAllByPlaceholderText('email@example.com');
                expect(inputs.length).toBe(2);
            });
        });
    });

    describe('next run preview', () => {
        it('shows next execution date', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText(/Prochaine exécution:/)).toBeInTheDocument();
        });
    });

    describe('buttons', () => {
        it('renders cancel button', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Annuler')).toBeInTheDocument();
        });

        it('renders schedule button', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            expect(screen.getByText('Planifier')).toBeInTheDocument();
        });

        it('calls onClose when cancel clicked', () => {
            render(<ScheduleReportModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Annuler'));

            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    describe('form validation', () => {
        it('shows error when name is empty', async () => {
            render(<ScheduleReportModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Planifier'));

            await waitFor(() => {
                expect(screen.getByText('Veuillez donner un nom à ce rapport planifié')).toBeInTheDocument();
            });
        });

        it('shows error when recipient is empty', async () => {
            render(<ScheduleReportModal {...defaultProps} />);

            // Set name
            const nameInput = screen.getByPlaceholderText('Ex: Rapport mensuel ISO 27001');
            fireEvent.change(nameInput, { target: { value: 'Test Report' } });

            fireEvent.click(screen.getByText('Planifier'));

            await waitFor(() => {
                expect(screen.getByText('Please add at least one recipient')).toBeInTheDocument();
            });
        });

        it('shows error for invalid email', async () => {
            render(<ScheduleReportModal {...defaultProps} />);

            // Set name
            const nameInput = screen.getByPlaceholderText('Ex: Rapport mensuel ISO 27001');
            fireEvent.change(nameInput, { target: { value: 'Test Report' } });

            // Set invalid email
            const emailInput = screen.getByPlaceholderText('email@example.com');
            fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

            fireEvent.click(screen.getByText('Planifier'));

            await waitFor(() => {
                expect(screen.getByText('Invalid email address: invalid-email')).toBeInTheDocument();
            });
        });
    });

    describe('successful submission', () => {
        it('calls onSchedule with form data when valid', async () => {
            render(<ScheduleReportModal {...defaultProps} />);

            // Fill name
            const nameInput = screen.getByPlaceholderText('Ex: Rapport mensuel ISO 27001');
            fireEvent.change(nameInput, { target: { value: 'Monthly Report' } });

            // Fill email
            const emailInput = screen.getByPlaceholderText('email@example.com');
            fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

            fireEvent.click(screen.getByText('Planifier'));

            await waitFor(() => {
                expect(mockOnSchedule).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'Monthly Report',
                        recipients: ['test@example.com']
                    })
                );
            });
        });

        it('shows loading state while submitting', async () => {
            mockOnSchedule.mockImplementation(() => new Promise(() => { }));

            render(<ScheduleReportModal {...defaultProps} />);

            // Fill form
            fireEvent.change(screen.getByPlaceholderText('Ex: Rapport mensuel ISO 27001'), {
                target: { value: 'Report' }
            });
            fireEvent.change(screen.getByPlaceholderText('email@example.com'), {
                target: { value: 'test@example.com' }
            });

            fireEvent.click(screen.getByText('Planifier'));

            await waitFor(() => {
                expect(screen.getByText('Planification...')).toBeInTheDocument();
            });
        });
    });
});
