// Web Vitals performance monitoring
// Requires: npm install web-vitals
//
// Reports Core Web Vitals (CLS, FID, LCP, TTFB, INP) for real-user monitoring.
// - Development: logs metrics to the console for debugging
// - Production: reports metrics via ErrorLogger.logPerformance() (Sentry + Firebase Analytics)

import type { Metric } from 'web-vitals';
import { ErrorLogger } from '@/services/errorLogger';

const isDevelopment = import.meta.env.DEV;

/**
 * Handles a single Web Vital metric by logging it appropriately
 * based on the current environment.
 */
function handleMetric(metric: Metric): void {
  const { name, value, rating, id, navigationType } = metric;

  if (isDevelopment) {
    const ratingColor =
      rating === 'good' ? '\x1b[32m' : rating === 'needs-improvement' ? '\x1b[33m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(
      `[Web Vitals] ${name}: ${ratingColor}${value.toFixed(2)}${reset} (${rating})`,
      { id, navigationType }
    );
  }

  // Report to ErrorLogger in all environments (it routes to Sentry + Firebase Analytics in production)
  ErrorLogger.logPerformance(`web-vital-${name}`, value, 'webVitals');
  ErrorLogger.info(
    `Web Vital ${name}: ${value.toFixed(2)} [${rating}]`,
    'webVitals.handleMetric',
    {
      metadata: {
        metricName: name,
        metricValue: value,
        metricRating: rating,
        metricId: id,
        navigationType,
      },
    }
  );
}

/**
 * Initializes Web Vitals reporting.
 * Call this once at application startup (e.g., in index.tsx).
 *
 * Dynamically imports web-vitals to avoid blocking the critical rendering path.
 */
export function reportWebVitals(): void {
  void import('web-vitals').then(({ onCLS, onFID, onLCP, onTTFB, onINP }) => {
    onCLS(handleMetric);
    onFID(handleMetric);
    onLCP(handleMetric);
    onTTFB(handleMetric);
    onINP(handleMetric);
  }).catch((error: unknown) => {
    ErrorLogger.warn(
      'Failed to load web-vitals library',
      'webVitals.reportWebVitals',
      { metadata: { error } }
    );
  });
}
