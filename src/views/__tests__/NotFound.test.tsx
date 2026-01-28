/**
 * NotFound View Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotFound } from '../NotFound';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) =>
            <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>
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

// Mock MasterpieceBackground
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

// Mock FeedbackModal
vi.mock('../../components/ui/FeedbackModal', () => ({
    FeedbackModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
        isOpen ? (
            <div
                data-testid="feedback-modal"
                onClick={onClose}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        onClose();
                    }
                }}
                role="button"
                tabIndex={0}
                aria-label="Close feedback modal"
            >
                Feedback Modal
            </div>
        ) : null
    )
}));

// Mock Icons
vi.mock('../../components/ui/Icons', () => ({
    AlertTriangle: () => <span>AlertTriangle</span>,
    Home: () => <span>Home</span>
}));

describe('NotFound View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <NotFound />
            </BrowserRouter>
        );
    };

    it('should render 404 heading', () => {
        renderComponent();

        expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('should render "Page introuvable" message', () => {
        renderComponent();

        expect(screen.getByText('Page introuvable')).toBeInTheDocument();
    });

    it('should render description text', () => {
        renderComponent();

        expect(screen.getByText(/Désolé, la page que vous recherchez/)).toBeInTheDocument();
    });

    it('should render home button', () => {
        renderComponent();

        expect(screen.getByText('Retour au Tableau de Bord')).toBeInTheDocument();
    });

    it('should navigate to home when home button is clicked', () => {
        renderComponent();

        const homeButton = screen.getByText('Retour au Tableau de Bord');
        fireEvent.click(homeButton);

        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should render back button', () => {
        renderComponent();

        expect(screen.getByText('Retour')).toBeInTheDocument();
    });

    it('should call window.history.back when back button is clicked', () => {
        const historyBackSpy = vi.spyOn(window.history, 'back');
        renderComponent();

        const backButton = screen.getByText('Retour');
        fireEvent.click(backButton);

        expect(historyBackSpy).toHaveBeenCalled();
    });

    it('should render report button', () => {
        renderComponent();

        expect(screen.getByText('Signaler')).toBeInTheDocument();
    });

    it('should open feedback modal when report button is clicked', () => {
        renderComponent();

        const reportButton = screen.getByText('Signaler');
        fireEvent.click(reportButton);

        expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    });

    it('should close feedback modal when modal is closed', () => {
        renderComponent();

        // Open modal
        const reportButton = screen.getByText('Signaler');
        fireEvent.click(reportButton);
        expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();

        // Close modal
        fireEvent.click(screen.getByTestId('feedback-modal'));
        expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();
    });

    it('should render MasterpieceBackground', () => {
        renderComponent();

        expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
    });
});
