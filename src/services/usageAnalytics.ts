// Usage Analytics Service
// Track user behavior and application usage patterns

interface UsageEvent {
    type: 'page_view' | 'feature_use' | 'error' | 'performance' | 'user_action' | 'session_pause' | 'session_resume';
    category: string;
    action: string;
    label?: string;
    value?: number;
    metadata?: Record<string, unknown>;
    timestamp: number;
    sessionId: string;
    userId?: string;
}

interface UsageMetrics {
    sessionDuration: number;
    pageViews: number;
    featureUsage: Record<string, number>;
    errorCount: number;
    performanceScore: number;
    userSatisfaction?: number;
    lastActivity: number;
}

/**
 * Check if the user has granted tracking consent.
 * Returns true only if overall consent is 'true' AND granular tracking consent is enabled.
 */
function hasTrackingConsent(): boolean {
    try {
        const consent = localStorage.getItem('sentinel_cookie_consent');
        if (consent !== 'true') return false;

        const detailsStr = localStorage.getItem('sentinel_cookie_consent_details');
        if (!detailsStr) return false;

        const details = JSON.parse(detailsStr) as { essential: boolean; analytics: boolean; tracking: boolean };
        return details.tracking === true;
    } catch {
        return false;
    }
}

/**
 * Generate an anonymized hash from a string using FNV-1a.
 * Used to avoid storing raw user IDs in analytics events.
 */
function anonymizeId(input: string): string {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    return `anon_${hash.toString(16).padStart(8, '0')}`;
}

class UsageAnalytics {
    private events: UsageEvent[] = [];
    private sessionId: string;
    private startTime: number;
    private metrics: UsageMetrics = {
        sessionDuration: 0,
        pageViews: 0,
        featureUsage: {},
        errorCount: 0,
        performanceScore: 100,
        lastActivity: Date.now()
    };

    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.setupEventListeners();
    }

    private generateSessionId(): string {
        return `session_${crypto.randomUUID()}`;
    }


    private setupEventListeners(): void {
        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('session_pause', 'engagement', 'Session paused');
            } else {
                this.trackEvent('session_resume', 'engagement', 'Session resumed');
            }
        });

        // Track page unload
        window.addEventListener('beforeunload', () => {
            this.endSession();
        });

        // Track errors globally
        window.addEventListener('error', (event) => {
            this.trackError('javascript_error', event.error?.message || 'Unknown error', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Track unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.trackError('promise_rejection', event.reason?.message || 'Unhandled promise rejection');
        });
    }

    public trackPageView(page: string, title?: string): void {
        // Consent gate: do not track if user has not granted tracking consent
        if (!hasTrackingConsent()) return;

        this.metrics.pageViews++;
        this.trackEvent('page_view', page, title || `Page: ${page}`, undefined, undefined, {
            page,
            title
        });
    }

    public trackFeatureUse(feature: string, action: string, value?: number, metadata?: Record<string, unknown>): void {
        const key = `${feature}_${action}`;
        this.metrics.featureUsage[key] = (this.metrics.featureUsage[key] || 0) + (value || 1);

        this.trackEvent('feature_use', feature, action, value ? `Count: ${value}` : undefined, value, metadata);
    }

    public trackError(error: string, message?: string, metadata?: Record<string, unknown>): void {
        this.metrics.errorCount++;
        this.metrics.performanceScore = Math.max(0, this.metrics.performanceScore - 5);

        this.trackEvent('error', error, message || 'Error occurred', undefined, undefined, {
            errorMessage: message,
            ...metadata
        });
    }

    public trackPerformance(metric: string, value: number, threshold?: number): void {
        let score = this.metrics.performanceScore;

        if (threshold) {
            if (value > threshold) {
                score -= 10; // Penalty for poor performance
            } else {
                score += 2; // Reward for good performance
            }
        }

        this.metrics.performanceScore = Math.min(100, Math.max(0, score));
        this.trackEvent('performance', metric, `Performance: ${metric}`, undefined, value, {
            threshold,
            score
        });
    }

    public trackUserAction(action: string, category: string, label?: string, value?: number): void {
        this.trackEvent('user_action', category, action, label, value);
    }

    private trackEvent(type: UsageEvent['type'], category: string, action: string, label?: string, value?: number, metadata?: Record<string, unknown>): void {
        // Consent gate: do not track if user has not granted tracking consent
        if (!hasTrackingConsent()) return;

        const event: UsageEvent = {
            type,
            category,
            action,
            label,
            value,
            metadata,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            userId: this.getAnonymizedUserId()
        };

        this.events.push(event);
        this.sendEvent(event);
    }

    /**
     * Get an anonymized (hashed) user identifier for analytics.
     * Does NOT read PII from localStorage. Uses the session ID as fallback.
     */
    private getAnonymizedUserId(): string | undefined {
        try {
            // Use the session-specific ID as the anonymous identifier
            // This avoids reading PII (sentinel_user) from localStorage
            return anonymizeId(this.sessionId);
        } catch {
            return undefined;
        }
    }

    private sendEvent(event: UsageEvent): void {
        // Consent gate: do not send if user has not granted tracking consent
        if (!hasTrackingConsent()) return;

        // Send to analytics endpoint
        if (typeof window !== 'undefined' && window.navigator.sendBeacon) {
            const data = JSON.stringify({
                ...event,
                url: window.location.href,
                userAgent: navigator.userAgent,
                screen: {
                    width: screen.width,
                    height: screen.height
                }
            });

            window.navigator.sendBeacon('/api/usage-events', data);
        }

        // Also store locally for development
        if (import.meta.env.DEV) {
            // Local storage logic can be added here for debugging
        }
    }

    public endSession(): void {
        this.metrics.sessionDuration = Date.now() - this.startTime;
        this.metrics.lastActivity = Date.now();

        // Send final session metrics
        this.sendSessionMetrics();
    }

    private sendSessionMetrics(): void {
        // Consent gate: do not send session metrics without tracking consent
        if (!hasTrackingConsent()) return;

        const sessionData = {
            ...this.metrics,
            sessionId: this.sessionId,
            userId: this.getAnonymizedUserId(),
            endTime: new Date().toISOString()
        };

        if (typeof window !== 'undefined' && window.navigator.sendBeacon) {
            window.navigator.sendBeacon('/api/session-metrics', JSON.stringify(sessionData));
        }
    }

    public getMetrics(): UsageMetrics {
        return { ...this.metrics };
    }

    public getEvents(): UsageEvent[] {
        return [...this.events];
    }

    public clearEvents(): void {
        this.events = [];
    }
}

export { UsageAnalytics };
export type { UsageEvent, UsageMetrics };
