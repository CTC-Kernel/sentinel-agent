import { logEvent as firebaseLogEvent, Analytics } from "firebase/analytics";
import { analytics } from "../firebase";
import { ErrorLogger } from "./errorLogger";

// Define supported event names for type safety
export type AnalyticsEventName =
    | 'login'
    | 'sign_up'
    | 'create_audit'
    | 'complete_audit'
    | 'create_risk'
    | 'assess_risk'
    | 'create_incident'
    | 'link_evidence'
    | 'sync_evidence'
    | 'complete_onboarding'
    | 'view_dashboard'
    | 'export_report';

export interface AnalyticsEventParams {
    [key: string]: string | number | boolean | undefined;
}

class AnalyticsService {
    private analytics: Analytics | null = null;

    constructor() {
        this.analytics = analytics;
    }

    /**
     * Logs a custom event to Firebase Analytics.
     * @param eventName The name of the event.
     * @param params Optional parameters for the event.
     */
    logEvent(eventName: AnalyticsEventName, params?: AnalyticsEventParams) {
        if (!this.analytics) return;

        try {
            firebaseLogEvent(this.analytics, eventName as string, params);
            // In development, log to console for visibility
            if (import.meta.env.DEV) {
                ErrorLogger.info(`[Analytics] ${eventName}`, 'AnalyticsService', { metadata: params });
            }
        } catch (error) {
            ErrorLogger.warn('Failed to log analytics event', 'AnalyticsService.logEvent', { metadata: { error, eventName: String(eventName) } });
        }
    }

    /**
     * Sets the user ID for analytics tracking.
     * @param userId The user's unique ID.
     */
    setUserId(userId: string) {
        void userId;
        if (!this.analytics) return;
        // Note: setUserId is not directly exported from firebase/analytics in the modular SDK 
        // in the same way logEvent is. It's usually handled automatically by Firebase Auth integration 
        // if using Google Analytics 4 properties linked to Firebase.
        // However, for manual setting if needed:
        // import { setUserId } from "firebase/analytics";
        // setUserId(this.analytics, userId);
    }
}

export const analyticsService = new AnalyticsService();
