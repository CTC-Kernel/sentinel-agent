import * as Sentry from "@sentry/react";

/**
 * Tracks whether Sentry has already been initialized to avoid double-init.
 */
let sentryInitialized = false;

/**
 * Initialize Sentry only if the user has granted cookie consent AND analytics consent.
 * This function is safe to call multiple times; it will only initialize once.
 * Exported so it can be called from CookieConsent when consent is granted.
 */
export function initSentry(): void {
 if (sentryInitialized) return;

 try {
 const consent = localStorage.getItem('sentinel_cookie_consent');
 if (consent !== 'true') return;

 const detailsStr = localStorage.getItem('sentinel_cookie_consent_details');
 if (!detailsStr) return;

 const details = JSON.parse(detailsStr) as { essential: boolean; analytics: boolean; tracking: boolean };
 if (!details.analytics) return;
 } catch {
 // If we cannot read consent, do not initialize Sentry
 return;
 }

 Sentry.init({
 dsn: import.meta.env.VITE_SENTRY_DSN,
 integrations: [
 Sentry.browserTracingIntegration(),
 Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
 ],
 // Tracing
 tracesSampleRate: 0.1, // Sample 10% of transactions in production
 // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
 tracePropagationTargets: [/^https:\/\/.*sentinel-grc\.com/],
 // Session Replay
 replaysSessionSampleRate: 0.1,
 replaysOnErrorSampleRate: 1.0,
 // Strip PII from event extras before sending to Sentry
 beforeSend(event) {
 if (event.extra) {
 delete event.extra.userId;
 delete event.extra.organizationId;
 delete event.extra.email;
 }
 return event;
 },
 });

 sentryInitialized = true;
}
