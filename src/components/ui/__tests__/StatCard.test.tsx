/**
 * StatCard Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatCard } from '../StatCard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, onClick, onKeyDown, tabIndex, role, ...props }: React.ComponentProps<'div'>) =>
            React.createElement('div', { onClick, onKeyDown, tabIndex, role, ...props }, children)
    }
}));

// Mock Icons
vi.mock('../Icons', () => ({
    TrendingUp: (props: React.ComponentProps<'svg'>) => React.createElement('svg', { ...props, 'data-testid': 'trending-up' }),
    TrendingDown: (props: React.ComponentProps<'svg'>) => React.createElement('svg', { ...props, 'data-testid': 'trending-down' }),
    Minus: (props: React.ComponentProps<'svg'>) => React.createElement('svg', { ...props, 'data-testid': 'minus' })
}));

// Mock cn utility
vi.mock('../../../lib/utils', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}));

// Mock icon component
const MockIcon = (props: React.ComponentProps<'svg'>) =>
    React.createElement('svg', { ...props, 'data-testid': 'mock-icon' });

describe('StatCard', () => {
    const defaultProps = {
        title: 'Total Users',
        value: 1250,
        icon: MockIcon,
        colorClass: 'bg-brand-500'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render title and value', () => {
        render(<StatCard {...defaultProps} />);

        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('1250')).toBeInTheDocument();
    });

    it('should render icon', () => {
        render(<StatCard {...defaultProps} />);

        expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });

    it('should render string value', () => {
        render(<StatCard {...defaultProps} value="$1,250" />);

        expect(screen.getByText('$1,250')).toBeInTheDocument();
    });

    it('should show loading state', () => {
        const { container } = render(<StatCard {...defaultProps} loading={true} />);

        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
        expect(screen.queryByText('1250')).not.toBeInTheDocument();
    });

    it('should render positive trend', () => {
        render(
            <StatCard
                {...defaultProps}
                trend={{ value: 15, label: 'vs last month' }}
            />
        );

        expect(screen.getByTestId('trending-up')).toBeInTheDocument();
        expect(screen.getByText(/15%/)).toBeInTheDocument();
        expect(screen.getByText(/vs last month/)).toBeInTheDocument();
    });

    it('should render negative trend', () => {
        render(
            <StatCard
                {...defaultProps}
                trend={{ value: -10, label: 'vs last month' }}
            />
        );

        expect(screen.getByTestId('trending-down')).toBeInTheDocument();
        expect(screen.getByText(/10%/)).toBeInTheDocument();
    });

    it('should render neutral trend (zero)', () => {
        render(
            <StatCard
                {...defaultProps}
                trend={{ value: 0, label: 'vs last month' }}
            />
        );

        expect(screen.getByTestId('minus')).toBeInTheDocument();
    });

    it('should be clickable when onClick is provided', () => {
        const mockOnClick = vi.fn();
        render(<StatCard {...defaultProps} onClick={mockOnClick} />);

        fireEvent.click(screen.getByRole('button'));
        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard events when interactive', () => {
        const mockOnClick = vi.fn();
        render(<StatCard {...defaultProps} onClick={mockOnClick} />);

        const card = screen.getByRole('button');

        fireEvent.keyDown(card, { key: 'Enter' });
        expect(mockOnClick).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(card, { key: ' ' });
        expect(mockOnClick).toHaveBeenCalledTimes(2);
    });

    it('should not trigger onClick on other keys', () => {
        const mockOnClick = vi.fn();
        render(<StatCard {...defaultProps} onClick={mockOnClick} />);

        const card = screen.getByRole('button');
        fireEvent.keyDown(card, { key: 'Tab' });

        expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should use custom ariaLabel', () => {
        render(
            <StatCard
                {...defaultProps}
                onClick={() => {}}
                ariaLabel="View user statistics"
            />
        );

        expect(screen.getByLabelText('View user statistics')).toBeInTheDocument();
    });

    it('should use default aria label when not provided', () => {
        render(<StatCard {...defaultProps} onClick={() => {}} />);

        expect(screen.getByLabelText(/Voir les détails: Total Users/)).toBeInTheDocument();
    });

    it('should not be interactive when onClick is not provided', () => {
        const { container } = render(<StatCard {...defaultProps} />);

        expect(container.querySelector('[role="button"]')).not.toBeInTheDocument();
    });

    it('should render sparkline when data is provided', () => {
        const { container } = render(
            <StatCard
                {...defaultProps}
                sparklineData={[10, 20, 15, 25, 30]}
            />
        );

        // Sparkline container should have bars
        const sparklineBars = container.querySelectorAll('.flex-1.rounded-t');
        expect(sparklineBars.length).toBe(5);
    });

    it('should not render sparkline when data is empty', () => {
        const { container } = render(
            <StatCard
                {...defaultProps}
                sparklineData={[]}
            />
        );

        const sparklineBars = container.querySelectorAll('.flex-1.rounded-t');
        expect(sparklineBars.length).toBe(0);
    });

    it('should not render sparkline when not provided', () => {
        const { container } = render(<StatCard {...defaultProps} />);

        const sparklineContainer = container.querySelector('.mt-4.h-8');
        expect(sparklineContainer).not.toBeInTheDocument();
    });
});
