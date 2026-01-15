/**
 * Unit tests for DashboardSkeleton component
 * Tests skeleton loading state for dashboard
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardSkeleton } from '../DashboardSkeleton';

// Mock Skeleton components
vi.mock('../../ui/Skeleton', () => ({
    Skeleton: ({ className, variant }: { className?: string; variant?: string }) => (
        <div
            data-testid="skeleton"
            data-variant={variant}
            className={className}
        />
    ),
    CardSkeleton: ({ count }: { count: number }) => (
        <div data-testid="card-skeleton" data-count={count}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} data-testid={`card-${i}`} />
            ))}
        </div>
    )
}));

describe('DashboardSkeleton', () => {
    describe('rendering', () => {
        it('renders skeleton component', () => {
            render(<DashboardSkeleton />);

            expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
        });

        it('renders card skeletons', () => {
            render(<DashboardSkeleton />);

            expect(screen.getAllByTestId('card-skeleton').length).toBeGreaterThan(0);
        });

        it('has animation class', () => {
            const { container } = render(<DashboardSkeleton />);

            expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
        });
    });

    describe('layout structure', () => {
        it('renders stats grid', () => {
            const { container } = render(<DashboardSkeleton />);

            // Grid for quick stats
            expect(container.querySelector('.grid')).toBeInTheDocument();
        });

        it('renders multiple grid columns', () => {
            const { container } = render(<DashboardSkeleton />);

            expect(container.querySelector('.lg\\:grid-cols-4')).toBeInTheDocument();
        });

        it('renders 4 stat panels', () => {
            const { container } = render(<DashboardSkeleton />);

            const panels = container.querySelectorAll('.glass-panel');
            expect(panels.length).toBe(4);
        });
    });

    describe('quick actions section', () => {
        it('renders quick actions area', () => {
            const { container } = render(<DashboardSkeleton />);

            // Quick actions container with height
            expect(container.querySelector('.h-24')).toBeInTheDocument();
        });
    });

    describe('main content area', () => {
        it('renders main content grid', () => {
            const { container } = render(<DashboardSkeleton />);

            expect(container.querySelector('.lg\\:grid-cols-3')).toBeInTheDocument();
        });

        it('renders content spanning 2 columns', () => {
            const { container } = render(<DashboardSkeleton />);

            expect(container.querySelector('.lg\\:col-span-2')).toBeInTheDocument();
        });
    });

    describe('skeleton shapes', () => {
        it('renders rounded skeletons', () => {
            const { container } = render(<DashboardSkeleton />);

            expect(container.querySelector('.rounded-3xl')).toBeInTheDocument();
        });

        it('renders skeleton with text variant', () => {
            render(<DashboardSkeleton />);

            const skeletons = screen.getAllByTestId('skeleton');
            const textVariant = skeletons.find(s => s.getAttribute('data-variant') === 'text');
            expect(textVariant).toBeDefined();
        });
    });
});
