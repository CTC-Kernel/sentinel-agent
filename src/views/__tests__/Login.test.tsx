import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Login } from '../Login';
import { MemoryRouter } from 'react-router-dom';

// Mock Firebase
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    GoogleAuthProvider: vi.fn(),
    OAuthProvider: vi.fn(),
    getRedirectResult: vi.fn(),
    signInWithRedirect: vi.fn(),
    signInWithCredential: vi.fn(),
    getMultiFactorResolver: vi.fn(),
    TotpMultiFactorGenerator: { FACTOR_ID: 'totp' },
    setPersistence: vi.fn(),
    browserLocalPersistence: 'local',
    indexedDBLocalPersistence: 'indexedDb',
    browserSessionPersistence: 'session'
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(),
}));

vi.mock('../../firebase', () => ({
    auth: {},
    functions: {}
}));

// Mock Store
vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        addToast: vi.fn(),
        t: (k: string) => k,
    }),
}));

// Mock UI Components
vi.mock('../../components/ui/AuroraBackground', () => ({
    AuroraBackground: ({ children, className }: any) => <div className={className} data-testid="aurora-bg">{children}</div>
}));
vi.mock('../../components/landing/LandingMap', () => ({
    LandingMap: () => <div data-testid="landing-map" />
}));
vi.mock('../../components/ui/aceternity/Spotlight', () => ({
    Spotlight: () => <div data-testid="spotlight" />
}));
vi.mock('../../components/SEO', () => ({
    SEO: () => <div data-testid="seo-mock" />
}));
vi.mock('../../components/ui/LegalModal', () => ({
    LegalModal: () => <div data-testid="legal-modal" />
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Import mocks
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

describe('Login View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders login form by default', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        expect(screen.getByLabelText('auth.email')).toBeInTheDocument();
        expect(screen.getByLabelText('auth.password')).toBeInTheDocument();
        expect(screen.getByText('auth.login')).toBeInTheDocument();
        expect(screen.getByText('auth.google')).toBeInTheDocument();
        expect(screen.getByText('auth.apple')).toBeInTheDocument();
    });

    it('switches to signup form', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        // Click switch button
        fireEvent.click(screen.getByText('auth.switchSignup'));

        expect(screen.getByText('auth.signup')).toBeInTheDocument();
        // Check if button text changed to switch back
        expect(screen.getByText('auth.switchLogin')).toBeInTheDocument();
    });

    it('submits login form with valid data', async () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText('auth.email'), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'password123' } });

        fireEvent.click(screen.getByText('auth.login'));

        await waitFor(() => {
            expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'test@example.com', 'password123');
        });
    });

    it('submits signup form with valid data', async () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        // Switch to signup
        fireEvent.click(screen.getByText('auth.switchSignup'));

        fireEvent.change(screen.getByLabelText('auth.email'), { target: { value: 'new@example.com' } });
        fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'newpass123' } });

        fireEvent.click(screen.getByText('auth.signup'));

        await waitFor(() => {
            expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'new@example.com', 'newpass123');
        });
    });

    it('opens reset password modal', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('auth.forgot'));
        expect(screen.getByText('auth.reset.title')).toBeInTheDocument();
    });
});
