/**
 * LandingPage Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LandingPage } from '../LandingPage';

// Mock components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

vi.mock('../../components/SEO', () => ({
    SEO: ({ title, description }: { title: string; description: string }) => (
        <div data-testid="seo" data-title={title} data-description={description} />
    )
}));

vi.mock('../../components/landing/LandingDashboardMockup', () => ({
    LandingDashboardMockup: () => <div data-testid="dashboard-mockup" />
}));

vi.mock('../../components/landing/SystemEntrance', () => ({
    SystemEntrance: () => <div data-testid="system-entrance" />
}));

vi.mock('../../components/ui/Icons', () => ({
    Shield: () => <span data-testid="icon-shield">ShieldIcon</span>,
    Layers: () => <span data-testid="icon-layers">LayersIcon</span>,
    CheckCircle2: () => <span data-testid="icon-checkcircle">CheckCircleIcon</span>
}));

describe('LandingPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <LandingPage />
            </BrowserRouter>
        );
    };

    it('should render SEO component with correct title', () => {
        renderComponent();

        const seo = screen.getByTestId('seo');
        expect(seo).toHaveAttribute('data-title', 'Sentinel GRC — Gouvernance Cyber Souveraine');
    });

    it('should render MasterpieceBackground', () => {
        renderComponent();

        expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
    });

    it('should render SystemEntrance in hero section', () => {
        renderComponent();

        expect(screen.getByTestId('system-entrance')).toBeInTheDocument();
    });

    it('should render LandingDashboardMockup', () => {
        renderComponent();

        expect(screen.getByTestId('dashboard-mockup')).toBeInTheDocument();
    });

    it('should render feature cards section', () => {
        renderComponent();

        expect(screen.getByText(/L'ARSENAL/)).toBeInTheDocument();
        expect(screen.getByText('COMPLET')).toBeInTheDocument();
    });

    it('should render feature card titles', () => {
        renderComponent();

        expect(screen.getByText('Cartographie Totale')).toBeInTheDocument();
        expect(screen.getByText('Guerre aux Risques')).toBeInTheDocument();
        expect(screen.getByText('Conformité Continue')).toBeInTheDocument();
    });

    it('should render feature card descriptions', () => {
        renderComponent();

        expect(screen.getByText(/Vision à 360°/)).toBeInTheDocument();
        expect(screen.getByText(/ISO 27005 pilotée par IA/)).toBeInTheDocument();
        expect(screen.getByText(/Ne subissez plus les audits/)).toBeInTheDocument();
    });

    it('should render footer', () => {
        renderComponent();

        expect(screen.getByText(/Opérationnel dans toute l'Europe/)).toBeInTheDocument();
        expect(screen.getByText(/SENTINEL GRC/)).toBeInTheDocument();
    });
});
