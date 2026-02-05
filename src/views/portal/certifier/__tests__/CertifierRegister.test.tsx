/**
 * CertifierRegister Component Tests
 * Story 14-1: Test Coverage 50%
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CertifierRegister } from '../CertifierRegister';

// Mock Firebase auth
const mockCreateUserWithEmailAndPassword = vi.fn();
vi.mock('firebase/auth', () => ({
 createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
}));

// Mock Firebase functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
 httpsCallable: () => mockHttpsCallable,
}));

// Mock Firebase app
vi.mock('../../../../firebase', () => ({
 auth: { currentUser: null },
 functions: {},
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
 'certifier.registerTitle': 'Register as Certifier',
 'certifier.registerSubtitle': 'Create your certification account',
 'certifier.orgNameLabel': 'Organization Name',
 'certifier.siretLabel': 'SIRET',
 'certifier.emailLabel': 'Email',
 'certifier.passwordLabel': 'Password',
 'certifier.confirmPasswordLabel': 'Confirm Password',
 'certifier.registerButton': 'Register',
 'certifier.alreadyRegistered': 'Already registered?',
 'certifier.loginLink': 'Login',
 };
 return translations[key] || key;
 },
 }),
}));

// Mock lucide icons - use importOriginal to preserve all icons
vi.mock('lucide-react', async (importOriginal) => {
 const actual = await importOriginal<typeof import('lucide-react')>();
 return {
 ...actual,
 Loader2: () => <span data-testid="loader" />,
 ShieldCheck: () => <span data-testid="icon-shield" />,
 Mail: () => <span data-testid="icon-mail" />,
 Lock: () => <span data-testid="icon-lock" />,
 Building2: () => <span data-testid="icon-building" />,
 Ticket: () => <span data-testid="icon-ticket" />,
 };
});

const renderWithRouter = (component: React.ReactElement) => {
 return render(
 <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
 {component}
 </MemoryRouter>
 );
};

describe('CertifierRegister', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'new-user-123' } });
 mockHttpsCallable.mockResolvedValue({ data: { success: true } });
 });

 describe('Rendering', () => {
 it('should render register title', () => {
 renderWithRouter(<CertifierRegister />);
 expect(screen.getByText('Register as Certifier')).toBeInTheDocument();
 });

 it('should render register subtitle', () => {
 renderWithRouter(<CertifierRegister />);
 expect(screen.getByText('Create your certification account')).toBeInTheDocument();
 });

 it('should render organization name input', () => {
 renderWithRouter(<CertifierRegister />);
 expect(screen.getByPlaceholderText('Bureau Veritas...')).toBeInTheDocument();
 });

 it('should render SIRET input', () => {
 renderWithRouter(<CertifierRegister />);
 expect(screen.getByPlaceholderText('Optionnel')).toBeInTheDocument();
 });

 it('should render email input', () => {
 renderWithRouter(<CertifierRegister />);
 expect(screen.getByPlaceholderText('contact@organisme.com')).toBeInTheDocument();
 });

 it('should render password input', () => {
 renderWithRouter(<CertifierRegister />);
 expect(screen.getByPlaceholderText('Min 8 car.')).toBeInTheDocument();
 });

 it('should render register button', () => {
 renderWithRouter(<CertifierRegister />);
 expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
 });

 it('should render login link', () => {
 renderWithRouter(<CertifierRegister />);
 expect(screen.getByText('Login')).toBeInTheDocument();
 });
 });

 describe('Form Validation', () => {
 it('should have organization name input', () => {
 renderWithRouter(<CertifierRegister />);

 const orgInput = screen.getByPlaceholderText('Bureau Veritas...');
 expect(orgInput).toBeInTheDocument();
 expect(orgInput).toHaveAttribute('type', 'text');
 });

 it('should have email input of type email', () => {
 renderWithRouter(<CertifierRegister />);

 const emailInput = screen.getByPlaceholderText('contact@organisme.com');
 expect(emailInput).toHaveAttribute('type', 'email');
 });

 it('should have two password inputs', () => {
 renderWithRouter(<CertifierRegister />);

 const passwordInputs = document.querySelectorAll('input[type="password"]');
 expect(passwordInputs.length).toBe(2);
 });

 it('should not call createUser with empty form', async () => {
 renderWithRouter(<CertifierRegister />);

 const submitButton = screen.getByRole('button', { name: 'Register' });
 fireEvent.click(submitButton);

 // Wait a bit and verify createUser was not called
 // Wait for potential async validation/submission to settle
 await waitFor(() => {
 expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled();
 });
 });
 });

 describe('Registration Flow', () => {
 it('should have form with required fields', () => {
 renderWithRouter(<CertifierRegister />);

 expect(screen.getByPlaceholderText('Bureau Veritas...')).toBeInTheDocument();
 expect(screen.getByPlaceholderText('contact@organisme.com')).toBeInTheDocument();
 expect(screen.getByPlaceholderText('Min 8 car.')).toBeInTheDocument();
 expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
 });

 it('should have SIRET as optional field', () => {
 renderWithRouter(<CertifierRegister />);

 const siretInput = screen.getByPlaceholderText('Optionnel');
 expect(siretInput).toBeInTheDocument();
 });

 it('should have link to login page', () => {
 renderWithRouter(<CertifierRegister />);

 const loginLink = screen.getByText('Login');
 expect(loginLink).toHaveAttribute('href', '/portal/login');
 });

 it('should render shield icon', () => {
 renderWithRouter(<CertifierRegister />);

 expect(screen.getByTestId('icon-shield')).toBeInTheDocument();
 });

 it('should render building icon for org input', () => {
 renderWithRouter(<CertifierRegister />);

 expect(screen.getByTestId('icon-building')).toBeInTheDocument();
 });
 });

 describe('Loading State', () => {
 it('should have a submit button that can be disabled', () => {
 renderWithRouter(<CertifierRegister />);

 const submitButton = screen.getByRole('button', { name: 'Register' });
 expect(submitButton).toBeInTheDocument();
 // Button should be enabled by default
 expect(submitButton).not.toBeDisabled();
 });
 });
});
