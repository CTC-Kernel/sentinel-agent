/**
 * Unit tests for RiskKPICard component
 * Tests risk KPI card display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskKPICard } from '../RiskKPICard';
import { AlertTriangle } from '../../../ui/Icons';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>
    }
}));

describe('RiskKPICard', () => {
    const defaultProps = {
        title: 'Critical Risks',
        value: 15,
        subtext: 'Active high priority',
        icon: AlertTriangle,
        color: 'red' as const
    };

    describe('rendering', () => {
        it('renders value', () => {
            render(<RiskKPICard {...defaultProps} />);

            expect(screen.getByText('15')).toBeInTheDocument();
        });

        it('renders subtext', () => {
            render(<RiskKPICard {...defaultProps} />);

            expect(screen.getByText('Active high priority')).toBeInTheDocument();
        });

        it('renders string value', () => {
            render(<RiskKPICard {...defaultProps} value="45%" />);

            expect(screen.getByText('45%')).toBeInTheDocument();
        });
    });

    describe('color variants', () => {
        it('applies red color styles', () => {
            const { container } = render(<RiskKPICard {...defaultProps} color="red" />);

            expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
        });

        it('applies orange color styles', () => {
            const { container } = render(<RiskKPICard {...defaultProps} color="orange" />);

            expect(container.querySelector('.bg-orange-50')).toBeInTheDocument();
        });

        it('applies blue color styles', () => {
            const { container } = render(<RiskKPICard {...defaultProps} color="blue" />);

            expect(container.querySelector('.bg-blue-50')).toBeInTheDocument();
        });

        it('applies purple color styles', () => {
            const { container } = render(<RiskKPICard {...defaultProps} color="purple" />);

            expect(container.querySelector('.bg-purple-50')).toBeInTheDocument();
        });

        it('applies emerald color styles', () => {
            const { container } = render(<RiskKPICard {...defaultProps} color="emerald" />);

            expect(container.querySelector('.bg-emerald-50')).toBeInTheDocument();
        });
    });

    describe('chip', () => {
        it('renders chip when provided', () => {
            render(<RiskKPICard {...defaultProps} chip={{ label: '+5%', color: 'emerald' }} />);

            expect(screen.getByText('+5%')).toBeInTheDocument();
        });

        it('does not render chip when not provided', () => {
            render(<RiskKPICard {...defaultProps} />);

            expect(screen.queryByText('+5%')).not.toBeInTheDocument();
        });

        it('applies emerald chip color', () => {
            render(<RiskKPICard {...defaultProps} chip={{ label: 'Good', color: 'emerald' }} />);

            const chip = screen.getByText('Good');
            expect(chip).toHaveClass('text-emerald-500');
        });
    });

    describe('different values', () => {
        it('renders zero value', () => {
            render(<RiskKPICard {...defaultProps} value={0} />);

            expect(screen.getByText('0')).toBeInTheDocument();
        });

        it('renders large number value', () => {
            render(<RiskKPICard {...defaultProps} value={9999} />);

            expect(screen.getByText('9999')).toBeInTheDocument();
        });

        it('renders decimal string value', () => {
            render(<RiskKPICard {...defaultProps} value="12.5%" />);

            expect(screen.getByText('12.5%')).toBeInTheDocument();
        });
    });
});
