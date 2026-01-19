/**
 * Breadcrumbs Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from '../Breadcrumbs';

// Mock lucide-react - must be before any imports that use it
vi.mock('lucide-react', () => {
    const Icon = ({ className, ...props }: React.ComponentProps<'svg'>) => React.createElement('span', { className: `icon ${className}`, ...props });
    return {
        ChevronRight: ({ className, ...props }: React.ComponentProps<'svg'>) => React.createElement('span', { className: `icon ${className}`, 'data-testid': 'chevron-right', ...props }),
        Home: ({ className, ...props }: React.ComponentProps<'svg'>) => React.createElement('span', { className: `icon ${className}`, 'data-testid': 'home-icon', ...props }),
        Settings: Icon,
        Grid3X3: Icon,
        LockOpen: Icon,
        Unlock: Icon,
    };
});

const renderWithRouter = (initialRoute: string) => {
    return render(
        React.createElement(MemoryRouter, { initialEntries: [initialRoute], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
            React.createElement(Breadcrumbs)
        )
    );
};

describe('Breadcrumbs', () => {
    it('should not render on home page', () => {
        const { container } = renderWithRouter('/');
        expect(container.innerHTML).toBe('');
    });

    it('should render breadcrumb for single path', () => {
        renderWithRouter('/assets');
        expect(screen.getByText('Actifs')).toBeInTheDocument();
    });

    it('should render home icon link', () => {
        renderWithRouter('/assets');
        expect(screen.getByTestId('home-icon')).toBeInTheDocument();
    });

    it('should use French translations for known routes', () => {
        renderWithRouter('/risks');
        expect(screen.getByText('Risques')).toBeInTheDocument();
    });

    it('should render controls route correctly', () => {
        renderWithRouter('/compliance');
        expect(screen.getByText('Conformité')).toBeInTheDocument();
    });

    it('should render nested paths', () => {
        renderWithRouter('/projects/123');
        expect(screen.getByText('Projets')).toBeInTheDocument();
        // The ID is shown as "Détails" when too long or capitalized
        expect(screen.getByText('123')).toBeInTheDocument();
    });

    it('should mark last item as current page', () => {
        renderWithRouter('/assets');
        const lastItem = screen.getByText('Actifs');
        expect(lastItem).toHaveAttribute('aria-current', 'page');
    });

    it('should have proper aria-label', () => {
        renderWithRouter('/assets');
        expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Breadcrumb');
    });

    it('should capitalize unknown routes', () => {
        renderWithRouter('/custom');
        expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('should show Détails for long IDs', () => {
        renderWithRouter('/projects/a-very-long-id-that-is-over-20-chars');
        expect(screen.getByText('Détails')).toBeInTheDocument();
    });

    it('should have screen reader text for home link', () => {
        renderWithRouter('/assets');
        expect(screen.getByText('Accueil')).toBeInTheDocument();
        expect(screen.getByText('Accueil')).toHaveClass('sr-only');
    });

    it('should render chevron separators', () => {
        renderWithRouter('/projects/123');
        const chevrons = screen.getAllByTestId('chevron-right');
        expect(chevrons.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple known routes', () => {
        // Note: This would depend on actual routing structure
        renderWithRouter('/settings');
        expect(screen.getByText('Paramètres')).toBeInTheDocument();
    });
});
