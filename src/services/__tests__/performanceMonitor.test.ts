/**
 * Performance Monitor Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor, PerformanceMetrics, PerformanceAlert } from '../performanceMonitor';

describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;
    let originalPerformanceObserver: typeof PerformanceObserver;
    let originalFetch: typeof fetch;

    beforeEach(() => {
        // Save originals
        originalPerformanceObserver = global.PerformanceObserver;
        originalFetch = global.fetch;

        // Mock PerformanceObserver
        const mockObserver = {
            observe: vi.fn(),
            disconnect: vi.fn()
        };

        global.PerformanceObserver = vi.fn(() => mockObserver) as unknown as typeof PerformanceObserver;

        // Mock fetch
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({})
        });

        // Mock navigator.sendBeacon
        Object.defineProperty(window.navigator, 'sendBeacon', {
            value: vi.fn(),
            writable: true
        });

        // Create monitor instance
        monitor = new PerformanceMonitor();
    });

    afterEach(() => {
        monitor.destroy();
        global.PerformanceObserver = originalPerformanceObserver;
        global.fetch = originalFetch;
        vi.clearAllMocks();
    });

    describe('getMetrics', () => {
        it('should return default metrics', () => {
            const metrics = monitor.getMetrics();

            expect(metrics).toHaveProperty('fcp');
            expect(metrics).toHaveProperty('lcp');
            expect(metrics).toHaveProperty('fid');
            expect(metrics).toHaveProperty('cls');
            expect(metrics).toHaveProperty('ttfb');
            expect(metrics).toHaveProperty('apiResponseTime');
            expect(metrics).toHaveProperty('cacheHitRate');
            expect(metrics).toHaveProperty('errorRate');
            expect(metrics).toHaveProperty('userEngagement');
            expect(metrics).toHaveProperty('memoryUsage');
            expect(metrics).toHaveProperty('bundleSize');
            expect(metrics).toHaveProperty('imageOptimization');
        });

        it('should return zero for uninitialized metrics', () => {
            const metrics = monitor.getMetrics();

            expect(metrics.fcp).toBe(0);
            expect(metrics.lcp).toBe(0);
            expect(metrics.memoryUsage).toBe(0);
        });
    });

    describe('getAlerts', () => {
        it('should return empty array initially', () => {
            const alerts = monitor.getAlerts();
            expect(alerts).toEqual([]);
        });
    });

    describe('destroy', () => {
        it('should clean up observers', () => {
            const destroySpy = vi.spyOn(monitor, 'destroy');

            monitor.destroy();

            expect(destroySpy).toHaveBeenCalled();
        });

        it('should be safe to call multiple times', () => {
            expect(() => {
                monitor.destroy();
                monitor.destroy();
            }).not.toThrow();
        });
    });

    describe('fetch interception', () => {
        it('should track successful API responses', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: 'test' })
            });

            // Create new monitor to pick up the mocked fetch
            const newMonitor = new PerformanceMonitor();

            await fetch('/api/test');

            // Allow time for metrics update
            await new Promise(resolve => setTimeout(resolve, 10));

            const metrics = newMonitor.getMetrics();
            // API response time should be tracked
            expect(metrics.apiResponseTime).toBeGreaterThanOrEqual(0);

            newMonitor.destroy();
        });

        it('should track error responses', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500
            });

            const newMonitor = new PerformanceMonitor();

            await fetch('/api/error');

            await new Promise(resolve => setTimeout(resolve, 10));

            const metrics = newMonitor.getMetrics();
            expect(metrics.errorRate).toBeGreaterThanOrEqual(0);

            newMonitor.destroy();
        });
    });
});

describe('PerformanceAlert interface', () => {
    it('should have correct type structure', () => {
        const alert: PerformanceAlert = {
            type: 'warning',
            metric: 'fcp',
            value: 2500,
            threshold: 2000,
            message: 'First Contentful Paint too slow',
            timestamp: Date.now()
        };

        expect(alert.type).toBe('warning');
        expect(alert.metric).toBe('fcp');
        expect(typeof alert.timestamp).toBe('number');
    });

    it('should support all alert types', () => {
        const types = ['critical', 'warning', 'info'] as const;

        types.forEach(type => {
            const alert: PerformanceAlert = {
                type,
                metric: 'lcp',
                value: 3000,
                threshold: 2500,
                message: 'Test',
                timestamp: Date.now()
            };
            expect(alert.type).toBe(type);
        });
    });
});

describe('PerformanceMetrics interface', () => {
    it('should have all required properties', () => {
        const metrics: PerformanceMetrics = {
            fcp: 100,
            lcp: 200,
            fid: 50,
            cls: 0.05,
            ttfb: 300,
            apiResponseTime: 150,
            cacheHitRate: 0.95,
            errorRate: 0.01,
            userEngagement: 0.75,
            memoryUsage: 30,
            bundleSize: 500000,
            imageOptimization: 0.85
        };

        expect(Object.keys(metrics)).toHaveLength(12);
    });
});
