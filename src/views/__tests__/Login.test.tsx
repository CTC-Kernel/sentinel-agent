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

// Mock Firebase Functions
vi.mock('firebase/functions', () => {
    const mockHttpsCallable = vi.fn(() => vi.fn().mockResolvedValue({ data: {} }));
    return {
        getFunctions: vi.fn(),
        httpsCallable: mockHttpsCallable,
    };
});

// Mock Local Firebase Module
vi.mock('../../firebase', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../firebase')>();
    const mockAuth = {
        currentUser: null,
        signOut: vi.fn(),
        onAuthStateChanged: vi.fn((cb) => {
            cb(null);
            return vi.fn(); // Unsubscribe
        })
    };

    return {
        ...actual,
        __esModule: true,
        auth: mockAuth,
        functions: {},
        analytics: { app: {} },
        isAppCheckFailed: false,
        debugGetAppCheckTokenSnippet: vi.fn(),
        default: {
            ...actual,
            auth: mockAuth,
            functions: {},
            analytics: { app: {} },
        }
    };
});

// Mock Store
vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        addToast: vi.fn(),
        t: (k: string) => k,
        language: 'fr',
    }),
}));

// Mock useLocale to provide the required locale data
vi.mock('../../hooks/useLocale', () => ({
    useLocale: () => ({
        locale: 'fr',
        dateFnsLocale: require('date-fns/locale/fr'),
        zodMessages: {
            required: 'Ce champ est requis',
            invalidType: 'Type de valeur invalide',
            invalidString: 'Ce champ doit être du texte',
            tooShort: (min: number) => `Minimum ${min} caractères requis`,
            tooLong: (max: number) => `Maximum ${max} caractères autorisés`,
            invalidEmail: 'Adresse email invalide',
            invalidUrl: 'URL invalide',
            invalidUuid: 'Identifiant invalide',
            invalidRegex: 'Format invalide',
            invalidNumber: 'Veuillez entrer un nombre valide',
            notInteger: 'Veuillez entrer un nombre entier',
            tooSmall: (min: number) => `La valeur doit être au moins ${min}`,
            tooBig: (max: number) => `La valeur doit être au maximum ${max}`,
            notPositive: 'La valeur doit être positive',
            notNegative: 'La valeur doit être négative',
            notNonNegative: 'La valeur ne peut pas être négative',
            invalidDate: 'Date invalide',
            arrayTooShort: (min: number) => `Sélectionnez au moins ${min} élément${min > 1 ? 's' : ''}`,
            arrayTooLong: (max: number) => `Maximum ${max} élément${max > 1 ? 's' : ''} autorisé${max > 1 ? 's' : ''}`,
            invalidEnum: (options: string[]) => `Valeur invalide. Options: ${options.join(', ')}`,
            custom: 'Valeur invalide',
        },
        formatDate: (date: Date) => date.toLocaleDateString('fr-FR'),
        formatNumber: (num: number) => num.toLocaleString('fr-FR'),
    }),
}));

// Mock UI Components
vi.mock('../../components/ui/AuroraBackground', () => ({
    AuroraBackground: ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={className} data-testid="aurora-bg">{children}</div>
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
        div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Import mocks
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

describe('Login View', () => {
    beforeEach(() => {
        // Mock matchMedia for ThemeToggle
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(), // deprecated
                removeListener: vi.fn(), // deprecated
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });

        vi.clearAllMocks();
    });

    it('renders login form by default', async () => {
        render(
            <MemoryRouter>
                <Login skipBoot={true} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText('auth.email')).toBeInTheDocument();
        });

        expect(screen.getByLabelText('auth.password')).toBeInTheDocument();
        expect(screen.getByText('auth.login')).toBeInTheDocument();
        expect(screen.getByText('auth.google')).toBeInTheDocument();
        expect(screen.getByText('auth.apple')).toBeInTheDocument();
    });

    it('switches to signup form', async () => {
        render(
            <MemoryRouter>
                <Login skipBoot={true} />
            </MemoryRouter>
        );

        await waitFor(() => screen.getByLabelText('auth.email'));

        fireEvent.click(screen.getByText('auth.switchSignup'));

        await waitFor(() => {
            expect(screen.getByText('auth.signup')).toBeInTheDocument();
        });

        expect(screen.getByText('auth.switchLogin')).toBeInTheDocument();
    });

    it('submits login form with valid data', async () => {
        render(
            <MemoryRouter>
                <Login skipBoot={true} />
            </MemoryRouter>
        );

        await waitFor(() => screen.getByLabelText('auth.email'));

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
                <Login skipBoot={true} />
            </MemoryRouter>
        );

        await waitFor(() => screen.getByLabelText('auth.email'));

        fireEvent.click(screen.getByText('auth.switchSignup'));

        await waitFor(() => {
            expect(screen.getByText('auth.signup')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('auth.email'), { target: { value: 'new@example.com' } });
        fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'newpass123' } });

        fireEvent.click(screen.getByText('auth.signup'));

        await waitFor(() => {
            expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'new@example.com', 'newpass123');
        });
    });

    it('opens reset password modal', async () => {
        render(
            <MemoryRouter>
                <Login skipBoot={true} />
            </MemoryRouter>
        );

        await waitFor(() => screen.getByLabelText('auth.email'));

        fireEvent.click(screen.getByText('auth.forgotPassword'));

        await waitFor(() => {
            expect(screen.getByText('auth.reset.title')).toBeInTheDocument();
        });
    });
});

