/**
 * AnalyticsService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase/analytics
vi.mock('firebase/analytics', () => ({
    logEvent: vi.fn()
}));

// Mock firebase
vi.mock('../../firebase', () => ({
    analytics: { app: { name: 'test-app' } }
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        info: vi.fn(),
        warn: vi.fn()
    }
}));

describe('AnalyticsService', () => {
    let analyticsService: typeof import('../analyticsService').analyticsService;
    let mockLogEvent: ReturnType<typeof vi.fn>;
    let mockErrorLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        vi.clearAllMocks();

        // Get the mocked modules
        const firebaseAnalytics = await import('firebase/analytics');
        mockLogEvent = firebaseAnalytics.logEvent as ReturnType<typeof vi.fn>;

        const errorLoggerModule = await import('../errorLogger');
        mockErrorLogger = errorLoggerModule.ErrorLogger as unknown as typeof mockErrorLogger;

        // Re-import service to get fresh instance
        vi.resetModules();

        // Re-mock before importing
        vi.doMock('firebase/analytics', () => ({
            logEvent: vi.fn()
        }));
        vi.doMock('../../firebase', () => ({
            analytics: { app: { name: 'test-app' } }
        }));
        vi.doMock('../errorLogger', () => ({
            ErrorLogger: {
                info: vi.fn(),
                warn: vi.fn()
            }
        }));

        const module = await import('../analyticsService');
        analyticsService = module.analyticsService;

        // Update mock references
        const firebaseAnalyticsNew = await import('firebase/analytics');
        mockLogEvent = firebaseAnalyticsNew.logEvent as ReturnType<typeof vi.fn>;
        const errorLoggerNew = await import('../errorLogger');
        mockErrorLogger = errorLoggerNew.ErrorLogger as unknown as typeof mockErrorLogger;
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('logEvent', () => {
        it('should log event with name and params', () => {
            analyticsService.logEvent('login', { method: 'google' });

            expect(mockLogEvent).toHaveBeenCalledWith(
                expect.anything(),
                'login',
                { method: 'google' }
            );
        });

        it('should log event without params', () => {
            analyticsService.logEvent('view_dashboard');

            expect(mockLogEvent).toHaveBeenCalledWith(
                expect.anything(),
                'view_dashboard',
                undefined
            );
        });

        it('should handle various event names', () => {
            const eventNames = [
                'login',
                'sign_up',
                'create_audit',
                'complete_audit',
                'create_risk',
                'assess_risk',
                'create_incident'
            ] as const;

            eventNames.forEach((eventName) => {
                analyticsService.logEvent(eventName);
            });

            expect(mockLogEvent).toHaveBeenCalledTimes(eventNames.length);
        });

        it('should catch and warn on analytics errors', () => {
            mockLogEvent.mockImplementationOnce(() => {
                throw new Error('Analytics error');
            });

            // Should not throw
            expect(() => {
                analyticsService.logEvent('login');
            }).not.toThrow();

            expect(mockErrorLogger.warn).toHaveBeenCalledWith(
                'Failed to log analytics event',
                'AnalyticsService.logEvent',
                expect.any(Object)
            );
        });
    });

    describe('setUserId', () => {
        it('should accept userId without throwing', () => {
            expect(() => {
                analyticsService.setUserId('user-123');
            }).not.toThrow();
        });
    });
});
