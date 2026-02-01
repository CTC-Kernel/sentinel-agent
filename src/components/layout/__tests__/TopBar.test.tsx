/**
 * Unit tests for TopBar component
 * Tests top navigation bar with user menu and actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TopBar } from '../TopBar';

// Mock dependencies
vi.mock('../../../store', () => ({
    useStore: () => ({
        theme: 'light',
        toggleTheme: vi.fn(),
        user: {
            uid: 'user-1',
            displayName: 'John Doe',
            email: 'john@example.com',
            role: 'Admin'
        },
        t: (key: string, options?: Record<string, unknown>) => {
            if (typeof options === 'string') return options;
            if (options?.defaultValue) return options.defaultValue as string;
            return key;
        },
        language: 'fr',
        setLanguage: vi.fn()
    })
}));

vi.mock('../../../hooks/team/useTeamData', () => ({
    useTeamData: () => ({
        updateUser: vi.fn()
    })
}));

vi.mock('../../../firebase', () => ({
    auth: {
        currentUser: {
            getIdTokenResult: vi.fn().mockResolvedValue({
                claims: { superAdmin: false }
            })
        }
    }
}));

vi.mock('firebase/auth', () => ({
    signOut: vi.fn()
}));

vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

vi.mock('../../notifications/NotificationCenter', () => ({
    NotificationCenter: () => <div data-testid="notification-center">Notifications</div>
}));

vi.mock('../../ui/Breadcrumbs', () => ({
    Breadcrumbs: () => <div data-testid="breadcrumbs">Breadcrumbs</div>
}));

vi.mock('../../ui/FeedbackModal', () => ({
    FeedbackModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
        isOpen ? (
            <div
                data-testid="feedback-modal"
                onClick={onClose}
                onKeyDown={(e) => e.key === 'Escape' && onClose()}
                role="button"
                tabIndex={0}
            >
                Feedback Modal
            </div>
        ) : null
}));

vi.mock('../../ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('../../ui/SyncIndicator', () => ({
    SyncIndicator: () => <div data-testid="sync-indicator">Sync</div>
}));

vi.mock('../../ui/PlanIndicator', () => ({
    PlanIndicator: () => <div data-testid="plan-indicator">Plan</div>
}));

vi.mock('../../../utils/avatarUtils', () => ({
    getDefaultAvatarUrl: () => 'https://example.com/avatar.png'
}));

describe('TopBar', () => {
    const mockSetMobileOpen = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderTopBar = () => {
        return render(
            <BrowserRouter>
                <TopBar setMobileOpen={mockSetMobileOpen} mobileOpen={false} />
            </BrowserRouter>
        );
    };

    describe('rendering', () => {
        it('renders mobile menu button', () => {
            renderTopBar();

            expect(screen.getByLabelText('Ouvrir le menu mobile')).toBeInTheDocument();
        });

        it('renders breadcrumbs', () => {
            renderTopBar();

            expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
        });

        it('renders search button with keyboard shortcut', () => {
            renderTopBar();

            expect(screen.getByLabelText('Rechercher (Cmd+K)')).toBeInTheDocument();
        });

        it('renders notification center', () => {
            renderTopBar();

            expect(screen.getByTestId('notification-center')).toBeInTheDocument();
        });

        it('renders theme toggle button', () => {
            renderTopBar();

            expect(screen.getByLabelText('Toggle Theme')).toBeInTheDocument();
        });

        it('renders user menu button', () => {
            renderTopBar();

            expect(screen.getByLabelText('Menu utilisateur')).toBeInTheDocument();
        });

        it('renders user display name', () => {
            renderTopBar();

            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        it('renders user role', () => {
            renderTopBar();

            expect(screen.getByText('Admin')).toBeInTheDocument();
        });

        it('renders plan indicator', () => {
            renderTopBar();

            expect(screen.getByTestId('plan-indicator')).toBeInTheDocument();
        });

        it('renders sync indicator', () => {
            renderTopBar();

            expect(screen.getByTestId('sync-indicator')).toBeInTheDocument();
        });
    });

    describe('mobile menu', () => {
        it('calls setMobileOpen when mobile menu button clicked', () => {
            renderTopBar();

            fireEvent.click(screen.getByLabelText('Ouvrir le menu mobile'));

            expect(mockSetMobileOpen).toHaveBeenCalledWith(true);
        });
    });

    describe('user menu', () => {
        it('shows user menu when profile clicked', () => {
            renderTopBar();

            fireEvent.click(screen.getByLabelText('Menu utilisateur'));

            expect(screen.getByText('settings.myProfile')).toBeInTheDocument();
        });

        it('shows logout option in user menu', () => {
            renderTopBar();

            fireEvent.click(screen.getByLabelText('Menu utilisateur'));

            expect(screen.getByLabelText('Se déconnecter')).toBeInTheDocument();
        });

        it('shows settings link in user menu', () => {
            renderTopBar();

            fireEvent.click(screen.getByLabelText('Menu utilisateur'));

            expect(screen.getByText('common.settings.title')).toBeInTheDocument();
        });

        it('shows language switch option', () => {
            renderTopBar();

            fireEvent.click(screen.getByLabelText('Menu utilisateur'));

            expect(screen.getByText('Switch to English')).toBeInTheDocument();
        });

        it('shows feedback option', () => {
            renderTopBar();

            fireEvent.click(screen.getByLabelText('Menu utilisateur'));

            expect(screen.getByLabelText('Donner un avis')).toBeInTheDocument();
        });

        it('shows pricing link', () => {
            renderTopBar();

            fireEvent.click(screen.getByLabelText('Menu utilisateur'));

            expect(screen.getByText('settings.plansAndBilling')).toBeInTheDocument();
        });
    });

    describe('feedback modal', () => {
        it('opens feedback modal when feedback button clicked', () => {
            renderTopBar();

            fireEvent.click(screen.getByLabelText('Menu utilisateur'));
            fireEvent.click(screen.getByLabelText('Donner un avis'));

            expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
        });
    });
});
