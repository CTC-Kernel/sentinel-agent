/**
 * Unit tests for ReportConfigurationModal component
 * Tests report configuration modal interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportConfigurationModal } from '../ReportConfigurationModal';

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
    const Transition = ({ children, show }: { children: React.ReactNode; show?: boolean }) => (
        show ? <>{children}</> : null
    );
    Transition.Root = Transition;
    Transition.Child = ({ children }: { children: React.ReactNode }) => <>{children}</>;
    return { Dialog, Transition };
});

describe('ReportConfigurationModal', () => {
    const mockOnClose = vi.fn();
    const mockOnGenerate = vi.fn();

    const defaultProps = {
        isOpen: true,
        onClose: mockOnClose,
        onGenerate: mockOnGenerate
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when closed', () => {
        it('does not render when isOpen is false', () => {
            render(<ReportConfigurationModal {...defaultProps} isOpen={false} />);

            expect(screen.queryByText('Configuration du Rapport')).not.toBeInTheDocument();
        });
    });

    describe('when open', () => {
        it('renders modal title', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            expect(screen.getByText('Configuration du Rapport')).toBeInTheDocument();
        });

        it('renders title input', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            expect(screen.getByText('Titre du rapport')).toBeInTheDocument();
        });

        it('renders default title value', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            const input = screen.getByDisplayValue('Rapport Exécutif Global');
            expect(input).toBeInTheDocument();
        });

        it('renders custom default title', () => {
            render(<ReportConfigurationModal {...defaultProps} defaultTitle="Custom Title" />);

            expect(screen.getByDisplayValue('Custom Title')).toBeInTheDocument();
        });
    });

    describe('section toggles', () => {
        it('renders Risques Cyber section', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            expect(screen.getByText('Risques Cyber')).toBeInTheDocument();
        });

        it('renders Conformité section', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            expect(screen.getByText('Conformité & Contrôles')).toBeInTheDocument();
        });

        it('renders Projets section', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            expect(screen.getByText('Projets & Audits')).toBeInTheDocument();
        });

        it('renders Incidents section', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            expect(screen.getByText('Incidents')).toBeInTheDocument();
        });

        it('toggles section when clicked', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            // Initially all sections are active (have specific border color)
            const risksButton = screen.getByText('Risques Cyber').closest('button');
            expect(risksButton).toHaveClass('border-red-2000');

            // Click to toggle
            if (risksButton) fireEvent.click(risksButton);

            // Should now be inactive
            expect(risksButton).not.toHaveClass('border-red-2000');
        });
    });

    describe('buttons', () => {
        it('renders cancel button', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            expect(screen.getByText('Annuler')).toBeInTheDocument();
        });

        it('renders generate button', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            expect(screen.getByText('Générer le rapport')).toBeInTheDocument();
        });

        it('calls onClose when cancel clicked', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Annuler'));

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('calls onGenerate with config when generate clicked', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Générer le rapport'));

            expect(mockOnGenerate).toHaveBeenCalledWith({
                title: 'Rapport Exécutif Global',
                includeRisks: true,
                includeCompliance: true,
                includeAudits: true,
                includeProjects: true,
                includeIncidents: true
            });
        });

        it('calls onClose after generate', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Générer le rapport'));

            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    describe('title input', () => {
        it('updates title when typed', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            const input = screen.getByDisplayValue('Rapport Exécutif Global');
            fireEvent.change(input, { target: { value: 'New Title' } });

            expect(screen.getByDisplayValue('New Title')).toBeInTheDocument();
        });

        it('includes updated title in generate config', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            const input = screen.getByDisplayValue('Rapport Exécutif Global');
            fireEvent.change(input, { target: { value: 'Custom Report' } });
            fireEvent.click(screen.getByText('Générer le rapport'));

            expect(mockOnGenerate).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Custom Report'
                })
            );
        });
    });

    describe('section configuration', () => {
        it('includes toggled sections in generate config', () => {
            render(<ReportConfigurationModal {...defaultProps} />);

            // Toggle off Risques
            const risksButton = screen.getByText('Risques Cyber').closest('button');
            if (risksButton) fireEvent.click(risksButton);

            fireEvent.click(screen.getByText('Générer le rapport'));

            expect(mockOnGenerate).toHaveBeenCalledWith(
                expect.objectContaining({
                    includeRisks: false
                })
            );
        });
    });
});
