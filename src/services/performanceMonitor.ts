// Performance Monitoring Service
// Advanced monitoring for production environment

interface PerformanceMetrics {
    // Core Web Vitals
    fcp: number; // First Contentful Paint
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
    ttfb: number; // Time to First Byte
    
    // Custom Metrics
    apiResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    userEngagement: number;
    
    // Resource Usage
    memoryUsage: number;
    bundleSize: number;
    imageOptimization: number;
}

interface PerformanceAlert {
    type: 'critical' | 'warning' | 'info';
    metric: keyof PerformanceMetrics;
    value: number;
    threshold: number;
    message: string;
    timestamp: number;
}

class PerformanceMonitor {
    private metrics: Partial<PerformanceMetrics> = {};
    private alerts: PerformanceAlert[] = [];
    private observers: PerformanceObserver[] = [];
    private engagementIntervalId: ReturnType<typeof setInterval> | null = null;
    private eventListenerCleanup: (() => void)[] = [];

    constructor() {
        this.initializeWebVitals();
        this.initializeCustomMetrics();
    }
    
    private initializeWebVitals(): void {
        if (typeof window !== 'undefined' && 'performance' in window) {
            // Observe Core Web Vitals
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.processWebVitalEntry(entry);
                }
            });
            
            observer.observe({ type: 'paint', buffered: true });
            observer.observe({ type: 'largest-contentful-paint', buffered: true });
            observer.observe({ type: 'first-input', buffered: true });
            observer.observe({ type: 'layout-shift', buffered: true });
            observer.observe({ type: 'navigation', buffered: true });
            
            this.observers.push(observer);
        }
    }
    
    private processWebVitalEntry(entry: PerformanceEntry): void {
        switch (entry.entryType) {
            case 'paint':
                if ('name' in entry && entry.name === 'first-contentful-paint') {
                    this.metrics.fcp = entry.startTime;
                }
                break;
            case 'largest-contentful-paint':
                this.metrics.lcp = entry.startTime;
                break;
            case 'first-input': {
                const fidEntry = entry as PerformanceEventTiming;
                if (fidEntry.processingStart && fidEntry.startTime) {
                    this.metrics.fid = fidEntry.processingStart - fidEntry.startTime;
                }
                break;
            }
            case 'layout-shift': {
                const clsEntry = entry as PerformanceEntry & { value: number };
                if (clsEntry.value) {
                    this.metrics.cls = Math.max(this.metrics.cls || 0, clsEntry.value);
                }
                break;
            }
            case 'navigation': {
                const navEntry = entry as PerformanceNavigationTiming;
                if (navEntry.loadEventEnd) {
                    this.metrics.ttfb = navEntry.loadEventEnd - navEntry.fetchStart;
                }
                break;
            }
        }
    }
    
    private initializeCustomMetrics(): void {
        // Monitor API calls
        this.interceptFetch();
        
        // Monitor cache performance
        this.monitorCachePerformance();
        
        // Monitor user interactions
        this.monitorUserEngagement();
    }
    
    private interceptFetch(): void {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const start = performance.now();
            const response = await originalFetch(...args);
            const end = performance.now();
            
            const responseTime = end - start;
            this.updateMetric('apiResponseTime', responseTime);
            
            // Check for errors
            if (!response.ok) {
                this.updateMetric('errorRate', 1);
            }
            
            return response;
        };
    }
    
    private monitorCachePerformance(): void {
        // Monitor localStorage usage
        if (typeof localStorage !== 'undefined') {
            const originalSetItem = localStorage.setItem;
            let setCalls = 0;
            let hits = 0;
            
            localStorage.setItem = (key, value) => {
                setCalls++;
                const start = performance.now();
                originalSetItem.call(localStorage, key, value);
                const end = performance.now();
                
                if (end - start < 1) { // Fast cache access
                    hits++;
                }
                
                // Update cache metrics every 10 calls
                if (setCalls % 10 === 0) {
                    this.updateMetric('cacheHitRate', hits / setCalls);
                    setCalls = 0;
                    hits = 0;
                }
            };
        }
    }
    
    private monitorUserEngagement(): void {
        let engagementTime = 0;
        let interactions = 0;

        const updateEngagement = () => {
            if (document.hidden) return;

            engagementTime += 100; // Update every 100ms
            interactions++;

            this.updateMetric('userEngagement', interactions / (engagementTime / 1000) || 0);
        };

        // Track user interactions with proper cleanup
        const events = ['click', 'scroll', 'keydown', 'mousemove'] as const;
        events.forEach(event => {
            document.addEventListener(event, updateEngagement, { passive: true });
            // Store cleanup function for later
            this.eventListenerCleanup.push(() => {
                document.removeEventListener(event, updateEngagement);
            });
        });

        // Store interval reference for cleanup
        this.engagementIntervalId = setInterval(updateEngagement, 100);
    }
    
    private updateMetric(metric: keyof PerformanceMetrics, value: number): void {
        this.metrics[metric] = value;
        this.checkThresholds(metric, value);
    }
    
    private checkThresholds(metric: keyof PerformanceMetrics, value: number): void {
        const thresholds: Record<keyof PerformanceMetrics, number> = {
            fcp: 2000, // 2s
            lcp: 2500, // 2.5s
            fid: 100, // 100ms
            cls: 0.1, // Layout shift
            ttfb: 800, // 800ms
            apiResponseTime: 500, // 500ms
            cacheHitRate: 0.8, // 80%
            errorRate: 0.05, // 5%
            userEngagement: 0.5, // 50% engagement rate
            memoryUsage: 50, // 50MB
            bundleSize: 1024 * 1024, // 1MB
            imageOptimization: 0.7 // 70% optimized
        };
        
        const threshold = thresholds[metric];
        if (threshold && value > threshold) {
            this.createAlert(metric, value, threshold);
        }
    }
    
    private createAlert(metric: keyof PerformanceMetrics, value: number, threshold: number): void {
        const alert: PerformanceAlert = {
            type: this.getAlertType(value, threshold),
            metric,
            value,
            threshold,
            message: this.getAlertMessage(metric, value),
            timestamp: Date.now()
        };
        
        this.alerts.push(alert);
        this.reportAlert(alert);
    }
    
    private getAlertType(value: number, threshold: number): 'critical' | 'warning' | 'info' {
        const ratio = value / threshold;
        if (ratio > 2) return 'critical';
        if (ratio > 1.5) return 'warning';
        return 'info';
    }
    
    private getAlertMessage(metric: keyof PerformanceMetrics, value: number): string {
        const messages: Record<keyof PerformanceMetrics, string> = {
            fcp: `First Contentful Paint trop lent: ${(value / 1000).toFixed(2)}s`,
            lcp: `Largest Contentful Paint trop lent: ${(value / 1000).toFixed(2)}s`,
            fid: `First Input Delay trop élevé: ${value.toFixed(2)}ms`,
            cls: `Cumulative Layout Shift trop élevé: ${value.toFixed(3)}`,
            ttfb: `Time to First Byte trop lent: ${(value / 1000).toFixed(2)}s`,
            apiResponseTime: `Temps de réponse API trop lent: ${value.toFixed(2)}ms`,
            cacheHitRate: `Taux de cache trop bas: ${(value * 100).toFixed(1)}%`,
            errorRate: `Taux d'erreur trop élevé: ${(value * 100).toFixed(1)}%`,
            userEngagement: `Engagement utilisateur faible: ${(value * 100).toFixed(1)}%`,
            memoryUsage: `Usage mémoire élevé: ${(value / 1024 / 1024).toFixed(1)}MB`,
            bundleSize: `Bundle trop volumineux: ${(value / 1024).toFixed(1)}KB`,
            imageOptimization: `Optimisation images insuffisante: ${(value * 100).toFixed(1)}%`
        };
        
        return messages[metric] || `Métrique ${metric} anormale`;
    }
    
    private reportAlert(alert: PerformanceAlert): void {
        // Send to monitoring service
        if (typeof window !== 'undefined' && window.navigator.sendBeacon) {
            const data = JSON.stringify({
                ...alert,
                url: window.location.href,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            });
            
            window.navigator.sendBeacon('/api/performance-alerts', data);
        }
        
        // Alert logging is handled via sendBeacon above
    }
    
    public getMetrics(): PerformanceMetrics {
        return {
            fcp: this.metrics.fcp || 0,
            lcp: this.metrics.lcp || 0,
            fid: this.metrics.fid || 0,
            cls: this.metrics.cls || 0,
            ttfb: this.metrics.ttfb || 0,
            apiResponseTime: this.metrics.apiResponseTime || 0,
            cacheHitRate: this.metrics.cacheHitRate || 0,
            errorRate: this.metrics.errorRate || 0,
            userEngagement: this.metrics.userEngagement || 0,
            memoryUsage: this.metrics.memoryUsage || 0,
            bundleSize: this.metrics.bundleSize || 0,
            imageOptimization: this.metrics.imageOptimization || 0
        };
    }
    
    public getAlerts(): PerformanceAlert[] {
        return this.alerts;
    }
    
    public destroy(): void {
        // Clean up PerformanceObservers
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];

        // Clean up engagement interval
        if (this.engagementIntervalId !== null) {
            clearInterval(this.engagementIntervalId);
            this.engagementIntervalId = null;
        }

        // Clean up event listeners
        this.eventListenerCleanup.forEach(cleanup => cleanup());
        this.eventListenerCleanup = [];
    }
}

export { PerformanceMonitor };
export type { PerformanceMetrics, PerformanceAlert };
