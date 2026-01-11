/**
 * RiskAdvancedFilters Component Tests
 * Story 3.5: Risk Register View - Advanced filtering
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiskAdvancedFilters } from '../RiskAdvancedFilters';

describe('RiskAdvancedFilters', () => {
    const defaultProps = {
        statusFilter: '',
        onStatusFilterChange: vi.fn(),
        categoryFilter: '',
        onCategoryFilterChange: vi.fn(),
        criticalityFilter: '',
        onCriticalityFilterChange: vi.fn(),
        availableCategories: ['Technique', 'Organisationnel', 'Humain'],
        onClose: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render all filter dropdowns', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.getByLabelText('Filtrer par statut')).toBeInTheDocument();
        expect(screen.getByLabelText('Filtrer par criticité')).toBeInTheDocument();
        expect(screen.getByLabelText('Filtrer par catégorie')).toBeInTheDocument();
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

    it('should display all status options', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        const statusSelect = screen.getByLabelText('Filtrer par statut');
        expect(statusSelect).toHaveTextContent('Tous les statuts');
        expect(statusSelect).toHaveTextContent('Brouillon');
        expect(statusSelect).toHaveTextContent('Ouvert');
        expect(statusSelect).toHaveTextContent('En cours');
        expect(statusSelect).toHaveTextContent('En attente de validation');
        expect(statusSelect).toHaveTextContent('Fermé');
    });

    it('should display all criticality options', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        const criticalitySelect = screen.getByLabelText('Filtrer par criticité');
        expect(criticalitySelect).toHaveTextContent('Toutes les criticités');
        expect(criticalitySelect).toHaveTextContent('Critique (15-25)');
        expect(criticalitySelect).toHaveTextContent('Élevé (10-14)');
        expect(criticalitySelect).toHaveTextContent('Moyen (5-9)');
        expect(criticalitySelect).toHaveTextContent('Faible (1-4)');
    });

    it('should display available categories in dropdown', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        const categorySelect = screen.getByLabelText('Filtrer par catégorie');
        expect(categorySelect).toHaveTextContent('Toutes les catégories');
        expect(categorySelect).toHaveTextContent('Technique');
        expect(categorySelect).toHaveTextContent('Organisationnel');
        expect(categorySelect).toHaveTextContent('Humain');
    });

    it('should not render category filter when no categories available', () => {
        render(<RiskAdvancedFilters {...defaultProps} availableCategories={[]} />);

        expect(screen.queryByLabelText('Filtrer par catégorie')).not.toBeInTheDocument();
    });

    it('should call onStatusFilterChange when status is selected', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        const statusSelect = screen.getByLabelText('Filtrer par statut');
        fireEvent.change(statusSelect, { target: { value: 'Ouvert' } });

        expect(defaultProps.onStatusFilterChange).toHaveBeenCalledWith('Ouvert');
    });

    it('should call onCriticalityFilterChange when criticality is selected', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        const criticalitySelect = screen.getByLabelText('Filtrer par criticité');
        fireEvent.change(criticalitySelect, { target: { value: 'Critique' } });

        expect(defaultProps.onCriticalityFilterChange).toHaveBeenCalledWith('Critique');
    });

    it('should call onCategoryFilterChange when category is selected', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        const categorySelect = screen.getByLabelText('Filtrer par catégorie');
        fireEvent.change(categorySelect, { target: { value: 'Technique' } });

        expect(defaultProps.onCategoryFilterChange).toHaveBeenCalledWith('Technique');
    });

    it('should show clear filters button when filters are active', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                statusFilter="Ouvert"
            />
        );

        expect(screen.getByText('Effacer les filtres')).toBeInTheDocument();
    });

    it('should not show clear filters button when no filters are active', () => {
        render(<RiskAdvancedFilters {...defaultProps} />);

        expect(screen.queryByText('Effacer les filtres')).not.toBeInTheDocument();
    });

    it('should clear all filters when clear button is clicked', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                statusFilter="Ouvert"
                categoryFilter="Technique"
                criticalityFilter="Élevé"
            />
        );

        fireEvent.click(screen.getByText('Effacer les filtres'));

        expect(defaultProps.onStatusFilterChange).toHaveBeenCalledWith('');
        expect(defaultProps.onCategoryFilterChange).toHaveBeenCalledWith('');
        expect(defaultProps.onCriticalityFilterChange).toHaveBeenCalledWith('');
    });

    it('should display active filter badges', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                statusFilter="Ouvert"
                criticalityFilter="Critique"
                categoryFilter="Technique"
            />
        );

        expect(screen.getByText('Statut: Ouvert')).toBeInTheDocument();
        expect(screen.getByText('Criticité: Critique')).toBeInTheDocument();
        expect(screen.getByText('Catégorie: Technique')).toBeInTheDocument();
    });

    it('should remove individual filter when badge close button is clicked', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                statusFilter="Ouvert"
            />
        );

        const statusBadge = screen.getByText('Statut: Ouvert').closest('span');
        const closeButton = statusBadge?.querySelector('button');

        expect(closeButton).toBeInTheDocument();
        fireEvent.click(closeButton!);

        expect(defaultProps.onStatusFilterChange).toHaveBeenCalledWith('');
    });

    it('should remove criticality filter when badge close button is clicked', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                criticalityFilter="Élevé"
            />
        );

        const criticalityBadge = screen.getByText('Criticité: Élevé').closest('span');
        const closeButton = criticalityBadge?.querySelector('button');

        fireEvent.click(closeButton!);

        expect(defaultProps.onCriticalityFilterChange).toHaveBeenCalledWith('');
    });

    it('should remove category filter when badge close button is clicked', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                categoryFilter="Technique"
            />
        );

        const categoryBadge = screen.getByText('Catégorie: Technique').closest('span');
        const closeButton = categoryBadge?.querySelector('button');

        fireEvent.click(closeButton!);

        expect(defaultProps.onCategoryFilterChange).toHaveBeenCalledWith('');
    });

    it('should reflect current filter values in dropdowns', () => {
        render(
            <RiskAdvancedFilters
                {...defaultProps}
                statusFilter="En cours"
                criticalityFilter="Moyen"
                categoryFilter="Humain"
            />
        );

        expect(screen.getByLabelText('Filtrer par statut')).toHaveValue('En cours');
        expect(screen.getByLabelText('Filtrer par criticité')).toHaveValue('Moyen');
        expect(screen.getByLabelText('Filtrer par catégorie')).toHaveValue('Humain');
    });
});
