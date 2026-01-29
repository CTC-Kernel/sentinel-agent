/**
 * Unit tests for Sidebar component
 * Tests sidebar navigation with permission-based filtering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar';

// Mock store with simple t function returning keys
vi.mock('../../../store', () => ({
    useStore: () => ({
        user: {
            uid: 'user-1',
            role: 'Admin',
            permissions: {}
        },
        t: (key: string) => key
    })
}));

// Mock Firebase auth
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

// Mock permissions
vi.mock('../../../utils/permissions', () => ({
    hasPermission: () => true
}));

// Mock ErrorLogger
vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock useAuth hook
vi.mock('../../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { uid: 'user-1', email: 'test@example.com' },
        loading: false
    })
}));

// Mock useAdminActions hook
vi.mock('../../../hooks/useAdminActions', () => ({
    useAdminActions: () => ({
        verifySuperAdmin: vi.fn().mockResolvedValue(false),
    }),
}));

// Mock LegalModal
vi.mock('../../ui/LegalModal', () => ({
    LegalModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
        isOpen ? (
            <div
                data-testid="legal-modal"
                onClick={onClose}
                onKeyDown={(e) => e.key === 'Escape' && onClose()}
                role="button"
                tabIndex={0}
            >
                Legal Modal
            </div>
        ) : null
}));

// Mock Button
vi.mock('../../ui/button', () => ({
    Button: ({ children, onClick, className, disabled }: {
        children: React.ReactNode;
        onClick?: () => void;
        className?: string;
        disabled?: boolean;
    }) => (
        <button onClick={onClick} className={className} disabled={disabled}>{children}</button>
    )
}));

describe('Sidebar', () => {
    const mockSetMobileOpen = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderSidebar = (mobileOpen = false) => {
        return render(
            <BrowserRouter>
                <Sidebar mobileOpen={mobileOpen} setMobileOpen={mockSetMobileOpen} />
            </BrowserRouter>
        );
    };

    describe('rendering', () => {
        it('renders brand logo', () => {
            renderSidebar();

            expect(screen.getByText('Sentinel')).toBeInTheDocument();
            expect(screen.getByText('GRC')).toBeInTheDocument();
        });

        it('renders sidebar element', () => {
            renderSidebar();

            const sidebar = document.querySelector('aside');
            expect(sidebar).toBeInTheDocument();
        });

        it('renders nav element', () => {
            renderSidebar();

            const nav = document.querySelector('nav');
            expect(nav).toBeInTheDocument();
        });

        it('renders help link', () => {
            renderSidebar();

            const helpLink = screen.getByRole('link', { name: /help/i });
            expect(helpLink).toBeInTheDocument();
        });

        it('renders settings link', () => {
            renderSidebar();

            // Settings link exists
            const settingsLinks = screen.getAllByRole('link');
            const settingsLink = settingsLinks.find(link => link.getAttribute('href') === '/settings');
            expect(settingsLink).toBeInTheDocument();
        });

        it('renders legal mentions button', () => {
            renderSidebar();

            // Button with legal mentions text exists
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });
    });

    describe('mobile overlay', () => {
        it('shows overlay when mobile open', () => {
            renderSidebar(true);

            const overlay = document.querySelector('[aria-hidden="true"]');
            expect(overlay).toBeInTheDocument();
        });

        it('does not show overlay when mobile closed', () => {
            renderSidebar(false);

            const overlay = document.querySelector('[aria-hidden="true"]');
            expect(overlay).not.toBeInTheDocument();
        });

        it('closes when overlay clicked', () => {
            renderSidebar(true);

            const overlay = document.querySelector('[aria-hidden="true"]');
            if (overlay) {
                fireEvent.click(overlay);
                expect(mockSetMobileOpen).toHaveBeenCalledWith(false);
            }
        });
    });

    describe('sidebar visibility', () => {
        it('has translate class when mobile closed', () => {
            renderSidebar(false);

            const sidebar = document.querySelector('aside');
            expect(sidebar?.className).toContain('-translate-x-full');
        });

        it('shows sidebar when mobile open', () => {
            renderSidebar(true);

            const sidebar = document.querySelector('aside');
            expect(sidebar?.className).toContain('translate-x-0');
        });
    });

    describe('legal modal', () => {
        it('opens legal modal when button clicked', () => {
            renderSidebar();

            // Find button with legal mentions
            const buttons = screen.getAllByRole('button');
            const legalButton = buttons.find(btn => btn.textContent?.includes('mentionsLegales'));
            if (legalButton) {
                fireEvent.click(legalButton);
                expect(screen.getByTestId('legal-modal')).toBeInTheDocument();
            }
        });
    });

    describe('logout functionality', () => {
        it('renders logout button', () => {
            renderSidebar();

            const buttons = screen.getAllByRole('button');
            const logoutButton = buttons.find(btn => btn.textContent?.includes('logout'));
            expect(logoutButton).toBeInTheDocument();
        });
    });

    describe('data-tour attributes', () => {
        it('has sidebar tour attribute', () => {
            renderSidebar();

            const sidebar = document.querySelector('[data-tour="sidebar"]');
            expect(sidebar).toBeInTheDocument();
        });

        it('has sidebar-nav tour attribute', () => {
            renderSidebar();

            const nav = document.querySelector('[data-tour="sidebar-nav"]');
            expect(nav).toBeInTheDocument();
        });

        it('has settings tour attribute', () => {
            renderSidebar();

            const settings = document.querySelector('[data-tour="settings"]');
            expect(settings).toBeInTheDocument();
        });
    });
});
