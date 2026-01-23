/**
 * RiskAdvancedFilters Component Tests
 * Story 3.5: Risk Register View - Advanced filtering
 * 
 * Updated to match current component implementation using CustomSelect with multi-select
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiskAdvancedFilters } from '../RiskAdvancedFilters';

describe('RiskAdvancedFilters', () => {
    const defaultProps = {
        statusFilter: [] as string[],
        onStatusFilterChange: vi.fn(),
        categoryFilter: [] as string[],
        onCategoryFilterChange: vi.fn(),
        criticalityFilter: [] as string[],
        onCriticalityFilterChange: vi.fn(),
        availableCategories: ['Technique', 'Organisationnel', 'Humain'],
        onClose: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render all filter dropdowns', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.getByText('Filtrer par statut')).toBeInTheDocument();
        expect(screen.getByText('Filtrer par criticité')).toBeInTheDocument();
        expect(screen.getByText('Filtrer par catégorie')).toBeInTheDocument();
    });

    it('should render header with close button', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.getByText('Filtres avancés')).toBeInTheDocument();
        expect(screen.getByLabelText('Fermer les filtres')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        fireEvent.click(screen.getByLabelText('Fermer les filtres'));
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should display status filter section with label', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.getByText('Filtrer par statut')).toBeInTheDocument();
    });

    it('should display criticality filter section with label', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.getByText('Filtrer par criticité')).toBeInTheDocument();
    });

    it('should display category filter section with label', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.getByText('Filtrer par catégorie')).toBeInTheDocument();
    });

    it('should render category filter even when no categories available (shows empty dropdown)', () => {
        render(<RiskAdvancedFilters {...defaultProps} availableCategories={[]} />);

        // Component still renders the category filter section
        expect(screen.getByText('Filtrer par catégorie')).toBeInTheDocument();
    });

    it('should show reset filters button when status filter is active', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                statusFilter={['Ouvert']}
            />
        );

        expect(screen.getByText('Réinitialiser tous les filtres')).toBeInTheDocument();
    });

    it('should show reset filters button when criticality filter is active', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                criticalityFilter={['Critique']}
            />
        );

        expect(screen.getByText('Réinitialiser tous les filtres')).toBeInTheDocument();
    });

    it('should show reset filters button when category filter is active', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                categoryFilter={['Technique']}
            />
        );

        expect(screen.getByText('Réinitialiser tous les filtres')).toBeInTheDocument();
    });

    it('should not show reset filters button when no filters are active', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.queryByText('Réinitialiser tous les filtres')).not.toBeInTheDocument();
    });

    it('should clear all filters when reset button is clicked', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                statusFilter={['Ouvert']}
                categoryFilter={['Technique']}
                criticalityFilter={['Élevé']}
            />
        );

        fireEvent.click(screen.getByText('Réinitialiser tous les filtres'));

        expect(defaultProps.onStatusFilterChange).toHaveBeenCalledWith([]);
        expect(defaultProps.onCategoryFilterChange).toHaveBeenCalledWith([]);
        expect(defaultProps.onCriticalityFilterChange).toHaveBeenCalledWith([]);
    });

    it('should display description text', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.getByText('Personnalisez votre vue du registre')).toBeInTheDocument();
    });

    it('should display real-time filter message', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.getByText('Les filtres sont appliqués en temps réel')).toBeInTheDocument();
    });

    it('should render with proper container styling', () => {
        const { container } = render(<RiskAdvancedFilters {...defaultProps} />);

        const filterContainer = container.firstChild as HTMLElement;
        expect(filterContainer).toHaveClass('rounded-3xl');
        expect(filterContainer).toHaveClass('backdrop-blur-md');
    });

    it('should have three filter columns in the grid', () => {
        const { container } = render(<RiskAdvancedFilters {...defaultProps} />);

        const grid = container.querySelector('.grid');
        expect(grid).toBeInTheDocument();
        expect(grid?.children.length).toBe(3);
    });

    it('should show header section with title', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        const header = screen.getByText('Filtres avancés');
        expect(header.tagName).toBe('H3');
    });
});
