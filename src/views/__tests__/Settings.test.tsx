
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../Settings';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        t: (k: string) => k
    }),
}));


vi.mock('../../hooks/usePersistedState', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        usePersistedState: (_key: string, defaultVal: unknown) => React.useState(defaultVal)
    };
});

// Mock Child Components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => null
}));
vi.mock('../../components/SEO', () => ({
    SEO: () => null
}));
vi.mock('../../components/settings/SettingsLayout', () => ({
    SettingsLayout: ({ children, currentTab: _currentTab, onTabChange }: { children: React.ReactNode, currentTab: string, onTabChange: (tab: string) => void }) => (
        <div>
            <div data-testid="settings-tabs">
                <button aria-label="Profile" onClick={() => onTabChange('profile')}>Profile</button>
                <button aria-label="Organization" onClick={() => onTabChange('organization')}>Organization</button>
            </div>
            {children}
        </div>
    )
}));

vi.mock('../../components/settings/ProfileSettings', () => ({
    ProfileSettings: () => <div data-testid="profile-settings" />
}));
vi.mock('../../components/settings/OrganizationSettings', () => ({
    OrganizationSettings: () => <div data-testid="organization-settings" />
}));
vi.mock('../../components/settings/UserActivityLog', () => ({
    UserActivityLog: () => <div data-testid="user-activity-log" />
}));
vi.mock('../../components/settings/SecuritySettings', () => ({
    SecuritySettings: () => <div data-testid="security-settings" />
}));
vi.mock('../../components/settings/IntegrationSettings', () => ({
    IntegrationSettings: () => <div data-testid="integration-settings" />
}));
vi.mock('../../components/settings/SystemSettings', () => ({
    SystemSettings: () => <div data-testid="system-settings" />
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe('Settings View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders profile settings by default', () => {
        render(
            <MemoryRouter>
                <Settings />
            </MemoryRouter>
        );

        expect(screen.getByTestId('profile-settings')).toBeInTheDocument();
    });


    it('switches to organization settings', () => {
        render(
            <MemoryRouter>
                <Settings />
            </MemoryRouter>
        );

        const orgTab = screen.getByText('Organization');
        fireEvent.click(orgTab);

        expect(screen.getByTestId('organization-settings')).toBeInTheDocument();
    });
});
