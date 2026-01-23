import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorLogger } from './services/errorLogger';
import './index.css';
import './i18n'; // Initialize i18n
import { HelmetProvider } from 'react-helmet-async';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from "@sentry/react";

// Suppress expected non-passive wheel listener warning from OrbitControls (three.js)
// OrbitControls requires non-passive wheel events to preventDefault during zoom
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('non-passive event listener')) {
      return; // Suppress this specific warning
    }
    originalWarn.apply(console, args);
  };
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});

// Initialize Capacitor plugins
const initializeApp = async () => {
  try {
    // Dynamically import Capacitor core to check platform
    const { Capacitor } = await import('@capacitor/core');

    if (Capacitor.isNativePlatform()) {
      // Only import and use plugins on native platforms
      const { SplashScreen } = await import('@capacitor/splash-screen');
      const { StatusBar, Style } = await import('@capacitor/status-bar');

      if (Capacitor.getPlatform() === 'ios') {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0f172a' });
      }

      await SplashScreen.hide();
    }
  } catch (error) {
    // Silently fail on web or if plugins are missing
    ErrorLogger.warn('Capacitor initialization skipped or failed', 'index.initializeApp', { metadata: { error } });
  }
};

const cleanupLegacyServiceWorkers = () => {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  const guardKey = 'sentinel_sw_cleanup_done_v1';
  if (sessionStorage.getItem(guardKey) === 'true') return;

  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const legacyRegs = regs.filter((reg) => {
        const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
        const isRootScope = reg.scope === `${window.location.origin}/`;
        const isLegacy = scriptUrl.includes('/firebase-messaging-sw.js') || scriptUrl.endsWith('/sw.js');
        return isRootScope && isLegacy;
      });

      if (legacyRegs.length === 0) {
        sessionStorage.setItem(guardKey, 'true');
        return;
      }

      await Promise.all(legacyRegs.map((reg) => reg.unregister()));
      sessionStorage.setItem(guardKey, 'true');

      // Hard reload once so the page is no longer controlled by the legacy SW.
      window.location.reload();
    } catch (e) {
      // If anything goes wrong, do not block the app.
      sessionStorage.setItem(guardKey, 'true');
      ErrorLogger.warn('Service worker cleanup skipped or failed', 'index.cleanupLegacyServiceWorkers', { metadata: { error: e } });
    }
  });
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

if (!GOOGLE_CLIENT_ID) {
  throw new Error('Missing required environment variable: VITE_GOOGLE_CLIENT_ID');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

cleanupLegacyServiceWorkers();
initializeApp();