/**
 * CertifierLogin Component Tests
 * Story 14-1: Test Coverage 50%
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CertifierLogin } from '../CertifierLogin';

// Mock Firebase auth
const mockSignInWithEmailAndPassword = vi.fn();
vi.mock('firebase/auth', () => ({
    signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
}));

// Mock Firebase app
vi.mock('../../../../firebase', () => ({
    auth: { currentUser: null },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('@/lib/toast', () => ({
    toast: {
        success: (...args: unknown[]) => mockToastSuccess(...args),
        error: (...args: unknown[]) => mockToastError(...args),
    },
}));

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'certifier.portalTitle': 'Certifier Portal',
                'certifier.portalSubtitle': 'Access your certification dashboard',
                'certifier.emailLabel': 'Email',
                'certifier.passwordLabel': 'Password',
                'certifier.loginButton': 'Login',
                'certifier.newPartner': 'New Partner?',
                'certifier.registerLink': 'Register',
            };
            return translations[key] || key;
        },
    }),
}));

// Mock lucide icons
vi.mock('lucide-react', () => ({
    Loader2: () => <span data-testid="loader" />,
    ShieldCheck: () => <span data-testid="icon-shield" />,
    Mail: () => <span data-testid="icon-mail" />,
    Lock: () => <span data-testid="icon-lock" />,
}));

// Mock MasterpieceBackground
vi.mock('../../../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="background" />,
}));

// Mock ErrorLogger
vi.mock('../../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

const renderWithRouter = (component: React.ReactElement) => {
    return render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {component}
        </MemoryRouter>
    );
};

describe('CertifierLogin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'user-123' } });
    });

    describe('Rendering', () => {
        it('should render portal title', () => {
            renderWithRouter(<CertifierLogin />);
            expect(screen.getByText('Certifier Portal')).toBeInTheDocument();
        });

        it('should render portal subtitle', () => {
            renderWithRouter(<CertifierLogin />);
            expect(screen.getByText('Access your certification dashboard')).toBeInTheDocument();
        });

        it('should render email input', () => {
            renderWithRouter(<CertifierLogin />);
            expect(screen.getByPlaceholderText('nom@organisme-certif.com')).toBeInTheDocument();
        });

        it('should render password input', () => {
            renderWithRouter(<CertifierLogin />);
            expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
        });

        it('should render login button', () => {
            renderWithRouter(<CertifierLogin />);
            expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
        });

        it('should render register link', () => {
            renderWithRouter(<CertifierLogin />);
            expect(screen.getByText('Register')).toBeInTheDocument();
        });

        it('should render background component', () => {
            renderWithRouter(<CertifierLogin />);
            expect(screen.getByTestId('background')).toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
        it('should have email input of type email', () => {
            renderWithRouter(<CertifierLogin />);

            const emailInput = screen.getByPlaceholderText('nom@organisme-certif.com');
            expect(emailInput).toHaveAttribute('type', 'email');
        });

        it('should have password input of type password', () => {
            renderWithRouter(<CertifierLogin />);

            const passwordInput = screen.getByPlaceholderText('••••••••');
            expect(passwordInput).toHaveAttribute('type', 'password');
        });

        it('should not call sign in with empty form', async () => {
            renderWithRouter(<CertifierLogin />);

            const submitButton = screen.getByRole('button', { name: 'Login' });
            fireEvent.click(submitButton);

            // Wait for potential async validation/submission to settle
            await waitFor(() => {
                expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
            });
        });
    });

    describe('Login Flow', () => {
        it('should call signInWithEmailAndPassword on submit', async () => {
            renderWithRouter(<CertifierLogin />);

            const emailInput = screen.getByPlaceholderText('nom@organisme-certif.com');
            const passwordInput = screen.getByPlaceholderText('••••••••');
            const submitButton = screen.getByRole('button', { name: 'Login' });

            fireEvent.change(emailInput, { target: { value: 'test@certifier.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
            });
        });

        it('should show success toast on successful login', async () => {
            renderWithRouter(<CertifierLogin />);

            const emailInput = screen.getByPlaceholderText('nom@organisme-certif.com');
            const passwordInput = screen.getByPlaceholderText('••••••••');
            const submitButton = screen.getByRole('button', { name: 'Login' });

            fireEvent.change(emailInput, { target: { value: 'test@certifier.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockToastSuccess).toHaveBeenCalledWith(
                    'Connexion réussie',
                    'Bienvenue sur le portail certificateur'
                );
            });
            // Ensure loading state is cleared before test exits to prevent act warning
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
            });
        });

        it('should navigate to dashboard on successful login', async () => {
            renderWithRouter(<CertifierLogin />);

            const emailInput = screen.getByPlaceholderText('nom@organisme-certif.com');
            const passwordInput = screen.getByPlaceholderText('••••••••');
            const submitButton = screen.getByRole('button', { name: 'Login' });

            fireEvent.change(emailInput, { target: { value: 'test@certifier.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/portal/dashboard');
            });
        });

        it('should show error toast on login failure', async () => {
            mockSignInWithEmailAndPassword.mockRejectedValue(new Error('Auth failed'));

            renderWithRouter(<CertifierLogin />);

            const emailInput = screen.getByPlaceholderText('nom@organisme-certif.com');
            const passwordInput = screen.getByPlaceholderText('••••••••');
            const submitButton = screen.getByRole('button', { name: 'Login' });

            fireEvent.change(emailInput, { target: { value: 'test@certifier.com' } });
            fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith(
                    'Erreur',
                    'Identifiants invalides ou erreur de connexion'
                );
            });
        });
    });

    describe('Loading State', () => {
        it('should disable submit button while loading', async () => {
            // Make sign-in hang to test loading state
            mockSignInWithEmailAndPassword.mockImplementation(() => new Promise(() => { }));

            renderWithRouter(<CertifierLogin />);

            const emailInput = screen.getByPlaceholderText('nom@organisme-certif.com');
            const passwordInput = screen.getByPlaceholderText('••••••••');
            const submitButton = screen.getByRole('button', { name: 'Login' });

            fireEvent.change(emailInput, { target: { value: 'test@certifier.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(submitButton).toBeDisabled();
            });
        });
    });
});
