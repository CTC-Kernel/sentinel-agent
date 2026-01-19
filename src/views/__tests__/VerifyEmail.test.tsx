/**
 * VerifyEmail Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { VerifyEmail } from '../VerifyEmail';

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
        user: { email: 'test@example.com', emailVerified: false }
    })
}));

// Mock useAuthActions
const mockSendVerificationEmail = vi.fn();
const mockCheckEmailVerification = vi.fn();
const mockLogout = vi.fn();

vi.mock('../../hooks/useAuthActions', () => ({
    useAuthActions: () => ({
        sendVerificationEmail: mockSendVerificationEmail,
        checkEmailVerification: mockCheckEmailVerification,
        logout: mockLogout
    })
}));

// Mock components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

vi.mock('../../components/ui/Icons', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../components/ui/Icons')>();
    return {
        ...actual,
    };
});

describe('VerifyEmail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <VerifyEmail />
            </BrowserRouter>
        );
    };

    it('should render MasterpieceBackground', () => {
        renderComponent();

        expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
    });

    it('should render verify email title', () => {
        renderComponent();

        expect(screen.getByText('Vérifiez votre email')).toBeInTheDocument();
    });

    it('should display user email', () => {
        renderComponent();

        expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should render check verification button', () => {
        renderComponent();

        expect(screen.getByLabelText("J'ai vérifié mon email")).toBeInTheDocument();
    });

    it('should render resend email button', () => {
        renderComponent();

        expect(screen.getByLabelText("Renvoyer l'email")).toBeInTheDocument();
    });

    it('should render logout button', () => {
        renderComponent();

        expect(screen.getByLabelText('Se déconnecter')).toBeInTheDocument();
    });

    it('should call checkEmailVerification when check button is clicked', async () => {
        renderComponent();

        const checkButton = screen.getByLabelText("J'ai vérifié mon email");
        fireEvent.click(checkButton);

        await waitFor(() => {
            expect(mockCheckEmailVerification).toHaveBeenCalled();
        });
    });

    it('should call sendVerificationEmail when resend button is clicked', async () => {
        renderComponent();

        const resendButton = screen.getByLabelText("Renvoyer l'email");
        fireEvent.click(resendButton);

        await waitFor(() => {
            expect(mockSendVerificationEmail).toHaveBeenCalled();
        });
    });

    it('should call logout when logout button is clicked', async () => {
        renderComponent();

        const logoutButton = screen.getByLabelText('Se déconnecter');
        fireEvent.click(logoutButton);

        await waitFor(() => {
            expect(mockLogout).toHaveBeenCalled();
        });
    });

    it('should show email sent confirmation after resending', async () => {
        mockSendVerificationEmail.mockResolvedValueOnce(undefined);
        renderComponent();

        const resendButton = screen.getByLabelText("Renvoyer l'email");
        fireEvent.click(resendButton);

        await waitFor(() => {
            expect(screen.getByText(/Email envoyé/)).toBeInTheDocument();
        });
    });
});

describe('VerifyEmail error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle sendVerificationEmail error', async () => {
        mockSendVerificationEmail.mockRejectedValueOnce(new Error('Failed'));

        render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <VerifyEmail />
            </BrowserRouter>
        );

        const resendButton = screen.getByLabelText("Renvoyer l'email");
        fireEvent.click(resendButton);

        // Error is handled in hook, button should still work
        await waitFor(() => {
            expect(mockSendVerificationEmail).toHaveBeenCalled();
        });
    });

    it('should handle checkEmailVerification error', async () => {
        mockCheckEmailVerification.mockRejectedValueOnce(new Error('Failed'));

        render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <VerifyEmail />
            </BrowserRouter>
        );

        const checkButton = screen.getByLabelText("J'ai vérifié mon email");
        fireEvent.click(checkButton);

        // Error is handled in hook
        await waitFor(() => {
            expect(mockCheckEmailVerification).toHaveBeenCalled();
        });
    });
});
