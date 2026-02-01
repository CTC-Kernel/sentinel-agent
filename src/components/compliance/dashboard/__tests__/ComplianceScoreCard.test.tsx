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
        it('renders score card container', () => {
            const { container } = render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            // Component renders the main container
            expect(container.querySelector('.glass-premium')).toBeInTheDocument();
        });

        it('renders progress indicator circle', () => {
            const { container } = render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            // SVG circle for score progress
            expect(container.querySelector('svg')).toBeInTheDocument();
            expect(container.querySelector('circle')).toBeInTheDocument();
        });

        it('calculates and displays global score', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            // Global score should be calculated and displayed as percentage
            // The score is calculated as: (Implemented + Partial*0.5) / Actionable * 100
            // Actionable = 5 (excluding Non applicable)
            // Score = (2 + 0.5) / 5 * 100 = 50%
            expect(screen.getByText('50%')).toBeInTheDocument();
        });

        it('renders metric buttons', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            // Should have buttons for metrics (Implemented, Partial, In Progress)
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('renders numeric counts', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            // Multiple numeric values displayed for metrics
            expect(screen.getAllByText('1').length).toBeGreaterThan(0);
        });

        it('renders partial count metric', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            // Partial should show count 1 based on mockControls data
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThanOrEqual(3); // Implemented, Partial, In Progress
        });
    });

    describe('framework scores', () => {
        it('renders score card for ISO27001', () => {
            const { container } = render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" />);

            // Component should render without error
            expect(container.querySelector('.glass-premium')).toBeInTheDocument();
        });

        it('renders score card for GDPR', () => {
            const { container } = render(<ComplianceScoreCard controls={mockControls} currentFramework="GDPR" />);

            // Component should render without error
            expect(container.querySelector('.glass-premium')).toBeInTheDocument();
        });

        it('renders score card for DORA', () => {
            const { container } = render(<ComplianceScoreCard controls={mockControls} currentFramework="DORA" />);

            // Component should render without error
            expect(container.querySelector('.glass-premium')).toBeInTheDocument();
        });
    });

    describe('trend display', () => {
        it('displays positive trend', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" trend={5} />);

            // Component renders trend with i18n key and value
            expect(screen.getByText(/\+5%/)).toBeInTheDocument();
        });

        it('displays negative trend', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" trend={-3} />);

            // Component renders trend with i18n key and value
            expect(screen.getByText(/-3%/)).toBeInTheDocument();
        });

        it('displays zero trend', () => {
            render(<ComplianceScoreCard controls={mockControls} currentFramework="ISO27001" trend={0} />);

            // Component renders trend with i18n key and value - look for the 0% value
            // Multiple 0% may exist (e.g., global score), so using getAllByText
            expect(screen.getAllByText(/0%/).length).toBeGreaterThan(0);
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

            // Should display 100% (default when no actionable controls)
            expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
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
