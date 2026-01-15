/**
 * Unit tests for LandingDashboardMockup component
 * Tests dashboard mockup display for landing page
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingDashboardMockup } from '../LandingDashboardMockup';

describe('LandingDashboardMockup', () => {
    describe('sidebar', () => {
        it('renders brand name', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Sentinel')).toBeInTheDocument();
        });

        it('renders navigation items', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
            expect(screen.getByText('Actifs & Inventaire')).toBeInTheDocument();
            expect(screen.getByText('Registre des Risques')).toBeInTheDocument();
        });

        it('renders user profile section', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Thibault L.')).toBeInTheDocument();
            expect(screen.getByText('Admin (RSSI)')).toBeInTheDocument();
        });
    });

    describe('top bar', () => {
        it('renders breadcrumb', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Pilotage')).toBeInTheDocument();
            expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
        });

        it('renders search placeholder', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Rechercher...')).toBeInTheDocument();
        });

        it('renders keyboard shortcut', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('⌘K')).toBeInTheDocument();
        });
    });

    describe('dashboard content', () => {
        it('renders page title', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Tableau de Bord SSI')).toBeInTheDocument();
        });

        it('renders page subtitle', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Vue synthétique de votre posture de sécurité.')).toBeInTheDocument();
        });

        it('renders date filter', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('30 derniers jours')).toBeInTheDocument();
        });

        it('renders report button', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Générer rapport')).toBeInTheDocument();
        });
    });

    describe('widgets', () => {
        it('renders compliance score widget', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('84%')).toBeInTheDocument();
            expect(screen.getByText('Score de Conformité')).toBeInTheDocument();
        });

        it('renders critical risks widget', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('3')).toBeInTheDocument();
            expect(screen.getByText('Risques Critiques')).toBeInTheDocument();
        });

        it('renders protected assets widget', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('248')).toBeInTheDocument();
            expect(screen.getByText('Actifs Protégés')).toBeInTheDocument();
        });

        it('renders SLA widget', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('98.2%')).toBeInTheDocument();
            expect(screen.getByText('SLA Disponibilité')).toBeInTheDocument();
        });

        it('renders improvement badge', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('+12%')).toBeInTheDocument();
        });
    });

    describe('charts section', () => {
        it('renders maturity chart title', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Évolution de la maturité ISO 27001')).toBeInTheDocument();
        });

        it('renders chart legend', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Cible')).toBeInTheDocument();
            expect(screen.getByText('Actuel')).toBeInTheDocument();
        });

        it('renders distribution chart', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('Répartition')).toBeInTheDocument();
            expect(screen.getByText('124')).toBeInTheDocument();
            expect(screen.getByText('Total')).toBeInTheDocument();
        });

        it('renders distribution values', () => {
            render(<LandingDashboardMockup />);

            expect(screen.getByText('En cours')).toBeInTheDocument();
            expect(screen.getByText('45%')).toBeInTheDocument();
            expect(screen.getByText('Clôturé')).toBeInTheDocument();
            expect(screen.getByText('32%')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has rounded container', () => {
            const { container } = render(<LandingDashboardMockup />);

            expect(container.firstChild).toHaveClass('rounded-[1.5rem]');
        });

        it('has backdrop blur', () => {
            const { container } = render(<LandingDashboardMockup />);

            expect(container.firstChild).toHaveClass('backdrop-blur-sm');
        });

        it('has shadow styling', () => {
            const { container } = render(<LandingDashboardMockup />);

            expect(container.firstChild).toHaveClass('shadow-2xl');
        });

        it('is not selectable', () => {
            const { container } = render(<LandingDashboardMockup />);

            expect(container.firstChild).toHaveClass('select-none');
        });
    });
});
