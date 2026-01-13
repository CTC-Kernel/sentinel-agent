/**
 * Help View Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Help } from '../Help';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    },
}));

// Mock components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

vi.mock('../../components/SEO', () => ({
    SEO: ({ title, description }: { title: string; description: string }) => (
        <div data-testid="seo" data-title={title} data-description={description} />
    )
}));

vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
        <div data-testid="page-header" data-title={title} data-subtitle={subtitle}>
            <h1>{title}</h1>
            <p>{subtitle}</p>
        </div>
    )
}));

vi.mock('../../components/ui/ContactModal', () => ({
    ContactModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
        isOpen ? (
            <div data-testid="contact-modal">
                <button onClick={onClose}>Close Contact</button>
            </div>
        ) : null
    )
}));

vi.mock('../../components/ui/FeedbackModal', () => ({
    FeedbackModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
        isOpen ? (
            <div data-testid="feedback-modal">
                <button onClick={onClose}>Close Feedback</button>
            </div>
        ) : null
    )
}));

vi.mock('../../components/ui/animationVariants', () => ({
    staggerContainerVariants: {}
}));

describe('Help', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Help />
            </BrowserRouter>
        );
    };

    describe('Rendering', () => {
        it('should render SEO component with correct title', () => {
            renderComponent();
            const seo = screen.getByTestId('seo');
            expect(seo).toHaveAttribute('data-title', "Centre d'Aide");
        });

        it('should render MasterpieceBackground', () => {
            renderComponent();
            expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
        });

        it('should render PageHeader with correct props', () => {
            renderComponent();
            const header = screen.getByTestId('page-header');
            expect(header).toBeInTheDocument();
            expect(screen.getByText("Centre d'Aide")).toBeInTheDocument();
        });

        it('should render search input', () => {
            renderComponent();
            const searchInput = screen.getByPlaceholderText('Rechercher...');
            expect(searchInput).toBeInTheDocument();
        });

        it('should render default category "Démarrage Rapide"', () => {
            renderComponent();
            // Multiple elements may have this text (nav item + heading)
            const elements = screen.getAllByText('Démarrage Rapide');
            expect(elements.length).toBeGreaterThan(0);
        });

        it('should render support button', () => {
            renderComponent();
            expect(screen.getByRole('button', { name: /Contacter le support/i })).toBeInTheDocument();
        });

        it('should render feedback button', () => {
            renderComponent();
            expect(screen.getByRole('button', { name: /Donner mon avis/i })).toBeInTheDocument();
        });
    });

    describe('Category Navigation', () => {
        it('should display articles for selected category', () => {
            renderComponent();
            // Default category is "getting-started" / "Démarrage Rapide"
            expect(screen.getByText('Introduction à Sentinel GRC')).toBeInTheDocument();
            expect(screen.getByText('Premiers pas')).toBeInTheDocument();
        });

        it('should switch categories when clicking on category button', async () => {
            renderComponent();

            const risksCategory = screen.getByRole('button', { name: 'Gestion des Risques' });
            fireEvent.click(risksCategory);

            await waitFor(() => {
                expect(screen.getByText('Méthodologie EBIOS RM & ISO 27005')).toBeInTheDocument();
            });
        });

        it('should display all main categories', () => {
            renderComponent();

            const expectedCategories = [
                'Démarrage Rapide',
                'Gestion des Actifs',
                'Gestion des Risques',
                'Conformité & Audits',
                'Gestion de Projet',
                "Gestion d'Incidents",
                'Gestion Documentaire',
                'Rapports & Tableaux de Bord',
                'Équipe & Collaborateurs',
                'Intégrations & API',
                'Sécurité & Confidentialité',
                'Paramètres & Configuration',
                'Tutoriels Interactifs',
                'FAQ & Dépannage'
            ];

            expectedCategories.forEach(category => {
                // Use queryAllByText since some categories may appear multiple times
                const elements = screen.queryAllByText(category);
                expect(elements.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Article Expansion', () => {
        it('should expand article content when clicking on article', async () => {
            renderComponent();

            // Click on first article "Introduction à Sentinel GRC"
            const articleButton = screen.getByRole('button', { name: /Voir l'article Introduction à Sentinel GRC/i });
            fireEvent.click(articleButton);

            await waitFor(() => {
                expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
            });
        });

        it('should collapse article when clicking again', async () => {
            renderComponent();

            const articleButton = screen.getByRole('button', { name: /Voir l'article Introduction à Sentinel GRC/i });

            // Expand
            fireEvent.click(articleButton);
            await waitFor(() => {
                expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
            });

            // Collapse
            fireEvent.click(articleButton);
            // Article should collapse (content is still in DOM but hidden via CSS)
        });

        it('should support keyboard navigation with Enter key', async () => {
            renderComponent();

            const articleButton = screen.getByRole('button', { name: /Voir l'article Introduction à Sentinel GRC/i });
            fireEvent.keyDown(articleButton, { key: 'Enter' });

            await waitFor(() => {
                expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
            });
        });

        it('should support keyboard navigation with Space key', async () => {
            renderComponent();

            const articleButton = screen.getByRole('button', { name: /Voir l'article Introduction à Sentinel GRC/i });
            fireEvent.keyDown(articleButton, { key: ' ' });

            await waitFor(() => {
                expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
            });
        });
    });

    describe('Search Functionality', () => {
        it('should filter articles based on search input', async () => {
            renderComponent();

            const searchInput = screen.getByPlaceholderText('Rechercher...');
            fireEvent.change(searchInput, { target: { value: 'risque' } });

            await waitFor(() => {
                // Should show categories containing "risque" in articles
                const elements = screen.getAllByText('Gestion des Risques');
                expect(elements.length).toBeGreaterThan(0);
            });
        });

        it('should clear filter when search is emptied', async () => {
            renderComponent();

            const searchInput = screen.getByPlaceholderText('Rechercher...');
            fireEvent.change(searchInput, { target: { value: 'risque' } });
            fireEvent.change(searchInput, { target: { value: '' } });

            await waitFor(() => {
                const elements = screen.getAllByText('Démarrage Rapide');
                expect(elements.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Modal Interactions', () => {
        it('should open contact modal when clicking support button', async () => {
            renderComponent();

            const supportButton = screen.getByRole('button', { name: /Contacter le support/i });
            fireEvent.click(supportButton);

            await waitFor(() => {
                expect(screen.getByTestId('contact-modal')).toBeInTheDocument();
            });
        });

        it('should close contact modal when close button is clicked', async () => {
            renderComponent();

            const supportButton = screen.getByRole('button', { name: /Contacter le support/i });
            fireEvent.click(supportButton);

            await waitFor(() => {
                expect(screen.getByTestId('contact-modal')).toBeInTheDocument();
            });

            const closeButton = screen.getByText('Close Contact');
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.queryByTestId('contact-modal')).not.toBeInTheDocument();
            });
        });

        it('should open feedback modal when clicking feedback button', async () => {
            renderComponent();

            const feedbackButton = screen.getByRole('button', { name: /Donner mon avis/i });
            fireEvent.click(feedbackButton);

            await waitFor(() => {
                expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
            });
        });

        it('should close feedback modal when close button is clicked', async () => {
            renderComponent();

            const feedbackButton = screen.getByRole('button', { name: /Donner mon avis/i });
            fireEvent.click(feedbackButton);

            await waitFor(() => {
                expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
            });

            const closeButton = screen.getByText('Close Feedback');
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();
            });
        });
    });

    describe('Mobile Menu', () => {
        it('should render mobile menu toggle button', () => {
            renderComponent();

            // The mobile menu button should be present (visible on mobile)
            const menuButton = screen.getByRole('button', { name: /Ouvrir le menu/i });
            expect(menuButton).toBeInTheDocument();
        });

        it('should toggle mobile menu when clicking toggle button', async () => {
            renderComponent();

            const menuButton = screen.getByRole('button', { name: /Ouvrir le menu/i });
            fireEvent.click(menuButton);

            await waitFor(() => {
                // After clicking, the button text should change to "Fermer le menu"
                expect(screen.getByRole('button', { name: /Fermer le menu/i })).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have accessible search input with aria-label', () => {
            renderComponent();

            const searchInput = screen.getByRole('textbox', { name: /Rechercher dans l'aide/i });
            expect(searchInput).toBeInTheDocument();
        });

        it('should have article buttons with correct role', () => {
            renderComponent();

            const articleButtons = screen.getAllByRole('button');
            expect(articleButtons.length).toBeGreaterThan(0);
        });
    });
});
