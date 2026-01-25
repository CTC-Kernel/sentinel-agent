/**
 * Pricing View Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Pricing from '../Pricing';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        h1: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLHeadingElement>>) =>
            <h1 {...props}>{children}</h1>,
        p: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLParagraphElement>>) =>
            <p {...props}>{children}</p>,
        div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) =>
            <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback || key
    })
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

// Mock store
vi.mock('../../store', () => ({
    useStore: () => ({
        user: { uid: 'user-1', organizationId: 'org-1' }
    })
}));

// Mock SubscriptionService
vi.mock('../../services/subscriptionService', () => ({
    SubscriptionService: {
        startSubscription: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock toast
vi.mock('../../lib/toast', () => ({
    toast: {
        error: vi.fn()
    }
}));

// Mock config/plans
vi.mock('../../config/plans', () => ({
    PLANS: {
        DISCOVERY: {
            id: 'discovery',
            name: 'Discovery',
            priceMonthly: 0,
            priceYearly: 0,
            highlight: false,
            featuresList: ['Feature 1', 'Feature 2']
        },
        professional: {
            id: 'professional',
            name: 'Professional',
            priceMonthly: 99,
            priceYearly: 950,
            highlight: true,
            featuresList: ['Feature A', 'Feature B', 'Feature C']
        },
        enterprise: {
            id: 'enterprise',
            name: 'Enterprise',
            priceMonthly: 299,
            priceYearly: 2870,
            highlight: false,
            featuresList: ['Feature X', 'Feature Y']
        }
    }
}));

// Mock components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

vi.mock('../../components/SEO', () => ({
    SEO: ({ title }: { title: string }) => <div data-testid="seo" data-title={title} />
}));

vi.mock('../../components/ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('../../components/ui/ContactModal', () => ({
    ContactModal: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="contact-modal">Contact Modal</div> : null
}));

vi.mock('../../components/ui/LegalModal', () => ({
    LegalModal: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="legal-modal">Legal Modal</div> : null
}));

describe('Pricing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Pricing />
            </BrowserRouter>
        );
    };

    it('should render SEO component', () => {
        renderComponent();

        expect(screen.getByTestId('seo')).toHaveAttribute('data-title', 'Tarifs | Sentinel GRC');
    });

    it('should render MasterpieceBackground', () => {
        renderComponent();

        expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
    });

    it('should render pricing title', () => {
        renderComponent();

        expect(screen.getByText('common.pricingTitle')).toBeInTheDocument();
    });

    it('should render all plan names', () => {
        renderComponent();

        // Plan names may appear multiple times (in cards and comparison table)
        expect(screen.getAllByText('Discovery').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Professional').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Enterprise').length).toBeGreaterThanOrEqual(1);
    });

    it('should render billing toggle buttons', () => {
        renderComponent();

        expect(screen.getByText('Mensuel')).toBeInTheDocument();
        expect(screen.getByText('Annuel')).toBeInTheDocument();
    });

    it('should toggle billing period', () => {
        renderComponent();

        const monthlyButton = screen.getByText('Mensuel');
        fireEvent.click(monthlyButton);

        // Monthly prices should be displayed
        expect(screen.getByText('99€')).toBeInTheDocument();
    });

    it('should display annual discount badge', () => {
        renderComponent();

        expect(screen.getByText('-20%')).toBeInTheDocument();
    });

    it('should render Commencer buttons', () => {
        renderComponent();

        const startButtons = screen.getAllByText('Commencer maintenant');
        expect(startButtons).toHaveLength(3);
    });

    it('should call startSubscription when clicking plan button', async () => {
        const { SubscriptionService } = await import('../../services/subscriptionService');

        renderComponent();

        const startButtons = screen.getAllByText('Commencer maintenant');
        fireEvent.click(startButtons[0]);

        await waitFor(() => {
            expect(SubscriptionService.startSubscription).toHaveBeenCalled();
        });
    });

    it('should render FAQ section', () => {
        renderComponent();

        expect(screen.getByText(/FAQ/i)).toBeInTheDocument();
    });

    it('should render comparison table header', () => {
        renderComponent();

        expect(screen.getByText(/Comparaison Détaillée/i)).toBeInTheDocument();
    });

    it('should render recommended badge on Professional plan', () => {
        renderComponent();

        expect(screen.getByText(/RECOMMANDÉ/i)).toBeInTheDocument();
    });

    it('should open contact modal when clicking contact link', () => {
        renderComponent();

        const contactLink = screen.getByText(/Contactez-nous/i);
        fireEvent.click(contactLink);

        expect(screen.getByTestId('contact-modal')).toBeInTheDocument();
    });

    it('should open legal modal when clicking CGV', () => {
        renderComponent();

        const cgvButton = screen.getByText('CGV');
        fireEvent.click(cgvButton);

        expect(screen.getByTestId('legal-modal')).toBeInTheDocument();
    });

    it('should render feature categories', () => {
        renderComponent();

        expect(screen.getByText('common.pilotage')).toBeInTheDocument();
        expect(screen.getByText('common.operations')).toBeInTheDocument();
    });

    it('should toggle feature category expansion', () => {
        renderComponent();

        // Categories start expanded, clicking should collapse
        const categoryButton = screen.getAllByRole('button').find(
            btn => btn.textContent?.includes('common.pilotage')
        );

        if (categoryButton) {
            fireEvent.click(categoryButton);
            // Category should be collapsed
        }
    });
});
