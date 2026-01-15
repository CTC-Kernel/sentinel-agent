/**
 * Unit tests for IncidentSummaryCard component
 * Tests incident dashboard summary card display
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncidentSummaryCard } from '../IncidentSummaryCard';

describe('IncidentSummaryCard', () => {
    const defaultProps = {
        resolutionRate: 75,
        totalIncidents: 50,
        openIncidents: 12,
        criticalIncidents: 3
    };

    describe('rendering', () => {
        it('renders resolution rate', () => {
            render(<IncidentSummaryCard {...defaultProps} />);

            expect(screen.getByText('75%')).toBeInTheDocument();
        });

        it('renders total incidents count', () => {
            render(<IncidentSummaryCard {...defaultProps} />);

            expect(screen.getByText('50')).toBeInTheDocument();
        });

        it('renders open incidents count', () => {
            render(<IncidentSummaryCard {...defaultProps} />);

            expect(screen.getByText('12')).toBeInTheDocument();
        });

        it('renders critical incidents count', () => {
            render(<IncidentSummaryCard {...defaultProps} />);

            expect(screen.getByText('3')).toBeInTheDocument();
        });

        it('renders section headers', () => {
            render(<IncidentSummaryCard {...defaultProps} />);

            expect(screen.getByText('Taux de Résolution')).toBeInTheDocument();
            expect(screen.getByText('Total')).toBeInTheDocument();
            expect(screen.getByText('En Cours')).toBeInTheDocument();
            expect(screen.getByText('Critiques')).toBeInTheDocument();
        });

        it('renders description text', () => {
            render(<IncidentSummaryCard {...defaultProps} />);

            expect(screen.getByText("Pourcentage d'incidents résolus ou fermés.")).toBeInTheDocument();
        });
    });

    describe('alerts', () => {
        it('shows critical alert when critical incidents exist', () => {
            render(<IncidentSummaryCard {...defaultProps} criticalIncidents={3} />);

            expect(screen.getByText('3 critiques ouverts')).toBeInTheDocument();
        });

        it('shows active incidents alert when no critical but open incidents', () => {
            render(<IncidentSummaryCard {...defaultProps} criticalIncidents={0} openIncidents={5} />);

            expect(screen.getByText('5 incidents actifs')).toBeInTheDocument();
        });

        it('shows no active incidents message when all clear', () => {
            render(<IncidentSummaryCard {...defaultProps} criticalIncidents={0} openIncidents={0} />);

            expect(screen.getByText('Aucun incident actif')).toBeInTheDocument();
        });

        it('prioritizes critical alert over open incidents alert', () => {
            render(<IncidentSummaryCard {...defaultProps} criticalIncidents={3} openIncidents={12} />);

            expect(screen.getByText('3 critiques ouverts')).toBeInTheDocument();
            expect(screen.queryByText('12 incidents actifs')).not.toBeInTheDocument();
        });
    });

    describe('different values', () => {
        it('renders 0% resolution rate', () => {
            render(<IncidentSummaryCard {...defaultProps} resolutionRate={0} />);

            expect(screen.getByText('0%')).toBeInTheDocument();
        });

        it('renders 100% resolution rate', () => {
            render(<IncidentSummaryCard {...defaultProps} resolutionRate={100} />);

            expect(screen.getByText('100%')).toBeInTheDocument();
        });

        it('renders zero counts', () => {
            render(
                <IncidentSummaryCard
                    resolutionRate={100}
                    totalIncidents={0}
                    openIncidents={0}
                    criticalIncidents={0}
                />
            );

            // Should find '0' for all count fields
            const zeros = screen.getAllByText('0');
            expect(zeros.length).toBeGreaterThanOrEqual(2);
        });

        it('renders large incident count', () => {
            render(<IncidentSummaryCard {...defaultProps} totalIncidents={1000} />);

            expect(screen.getByText('1000')).toBeInTheDocument();
        });
    });
});
