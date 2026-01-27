/**
 * SessionMonitoringService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase
vi.mock('../../firebase', () => ({
    auth: {
        currentUser: { uid: 'user-123', email: 'test@example.com' },
        signOut: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('SessionMonitoringService', () => {
    let SessionMonitor: typeof import('../sessionMonitoringService').SessionMonitor;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        // Clear localStorage
        localStorage.clear();

        // Import fresh module
        const module = await import('../sessionMonitoringService');
        SessionMonitor = module.SessionMonitor;
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('initSession', () => {
        it('should initialize session for valid user', () => {
            const user = {
                uid: 'user-123',
                email: 'test@example.com'
            } as import('firebase/auth').User;

            SessionMonitor.initSession(user);

            const stored = localStorage.getItem('session_info');
            expect(stored).toBeTruthy();

            const session = JSON.parse(stored!);
            expect(session.userId).toBe('user-123');
            expect(session.email).toBe('test@example.com');
        });

        it('should clear session for null user', () => {
            // First set up a session
            localStorage.setItem('session_info', JSON.stringify({ userId: 'old-user' }));

            SessionMonitor.initSession(null);

            expect(localStorage.getItem('session_info')).toBeNull();
        });

        it('should detect concurrent sessions', async () => {
            const { ErrorLogger } = await import('../errorLogger');

            // Set up existing session
            localStorage.setItem('session_info', JSON.stringify({
                userId: 'user-old',
                email: 'old@example.com',
                loginTime: Date.now(),
                lastActivity: Date.now(),
                activityCount: 5
            }));

            const newUser = {
                uid: 'user-new',
                email: 'new@example.com'
            } as import('firebase/auth').User;

            SessionMonitor.initSession(newUser);

            // Should have reported an anomaly
            expect(ErrorLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Anomalie de session'),
                'SessionMonitoring',
                expect.any(Object)
            );
        });
    });

    describe('recordActivity', () => {
        it('should update activity count', () => {
            const user = {
                uid: 'user-123',
                email: 'test@example.com'
            } as import('firebase/auth').User;

            SessionMonitor.initSession(user);

            const initialSession = JSON.parse(localStorage.getItem('session_info')!);
            const initialCount = initialSession.activityCount;

            SessionMonitor.recordActivity();

            const updatedSession = JSON.parse(localStorage.getItem('session_info')!);
            expect(updatedSession.activityCount).toBe(initialCount + 1);
        });
    });

    describe('setIdleTimeout', () => {
        it('should set idle timeout', async () => {
            const { ErrorLogger } = await import('../errorLogger');

            SessionMonitor.setIdleTimeout(30 * 60 * 1000); // 30 minutes

            expect(ErrorLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('30 minutes'),
                'SessionMonitoring'
            );
        });
    });

    describe('checkLocationChange', () => {
        it('should record first location', () => {
            const user = {
                uid: 'user-123',
                email: 'test@example.com'
            } as import('firebase/auth').User;

            SessionMonitor.initSession(user);
            SessionMonitor.checkLocationChange('Paris, France');

            const session = JSON.parse(localStorage.getItem('session_info')!);
            expect(session.location).toBe('Paris, France');
        });

        it('should detect suspicious location change', async () => {
            const { ErrorLogger } = await import('../errorLogger');

            const user = {
                uid: 'user-123',
                email: 'test@example.com'
            } as import('firebase/auth').User;

            SessionMonitor.initSession(user);

            // Set initial location
            const session = JSON.parse(localStorage.getItem('session_info')!);
            session.location = 'Paris, France';
            session.loginTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
            localStorage.setItem('session_info', JSON.stringify(session));

            // Change to a different location
            SessionMonitor.checkLocationChange('New York, USA');

            // Should have reported critical anomaly
            expect(ErrorLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Anomalie de session'),
                'SessionMonitoring',
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        type: 'location_change'
                    })
                })
            );
        });
    });

    describe('onRoleChange', () => {
        it('should report role change anomaly', async () => {
            const { ErrorLogger } = await import('../errorLogger');

            SessionMonitor.onRoleChange('admin');

            expect(ErrorLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Anomalie de session'),
                'SessionMonitoring',
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        type: 'role_change'
                    })
                })
            );
        });
    });

    describe('validateSession', () => {
        it('should return false when no session', () => {
            const result = SessionMonitor.validateSession();
            expect(result).toBe(false);
        });

        it('should return true for valid session', () => {
            const user = {
                uid: 'user-123',
                email: 'test@example.com'
            } as import('firebase/auth').User;

            SessionMonitor.initSession(user);

            const result = SessionMonitor.validateSession();
            expect(result).toBe(true);
        });
    });

    describe('getAnomalies', () => {
        it('should return empty array when no anomalies', () => {
            const anomalies = SessionMonitor.getAnomalies();
            expect(anomalies).toEqual([]);
        });

        it('should return stored anomalies', () => {
            localStorage.setItem('session_anomalies', JSON.stringify([
                { type: 'test', severity: 'low', message: 'Test', timestamp: Date.now() }
            ]));

            const anomalies = SessionMonitor.getAnomalies();
            expect(anomalies).toHaveLength(1);
            expect(anomalies[0].type).toBe('test');
        });
    });

    describe('getCriticalAnomaliesCount', () => {
        it('should return 0 when no critical anomalies', () => {
            localStorage.setItem('session_anomalies', JSON.stringify([
                { type: 'test', severity: 'low', message: 'Test', timestamp: Date.now() }
            ]));

            const count = SessionMonitor.getCriticalAnomaliesCount();
            expect(count).toBe(0);
        });

        it('should count critical anomalies', () => {
            localStorage.setItem('session_anomalies', JSON.stringify([
                { type: 'test1', severity: 'critical', message: 'Critical 1', timestamp: Date.now() },
                { type: 'test2', severity: 'low', message: 'Low', timestamp: Date.now() },
                { type: 'test3', severity: 'critical', message: 'Critical 2', timestamp: Date.now() }
            ]));

            const count = SessionMonitor.getCriticalAnomaliesCount();
            expect(count).toBe(2);
        });
    });

    describe('cleanupOldAnomalies', () => {
        it('should remove old anomalies', () => {
            const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
            const recentTimestamp = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago

            localStorage.setItem('session_anomalies', JSON.stringify([
                { type: 'old', severity: 'low', message: 'Old', timestamp: oldTimestamp },
                { type: 'recent', severity: 'low', message: 'Recent', timestamp: recentTimestamp }
            ]));

            SessionMonitor.cleanupOldAnomalies();

            const anomalies = SessionMonitor.getAnomalies();
            expect(anomalies).toHaveLength(1);
            expect(anomalies[0].type).toBe('recent');
        });
    });

    describe('clearSession', () => {
        it('should clear session data', () => {
            const user = {
                uid: 'user-123',
                email: 'test@example.com'
            } as import('firebase/auth').User;

            SessionMonitor.initSession(user);
            expect(localStorage.getItem('session_info')).toBeTruthy();

            SessionMonitor.clearSession();
            expect(localStorage.getItem('session_info')).toBeNull();
        });
    });

    describe('getMetrics', () => {
        it('should return null when no session', () => {
            const metrics = SessionMonitor.getMetrics();
            expect(metrics).toBeNull();
        });

        it('should return metrics for active session', () => {
            const user = {
                uid: 'user-123',
                email: 'test@example.com'
            } as import('firebase/auth').User;

            SessionMonitor.initSession(user);

            const metrics = SessionMonitor.getMetrics();
            expect(metrics).toBeTruthy();
            expect(metrics!.activityCount).toBeGreaterThan(0);
            expect(metrics!.sessionDuration).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('useSessionMonitoring', () => {
    it('should export hook', async () => {
        const { useSessionMonitoring } = await import('../sessionMonitoringService');
        expect(typeof useSessionMonitoring).toBe('function');
    });

    it('should initialize session when user provided', async () => {
        const { useSessionMonitoring, SessionMonitor } = await import('../sessionMonitoringService');

        const initSpy = vi.spyOn(SessionMonitor, 'initSession');

        const user = {
            uid: 'user-123',
            email: 'test@example.com'
        } as import('firebase/auth').User;

        useSessionMonitoring(user);

        // initSession now accepts optional organizationId parameter
        expect(initSpy).toHaveBeenCalledWith(user, undefined);
        initSpy.mockRestore();
    });
});
