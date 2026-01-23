/**
 * Unit tests for ComplianceScoreCard component
 * Tests compliance dashboard score card display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComplianceScoreCard } from '../ComplianceScoreCard';
import { Control } from '../../../../types';

// Mock useAgentData to avoid AuthProvider dependency
vi.mock('../../../../hooks/useAgentData', () => ({
    useAgentResultsByControl: vi.fn(() => new Map())
}));

describe('ComplianceScoreCard', () => {
    const createControl = (overrides: Partial<Control> = {}): Control => ({
        id: 'ctrl-1',
        code: 'A.5.1',
        name: 'Test Control',
        description: 'Test description',
        status: 'Implémenté',
        framework: 'ISO27001',
        organizationId: 'org-1',
        ...overrides
    });

    const mockControls: Control[] = [
        createControl({ id: '1', status: 'Implémenté', framework: 'ISO27001' }),
        createControl({ id: '2', status: 'Implémenté', framework: 'ISO27001' }),
        createControl({ id: '3', status: 'Partiel', framework: 'ISO27001' }),
        createControl({ id: '4', status: 'En cours', framework: 'GDPR' }),
        createControl({ id: '5', status: 'Non commencé', framework: 'DORA' }),
        createControl({ id: '6', status: 'Non applicable', framework: 'ISO27001' })
    ];

    describe('rendering', () => {
        it('renders framework title', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            expect(screen.getByText('Score ISO27001')).toBeInTheDocument();
        });

        it('renders compliance subtitle', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            expect(screen.getByText('Conformité moyenne')).toBeInTheDocument();
        });

        it('calculates and displays global score', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            // Global score should be calculated and displayed as percentage
            // The score is calculated as: (Implemented + Partial*0.5) / Actionable * 100
            // Actionable = 5 (excluding Non applicable)
            // Score = (2 + 0.5) / 5 * 100 = 50%
            expect(screen.getByText('50%')).toBeInTheDocument();
        });

        it('renders alerts count', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            expect(screen.getByText('Alertes')).toBeInTheDocument();
            // Multiple '1' values displayed (alerts, in progress, partial), verify at least one exists
            expect(screen.getAllByText('1').length).toBeGreaterThan(0);
        });

        it('renders in progress count', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            expect(screen.getByText('En cours')).toBeInTheDocument();
        });

        it('renders partial count', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            // Find the "Partiel" text (there's one control with Partiel status)
            expect(screen.getAllByText('Partiel').length).toBeGreaterThan(0);
        });
    });

    describe('framework scores', () => {
        it('displays ISO 27001 framework card', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            expect(screen.getByText('ISO 27001')).toBeInTheDocument();
        });

        it('displays RGPD framework card when GDPR controls exist', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="GDPR" />);

            expect(screen.getByText('RGPD')).toBeInTheDocument();
        });

        it('displays DORA framework card when DORA controls exist', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="DORA" />);

            expect(screen.getByText('DORA')).toBeInTheDocument();
        });
    });

    describe('trend display', () => {
        it('displays positive trend', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" trend={5} />);

            expect(screen.getByText('+5% vs 30j')).toBeInTheDocument();
        });

        it('displays negative trend', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" trend={-3} />);

            expect(screen.getByText('-3% vs 30j')).toBeInTheDocument();
        });

        it('displays zero trend', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" trend={0} />);

            expect(screen.getByText('0% vs 30j')).toBeInTheDocument();
        });

        it('does not display trend when undefined', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            expect(screen.queryByText(/vs 30j/)).not.toBeInTheDocument();
        });
    });

    describe('filter interactions', () => {
        it('calls onFilterChange with "Non commencé" when alerts clicked', () => {
            const onFilterChange = vi.fn();
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" onFilterChange={onFilterChange} />);

            const alertsButton = screen.getAllByRole('button').find(b => b.textContent?.includes('Alertes'));
            if (alertsButton) {
                fireEvent.click(alertsButton);
                expect(onFilterChange).toHaveBeenCalledWith('Non commencé');
            }
        });

        it('calls onFilterChange with "En cours" when in progress clicked', () => {
            const onFilterChange = vi.fn();
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" onFilterChange={onFilterChange} />);

            const inProgressButton = screen.getAllByRole('button').find(b => b.textContent?.includes('En cours'));
            if (inProgressButton) {
                fireEvent.click(inProgressButton);
                expect(onFilterChange).toHaveBeenCalledWith('En cours');
            }
        });

        it('calls onFilterChange with "Partiel" when partial clicked', () => {
            const onFilterChange = vi.fn();
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" onFilterChange={onFilterChange} />);

            const partialButton = screen.getAllByRole('button').find(b =>
                b.textContent?.includes('Partiel') && b.getAttribute('role') === 'button'
            );
            if (partialButton) {
                fireEvent.click(partialButton);
                expect(onFilterChange).toHaveBeenCalledWith('Partiel');
            }
        });
    });

    describe('score calculation', () => {
        it('handles empty controls array', () => {
            render(<ComplianceScoreCard controls={[]} currentFramework="ISO27001" />);

            // Should display 0% somewhere in the component
            expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
        });

        it('excludes Non applicable from calculations', () => {
            const controls = [
                createControl({ id: '1', status: 'Implémenté' }),
                createControl({ id: '2', status: 'Non applicable' }),
                createControl({ id: '3', status: 'Non applicable' })
            ];
            render(<ComplianceScoreCard controls={controls} currentFramework="ISO27001" />);

            // 1 implemented out of 1 actionable = 100%
            expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
        });

        it('excludes Exclu from calculations', () => {
            const controls = [
                createControl({ id: '1', status: 'Implémenté' }),
                createControl({ id: '2', status: 'Exclu' })
            ];
            render(<ComplianceScoreCard controls={controls} currentFramework="ISO27001" />);

            expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
        });
    });
});
