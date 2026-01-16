/**
 * Unit tests for IncidentStats component
 * Tests incident statistics display cards
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncidentStats } from '../IncidentStats';

// Mock Icons
vi.mock('../../ui/Icons', () => ({
    ShieldAlert: () => <span data-testid="shield-alert-icon" />,
    Clock: () => <span data-testid="clock-icon" />,
    AlertTriangle: () => <span data-testid="alert-triangle-icon" />
}));

// Mock Skeleton
vi.mock('../../ui/Skeleton', () => ({
    Skeleton: ({ className }: { className?: string }) => (
        <div data-testid="skeleton" className={className} />
    ),
    CardSkeleton: ({ count, className }: { count: number; className?: string }) => (
        <div data-testid="card-skeleton" data-count={count} className={className} />
    )
}));

// Mock store
vi.mock('../../../store', () => ({
    useStore: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'incidents.activeIncidents': 'incidents actifs',
                'incidents.toTreat': 'à traiter',
                'incidents.avgDelay': 'délai moyen',
                'incidents.volumeTotal': 'du volume total'
            };
            return translations[key] || key;
        }
    })
}));

describe('IncidentStats', () => {
    const mockStats = {
        open: 12,
        avgMttrHours: 4,
        criticalRatio: 25
    };

    const statsWithNulls = {
        open: 0,
        avgMttrHours: null,
        criticalRatio: null
    };

    const defaultProps = {
        stats: mockStats,
        loading: false
    };

    describe('loading state', () => {
        it('shows skeletons when loading', () => {
            render(<IncidentStats stats={mockStats} loading={true} />);

            expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
        });

        it('shows card skeletons when loading', () => {
            render(<IncidentStats stats={mockStats} loading={true} />);

            expect(screen.getAllByTestId('card-skeleton').length).toBe(3);
        });

        it('hides stats when loading', () => {
            render(<IncidentStats stats={mockStats} loading={true} />);

            expect(screen.queryByText('12')).not.toBeInTheDocument();
        });
    });

    describe('stats display', () => {
        it('renders global view header', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('Vue globale des incidents')).toBeInTheDocument();
        });

        it('displays open incidents count in header', () => {
            render(<IncidentStats {...defaultProps} />);

            // Main header shows the count
            expect(screen.getAllByText('12').length).toBeGreaterThan(0);
        });

        it('displays active incidents label', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('incidents actifs')).toBeInTheDocument();
        });
    });

    describe('active incidents card', () => {
        it('renders Actifs label', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('Actifs')).toBeInTheDocument();
        });

        it('displays open count in card', () => {
            render(<IncidentStats {...defaultProps} />);

            // Card shows 12
            expect(screen.getAllByText('12').length).toBeGreaterThan(0);
        });

        it('shows toTreat label', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('à traiter')).toBeInTheDocument();
        });

        it('renders shield alert icon', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByTestId('shield-alert-icon')).toBeInTheDocument();
        });
    });

    describe('MTTR card', () => {
        it('renders MTTR label', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('MTTR')).toBeInTheDocument();
        });

        it('displays MTTR value with hours suffix', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('4h')).toBeInTheDocument();
        });

        it('shows average delay label', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('délai moyen')).toBeInTheDocument();
        });

        it('shows dash when MTTR is null', () => {
            render(<IncidentStats stats={statsWithNulls} loading={false} />);

            // Should show dash instead of value
            expect(screen.getAllByText('-').length).toBeGreaterThan(0);
        });

        it('renders clock icon', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
        });
    });

    describe('critical ratio card', () => {
        it('renders Critiques label', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('Critiques')).toBeInTheDocument();
        });

        it('displays critical ratio with percent', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('25%')).toBeInTheDocument();
        });

        it('shows volume total label', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByText('du volume total')).toBeInTheDocument();
        });

        it('shows dash when critical ratio is null', () => {
            render(<IncidentStats stats={statsWithNulls} loading={false} />);

            // At least two dashes (MTTR and critical ratio)
            expect(screen.getAllByText('-').length).toBe(2);
        });

        it('renders alert triangle icon', () => {
            render(<IncidentStats {...defaultProps} />);

            expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has glass-premium container', () => {
            const { container } = render(<IncidentStats {...defaultProps} />);

            expect(container.querySelector('.glass-premium')).toBeInTheDocument();
        });

        it('has animated pulse indicator', () => {
            const { container } = render(<IncidentStats {...defaultProps} />);

            expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
        });

        it('has card styling with hover effects', () => {
            const { container } = render(<IncidentStats {...defaultProps} />);

            expect(container.querySelector('.hover\\:scale-\\[1\\.02\\]')).toBeInTheDocument();
        });
    });
});
