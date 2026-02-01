/**
 * Unit tests for SecurityDashboard component
 * Tests BMAD security dashboard display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SecurityDashboard, SecurityWidgetCompact } from '../SecurityDashboard';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) || key,
        i18n: { language: 'en', changeLanguage: vi.fn() }
    }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock SessionMonitor
vi.mock('../../../services/sessionMonitoringService', () => ({
    SessionMonitor: {
        getMetrics: vi.fn(() => ({
            sessionDuration: 3600000, // 1 hour
            activityCount: 42,
            idleTime: 300000, // 5 minutes
            lastActivity: Date.now()
        })),
        getAnomalies: vi.fn(() => [
            {
                type: 'RAPID_ACTIONS',
                severity: 'medium',
                message: 'Rapid clicking detected',
                timestamp: Date.now()
            }
        ]),
        getCriticalAnomaliesCount: vi.fn(() => 0)
    }
}));

// Mock ErrorLogger
vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

describe('SecurityDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('loading state', () => {
        it('shows loading message initially', () => {
            render(<SecurityDashboard />);

            expect(screen.getByText('Chargement des métriques de sécurité...')).toBeInTheDocument();
        });
    });

    describe('after loading', () => {
        it('renders dashboard header', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Tableau de bord Sécurité BMAD')).toBeInTheDocument();
            });
        });

        it('renders health score', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Health Score')).toBeInTheDocument();
            });
        });

        it('renders session duration', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Durée de session')).toBeInTheDocument();
            });

            await waitFor(() => {
                // Duration appears in both metric card and session info
                expect(screen.getAllByText('1h 0m').length).toBeGreaterThan(0);
            });
        });

        it('renders activity count', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Activités')).toBeInTheDocument();
            });

            await waitFor(() => {
                // Activity count appears in both metric card and session info
                expect(screen.getAllByText('42').length).toBeGreaterThan(0);
            });
        });

        it('renders anomalies section', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Anomalies Détectées (24h)')).toBeInTheDocument();
            });
        });

        it('renders anomaly details', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                expect(screen.getByText('RAPID ACTIONS')).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(screen.getByText('Rapid clicking detected')).toBeInTheDocument();
            });
        });

        it('renders session info section', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Informations de Session')).toBeInTheDocument();
            });
        });

        it('renders recommendations section', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                expect(screen.getByText(/Recommandations/)).toBeInTheDocument();
            });
        });
    });

    describe('health score calculation', () => {
        it('shows high health score when no critical anomalies', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                // With only medium anomaly, score should be 95 (100 - 5)
                expect(screen.getByText('95%')).toBeInTheDocument();
            });
        });
    });

    describe('idle time display', () => {
        it('renders idle time', async () => {
            render(<SecurityDashboard />);

            await waitFor(() => {
                expect(screen.getByText("Temps d'inactivité")).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(screen.getByText('5m 0s')).toBeInTheDocument();
            });
        });
    });
});

describe('SecurityWidgetCompact', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows security OK when no critical anomalies', async () => {
        render(<SecurityWidgetCompact />);

        await waitFor(() => {
            expect(screen.getByText('Sécurité OK')).toBeInTheDocument();
        });
    });

    it('shows alert count when critical anomalies exist', async () => {
        const { SessionMonitor } = await import('../../../services/sessionMonitoringService');
        vi.mocked(SessionMonitor.getCriticalAnomaliesCount).mockReturnValue(3);

        render(<SecurityWidgetCompact />);

        await waitFor(() => {
            expect(screen.getByText('3 alerte(s)')).toBeInTheDocument();
        });
    });
});
