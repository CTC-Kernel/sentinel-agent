/**
 * Integrations View Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: (props: React.ComponentProps<'div'>) => React.createElement('div', props)
    }
}));

// Mock store
vi.mock('../../store', () => ({
    useStore: () => ({
        user: { uid: 'user-1', organizationId: 'org-1', permissions: { Integration: { manage: true } } },
        demoMode: false,
        t: (key: string) => {
            const translations: Record<string, string> = {
                'integrations.title': 'Intégrations',
                'integrations.seo.title': 'Intégrations',
                'integrations.seo.description': 'Gérez vos intégrations et connecteurs',
            };
            return translations[key] || key;
        }
    })
}));

// Mock permissions
vi.mock('../../utils/permissions', () => ({
    hasPermission: () => true
}));

// Mock integrationService
vi.mock('../../services/integrationService', () => ({
    integrationService: {
        getProviders: vi.fn().mockResolvedValue([
            { id: 'aws', name: 'AWS', description: 'Amazon Web Services', category: 'cloud', status: 'disconnected' },
            { id: 'github', name: 'GitHub', description: 'Code repository', category: 'code', status: 'connected' }
        ]),
        connectProvider: vi.fn().mockResolvedValue(undefined),
        disconnectProvider: vi.fn().mockResolvedValue(undefined),
        triggerN8nWorkflow: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock toast
vi.mock('@/lib/toast', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        promise: vi.fn()
    }
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'integrations.title': 'Intégrations',
                'integrations.seo.title': 'Intégrations',
                'integrations.seo.description': 'Gérez vos intégrations et connecteurs',
            };
            return translations[key] || key;
        },
        i18n: { language: 'fr' }
    }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock usePersistedState
vi.mock('../../hooks/usePersistedState', () => ({
    usePersistedState: () => ['providers', vi.fn()]
}));

// Mock components - use createElement to avoid JSX hoisting issues
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => React.createElement('div', { 'data-testid': 'masterpiece-background' })
}));

vi.mock('../../components/SEO', () => ({
    SEO: ({ title }: { title: string }) => React.createElement('div', { 'data-testid': 'seo', 'data-title': title })
}));

vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title: string }) => React.createElement('div', { 'data-testid': 'page-header' },
        React.createElement('h1', null, title)
    )
}));

vi.mock('../../components/ui/animationVariants', () => ({
    staggerContainerVariants: {}
}));

vi.mock('../../components/ui/Modal', () => ({
    Modal: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) =>
        isOpen ? React.createElement('div', { 'data-testid': 'modal', 'data-title': title }, children) : null
}));

vi.mock('../../components/ui/FloatingLabelInput', () => ({
    FloatingLabelInput: ({ label, onChange }: { label: string; onChange: (e: { target: { value: string } }) => void }) =>
        React.createElement('input', {
            'data-testid': 'api-key-input',
            'aria-label': label,
            onChange: onChange
        })
}));

vi.mock('../../components/integrations/IntegrationCard', () => ({
    IntegrationCard: ({ provider, onConnect, onDisconnect }: {
        provider: { id: string; name: string };
        onConnect: (p: { id: string; name: string }) => void;
        onDisconnect: (p: { id: string; name: string }) => void;
    }) => React.createElement('div', { 'data-testid': `integration-card-${provider.id}` },
        React.createElement('span', null, provider.name),
        React.createElement('button', { onClick: () => onConnect(provider) }, 'Connect'),
        React.createElement('button', { onClick: () => onDisconnect(provider) }, 'Disconnect')
    )
}));

vi.mock('../../components/integrations/ScannerJobs', () => ({
    ScannerJobs: () => React.createElement('div', { 'data-testid': 'scanner-jobs' }, 'Scanner Jobs')
}));

// Import component after mocks
import { Integrations } from '../Integrations';

describe('Integrations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Integrations />
            </BrowserRouter>
        );
    };

    it('should render SEO component', async () => {
        renderComponent();

        await waitFor(() => {
            // SEO receives the i18n key, the mock translates it
            const seo = screen.getByTestId('seo');
            expect(seo).toBeInTheDocument();
        });
    });

    it('should render MasterpieceBackground', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
        });
    });

    it('should render page header', async () => {
        renderComponent();

        await waitFor(() => {
            // PageHeader receives the i18n key and displays the translated title
            expect(screen.getByTestId('page-header')).toBeInTheDocument();
        });
    });

    it('should load and display providers', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('AWS')).toBeInTheDocument();
            expect(screen.getByText('GitHub')).toBeInTheDocument();
        });
    });

    it('should render tab buttons', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByLabelText('Connecteurs')).toBeInTheDocument();
            expect(screen.getByLabelText('Tâches & Scans')).toBeInTheDocument();
        });
    });

    it('should render category filter buttons', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByLabelText('Tout')).toBeInTheDocument();
            expect(screen.getByLabelText('Cloud')).toBeInTheDocument();
            expect(screen.getByLabelText('Code')).toBeInTheDocument();
            expect(screen.getByLabelText('Sécurité')).toBeInTheDocument();
        });
    });

    it('should render search input', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByLabelText('Rechercher une intégration')).toBeInTheDocument();
        });
    });

    it('should open modal when connecting provider', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('AWS')).toBeInTheDocument();
        });

        const connectButtons = screen.getAllByText('Connect');
        fireEvent.click(connectButtons[0]);

        await waitFor(() => {
            expect(screen.getByTestId('modal')).toBeInTheDocument();
        });
    });
});
