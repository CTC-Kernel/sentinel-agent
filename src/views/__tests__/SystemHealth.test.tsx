/**
 * SystemHealth Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SystemHealth } from '../SystemHealth';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'systemHealth.title': 'État du Système',
                'systemHealth.subtitle': 'Tableau de bord de supervision technique et disponibilité des services.',
                'common.administration': 'Administration',
                'systemHealth.metrics.activeUsers': 'Utilisateurs Actifs',
                'systemHealth.metrics.totalAccounts': 'Comptes total',
                'systemHealth.metrics.systemLoad': 'Charge Système',
                'systemHealth.metrics.cpuUsage': 'Usage vCPU',
                'systemHealth.metrics.memory': 'Mémoire',
                'systemHealth.metrics.ramAllocated': 'RAM Allouée',
                'systemHealth.metrics.latency': 'Latence',
                'systemHealth.metrics.globalPing': 'Ping Global',
                'systemHealth.servicesStatus': 'État des Services',
                'systemHealth.operational': 'Systèmes Opérationnels',
                'systemHealth.recentAlerts': 'Alertes Récentes (Dernières 24h)',
                'systemHealth.alerts.networkLatency': 'Latence Réseau Élevée (Europe-West)',
                'systemHealth.alerts.networkLatencyDesc': 'Pic de latence à 145ms détecté à 14:00. Résolu automatiquement.',
                'systemHealth.alerts.backupComplete': 'Sauvegarde Automatique Complète',
                'systemHealth.alerts.backupCompleteDesc': 'Backup chiffré #GH-9082 validé et archivé.',
                'systemHealth.alerts.twoHoursAgo': 'Il y a 2h',
                'systemHealth.alerts.fourHoursAgo': 'Il y a 4h'
            };
            return translations[key] || key;
        }
    })
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) =>
            <div {...props}>{children}</div>
    }
}));

// Mock store
const mockUser = {
    id: 'user-1',
    role: 'admin',
    permissions: { SystemLog: { read: true } }
};

vi.mock('../../store', () => ({
    useStore: () => ({user: mockUser,
        t: (key: string, options?: Record<string, unknown>) => {
            if (options && 'defaultValue' in options) {
                return (options as { defaultValue?: string }).defaultValue || key;
            }
            return key;
        }})
}));

// Mock permissions
vi.mock('../../utils/permissions', () => ({
    hasPermission: () => true
}));

// Mock useSystemHealth hook
vi.mock('../../hooks/useSystemHealth', () => ({
    useSystemHealth: () => ({
        userCount: 42,
        loading: false,
        metrics: {
            systemLoad: 35.5,
            memoryUsage: 68.2,
            networkLatency: 45
        }
    })
}));

// Mock useConnectivity hook
vi.mock('../../hooks/useConnectivity', () => ({
    useConnectivity: () => ({
        authStatus: 'operational',
        dbStatus: 'operational',
        storageStatus: 'operational',
        edgeStatus: 'operational'
    })
}));

// Mock components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title: string }) => (
        <div data-testid="page-header">
            <h1>{title}</h1>
        </div>
    )
}));

vi.mock('../../components/ui/animationVariants', () => ({
    slideUpVariants: {},
    staggerContainerVariants: {}
}));

describe('SystemHealth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <SystemHealth />
            </BrowserRouter>
        );
    };

    it('should render MasterpieceBackground', () => {
        renderComponent();

        expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
    });

    it('should render page header with title', () => {
        renderComponent();

        expect(screen.getByText('État du Système')).toBeInTheDocument();
    });

    it('should display user count metric', () => {
        renderComponent();

        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('Utilisateurs Actifs')).toBeInTheDocument();
    });

    it('should display system load metric', () => {
        renderComponent();

        expect(screen.getByText('36%')).toBeInTheDocument();
        expect(screen.getByText('Charge Système')).toBeInTheDocument();
    });

    it('should display memory usage metric', () => {
        renderComponent();

        expect(screen.getByText('68%')).toBeInTheDocument();
        expect(screen.getByText('Mémoire')).toBeInTheDocument();
    });

    it('should display network latency metric', () => {
        renderComponent();

        expect(screen.getByText('45ms')).toBeInTheDocument();
        expect(screen.getByText('Latence')).toBeInTheDocument();
    });

    it('should display services section', () => {
        renderComponent();

        expect(screen.getByText('État des Services')).toBeInTheDocument();
    });

    it('should display service names', () => {
        renderComponent();

        expect(screen.getByText('Firebase Auth')).toBeInTheDocument();
        expect(screen.getByText('Cloud Firestore')).toBeInTheDocument();
        expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
        expect(screen.getByText('Edge Functions')).toBeInTheDocument();
        expect(screen.getByText('CDN Global')).toBeInTheDocument();
        expect(screen.getByText('AI Engine Cyber Threat Consulting')).toBeInTheDocument();
    });

    it('should display alerts section', () => {
        renderComponent();

        expect(screen.getByText('Alertes Récentes (Dernières 24h)')).toBeInTheDocument();
    });

    it('should display alert messages', () => {
        renderComponent();

        expect(screen.getByText(/Latence Réseau Élevée/)).toBeInTheDocument();
        expect(screen.getByText(/Sauvegarde Automatique Complète/)).toBeInTheDocument();
    });
});

describe('SystemHealth service status colors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should display operational status for services', () => {
        render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <SystemHealth />
            </BrowserRouter>
        );

        // All services should show operational status
        const operationalStatuses = screen.getAllByText('operational');
        expect(operationalStatuses.length).toBeGreaterThan(0);
    });

    it('should display uptime percentages', () => {
        render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <SystemHealth />
            </BrowserRouter>
        );

        expect(screen.getAllByText('99.99%').length).toBeGreaterThan(0);
        expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    });
});
