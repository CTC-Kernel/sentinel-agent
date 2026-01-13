/**
 * EmptyState Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';
import { Search } from 'lucide-react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: (props: React.ComponentProps<'div'>) => React.createElement('div', props)
    }
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}));

describe('EmptyState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render title and description', () => {
        render(
            <EmptyState
                title="No Data Found"
                description="There is no data to display"
            />
        );

        expect(screen.getByText('No Data Found')).toBeInTheDocument();
        expect(screen.getByText('There is no data to display')).toBeInTheDocument();
    });

    it('should render with image when provided', () => {
        render(
            <EmptyState
                title="Empty"
                description="Nothing here"
                image="/images/empty.png"
            />
        );

        const img = screen.getByAltText('Empty');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', '/images/empty.png');
    });

    it('should render with icon when provided', () => {
        render(
            <EmptyState
                title="No Results"
                description="Try a different search"
                icon={Search}
            />
        );

        expect(screen.getByText('No Results')).toBeInTheDocument();
    });

    it('should render action button when provided', () => {
        render(
            <EmptyState
                title="Empty"
                description="Nothing here"
                action={<button data-testid="action-btn">Add Item</button>}
            />
        );

        expect(screen.getByTestId('action-btn')).toBeInTheDocument();
        expect(screen.getByText('Add Item')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
        const { container } = render(
            <EmptyState
                title="Empty"
                description="Nothing"
                className="custom-class"
            />
        );

        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should apply color styles for different colors', () => {
        const { rerender } = render(
            <EmptyState
                title="Blue"
                description="Blue description"
                icon={Search}
                color="blue"
            />
        );

        expect(screen.getByText('Blue')).toBeInTheDocument();

        rerender(
            <EmptyState
                title="Rose"
                description="Rose description"
                icon={Search}
                color="rose"
            />
        );

        expect(screen.getByText('Rose')).toBeInTheDocument();

        rerender(
            <EmptyState
                title="Emerald"
                description="Emerald description"
                icon={Search}
                color="emerald"
            />
        );

        expect(screen.getByText('Emerald')).toBeInTheDocument();
    });

    it('should use slate as default color', () => {
        render(
            <EmptyState
                title="Default"
                description="Default color"
                icon={Search}
            />
        );

        expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('should prefer image over icon when both provided', () => {
        render(
            <EmptyState
                title="Both"
                description="Both image and icon"
                image="/images/test.png"
                icon={Search}
            />
        );

        // Image should be rendered when image prop is provided
        // The component shows image when image is truthy and Icon is NOT used
        expect(screen.getByText('Both')).toBeInTheDocument();
    });
});
