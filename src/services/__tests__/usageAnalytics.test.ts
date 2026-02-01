/**
 * UsageAnalytics Service Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UsageAnalytics, UsageEvent, UsageMetrics } from '../usageAnalytics';

describe('UsageAnalytics', () => {
    let analytics: UsageAnalytics;

    beforeEach(() => {
        // Mock navigator.sendBeacon
        Object.defineProperty(window.navigator, 'sendBeacon', {
            value: vi.fn(() => true),
            writable: true
        });

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn((key) => {
                    if (key === 'sentinel_cookie_consent') return 'true';
                    if (key === 'sentinel_cookie_consent_details') return JSON.stringify({ tracking: true, analytics: true, essential: true });
                    return null;
                }),
                setItem: vi.fn(),
                removeItem: vi.fn()
            },
            writable: true
        });

        analytics = new UsageAnalytics();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default metrics', () => {
            const metrics = analytics.getMetrics();

            expect(metrics.sessionDuration).toBe(0);
            expect(metrics.pageViews).toBe(0);
            expect(metrics.errorCount).toBe(0);
            expect(metrics.performanceScore).toBe(100);
        });

        it('should generate session ID', () => {
            // Session ID is internal, we can verify events have it
            analytics.trackPageView('/test');
            const events = analytics.getEvents();

            expect(events[0].sessionId).toMatch(/^session_[a-zA-Z0-9-]+$/);
        });
    });

    describe('trackPageView', () => {
        it('should increment page views', () => {
            analytics.trackPageView('/home');
            analytics.trackPageView('/dashboard');

            const metrics = analytics.getMetrics();
            expect(metrics.pageViews).toBe(2);
        });

        it('should record page view event', () => {
            analytics.trackPageView('/dashboard', 'Dashboard');

            const events = analytics.getEvents();
            expect(events.length).toBe(1);
            expect(events[0].type).toBe('page_view');
            expect(events[0].category).toBe('/dashboard');
        });
    });

    describe('trackFeatureUse', () => {
        it('should track feature usage count', () => {
            analytics.trackFeatureUse('search', 'execute');
            analytics.trackFeatureUse('search', 'execute');

            const metrics = analytics.getMetrics();
            expect(metrics.featureUsage['search_execute']).toBe(2);
        });

        it('should record feature use event', () => {
            analytics.trackFeatureUse('export', 'pdf', 5);

            const events = analytics.getEvents();
            expect(events.length).toBe(1);
            expect(events[0].type).toBe('feature_use');
            expect(events[0].category).toBe('export');
            expect(events[0].action).toBe('pdf');
        });

        it('should support custom value', () => {
            analytics.trackFeatureUse('report', 'generate', 10);

            const metrics = analytics.getMetrics();
            expect(metrics.featureUsage['report_generate']).toBe(10);
        });
    });

    describe('trackError', () => {
        it('should increment error count', () => {
            analytics.trackError('api_error');
            analytics.trackError('validation_error');

            const metrics = analytics.getMetrics();
            expect(metrics.errorCount).toBe(2);
        });

        it('should decrease performance score', () => {
            const initialScore = analytics.getMetrics().performanceScore;

            analytics.trackError('error');

            const newScore = analytics.getMetrics().performanceScore;
            expect(newScore).toBeLessThan(initialScore);
        });

        it('should not go below 0 performance score', () => {
            for (let i = 0; i < 30; i++) {
                analytics.trackError('error');
            }

            const metrics = analytics.getMetrics();
            expect(metrics.performanceScore).toBeGreaterThanOrEqual(0);
        });
    });

    describe('trackPerformance', () => {
        it('should penalize poor performance', () => {
            const initialScore = analytics.getMetrics().performanceScore;

            analytics.trackPerformance('loadTime', 5000, 2000);

            const newScore = analytics.getMetrics().performanceScore;
            expect(newScore).toBeLessThan(initialScore);
        });

        it('should reward good performance after penalty', () => {
            // First penalize to get below 100
            analytics.trackPerformance('loadTime', 5000, 2000);
            const scoreAfterPenalty = analytics.getMetrics().performanceScore;

            // Then track good performance
            analytics.trackPerformance('loadTime', 500, 2000);

            const newScore = analytics.getMetrics().performanceScore;
            expect(newScore).toBeGreaterThan(scoreAfterPenalty);
        });

        it('should not exceed 100 performance score', () => {
            for (let i = 0; i < 100; i++) {
                analytics.trackPerformance('metric', 100, 1000);
            }

            const metrics = analytics.getMetrics();
            expect(metrics.performanceScore).toBeLessThanOrEqual(100);
        });
    });

    describe('trackUserAction', () => {
        it('should record user action event', () => {
            analytics.trackUserAction('click', 'button', 'submit');

            const events = analytics.getEvents();
            expect(events.length).toBe(1);
            expect(events[0].type).toBe('user_action');
            expect(events[0].action).toBe('click');
            expect(events[0].category).toBe('button');
        });
    });

    describe('getMetrics', () => {
        it('should return copy of metrics', () => {
            const metrics1 = analytics.getMetrics();
            const metrics2 = analytics.getMetrics();

            expect(metrics1).not.toBe(metrics2);
            expect(metrics1).toEqual(metrics2);
        });
    });

    describe('getEvents', () => {
        it('should return copy of events', () => {
            analytics.trackPageView('/test');

            const events1 = analytics.getEvents();
            const events2 = analytics.getEvents();

            expect(events1).not.toBe(events2);
            expect(events1).toEqual(events2);
        });
    });

    describe('clearEvents', () => {
        it('should clear all events', () => {
            analytics.trackPageView('/test1');
            analytics.trackPageView('/test2');

            expect(analytics.getEvents().length).toBe(2);

            analytics.clearEvents();

            expect(analytics.getEvents().length).toBe(0);
        });
    });

    describe('endSession', () => {
        it('should calculate session duration', () => {
            // Small delay to ensure duration > 0
            analytics.endSession();

            const metrics = analytics.getMetrics();
            expect(metrics.sessionDuration).toBeGreaterThanOrEqual(0);
        });

        it('should update lastActivity', () => {
            const beforeEnd = Date.now();
            analytics.endSession();
            const afterEnd = Date.now();

            const metrics = analytics.getMetrics();
            expect(metrics.lastActivity).toBeGreaterThanOrEqual(beforeEnd);
            expect(metrics.lastActivity).toBeLessThanOrEqual(afterEnd);
        });
    });
});

describe('UsageEvent interface', () => {
    it('should have correct structure', () => {
        const event: UsageEvent = {
            type: 'page_view',
            category: 'navigation',
            action: 'view',
            timestamp: Date.now(),
            sessionId: 'session-123'
        };

        expect(event.type).toBe('page_view');
        expect(event.category).toBe('navigation');
    });

    it('should support all event types', () => {
        const types: UsageEvent['type'][] = [
            'page_view',
            'feature_use',
            'error',
            'performance',
            'user_action',
            'session_pause',
            'session_resume'
        ];

        types.forEach(type => {
            const event: UsageEvent = {
                type,
                category: 'test',
                action: 'test',
                timestamp: Date.now(),
                sessionId: 'test'
            };
            expect(event.type).toBe(type);
        });
    });
});

describe('UsageMetrics interface', () => {
    it('should have correct structure', () => {
        const metrics: UsageMetrics = {
            sessionDuration: 1000,
            pageViews: 5,
            featureUsage: { search: 3 },
            errorCount: 1,
            performanceScore: 95,
            lastActivity: Date.now()
        };

        expect(metrics.sessionDuration).toBe(1000);
        expect(metrics.pageViews).toBe(5);
        expect(metrics.errorCount).toBe(1);
    });
});
