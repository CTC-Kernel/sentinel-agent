/**
 * Unit tests for ProcessGeneralDetails component
 * Tests process detail display with RTO/RPO metrics
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessGeneralDetails } from '../ProcessGeneralDetails';
import { BusinessProcess } from '../../../../types';

// Mock store
vi.mock('../../../../store', () => ({
    useStore: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'continuity.rto': 'RTO',
                'continuity.rpo': 'RPO',
                'common.description': 'Description',
                'continuity.recoveryPlan': 'Plan de reprise',
                'continuity.noSteps': 'Aucune étape définie'
            };
            return translations[key] || key;
        }
    })
}));

// Mock Badge
vi.mock('../../../ui/Badge', () => ({
    Badge: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="badge">{children}</span>
    )
}));

describe('ProcessGeneralDetails', () => {
    const mockProcess: BusinessProcess = {
        id: 'proc-1',
        organizationId: 'org-1',
        name: 'Payment Processing',
        description: 'Critical payment processing workflow that handles all customer transactions.',
        priority: 'Critique',
        rto: '4h',
        rpo: '1h',
        owner: 'user-1',
        supportingAssetIds: ['db-1', 'service-1'],
        recoveryTasks: [
            { id: 'task-1', title: 'Notify stakeholders', owner: 'Manager', duration: '15 min', order: 1 },
            { id: 'task-2', title: 'Activate backup systems', owner: 'IT Lead', duration: '30 min', order: 2 },
            { id: 'task-3', title: 'Verify data integrity', owner: 'DBA', duration: '1 hour', order: 3 }
        ]
    };

    const processWithoutTasks: BusinessProcess = {
        ...mockProcess,
        recoveryTasks: []
    };

    describe('RTO/RPO metrics', () => {
        it('renders RTO label', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('RTO')).toBeInTheDocument();
        });

        it('renders RPO label', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('RPO')).toBeInTheDocument();
        });

        it('displays RTO value', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('4h')).toBeInTheDocument();
        });

        it('displays RPO value', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('1h')).toBeInTheDocument();
        });
    });

    describe('description section', () => {
        it('renders description header', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('Description')).toBeInTheDocument();
        });

        it('displays process description', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('Critical payment processing workflow that handles all customer transactions.')).toBeInTheDocument();
        });
    });

    describe('recovery tasks', () => {
        it('renders recovery plan header', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('Plan de reprise')).toBeInTheDocument();
        });

        it('displays all recovery tasks', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('Notify stakeholders')).toBeInTheDocument();
            expect(screen.getByText('Activate backup systems')).toBeInTheDocument();
            expect(screen.getByText('Verify data integrity')).toBeInTheDocument();
        });

        it('shows task owners', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('Resp: Manager')).toBeInTheDocument();
            expect(screen.getByText('Resp: IT Lead')).toBeInTheDocument();
            expect(screen.getByText('Resp: DBA')).toBeInTheDocument();
        });

        it('shows task durations', () => {
            render(<ProcessGeneralDetails process={mockProcess} />);

            expect(screen.getByText('15 min')).toBeInTheDocument();
            expect(screen.getByText('30 min')).toBeInTheDocument();
            expect(screen.getByText('1 hour')).toBeInTheDocument();
        });

        it('displays numbered task steps', () => {
            const { container } = render(<ProcessGeneralDetails process={mockProcess} />);

            // Task step numbers are displayed in rounded divs
            const stepNumbers = container.querySelectorAll('.rounded-full');
            expect(stepNumbers.length).toBeGreaterThanOrEqual(3);
        });

        it('shows empty message when no tasks', () => {
            render(<ProcessGeneralDetails process={processWithoutTasks} />);

            expect(screen.getByText('Aucune étape définie')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has glass-panel containers', () => {
            const { container } = render(<ProcessGeneralDetails process={mockProcess} />);

            // Multiple glass-panel containers for description and recovery plan
            expect(container.querySelectorAll('.glass-panel').length).toBe(2);
        });

        it('has metric cards with rounded styling', () => {
            const { container } = render(<ProcessGeneralDetails process={mockProcess} />);

            expect(container.querySelector('[class*="rounded-\\[2rem\\]"]')).toBeInTheDocument();
        });
    });
});
