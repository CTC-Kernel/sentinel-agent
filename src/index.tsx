import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n'; // Initialize i18n
import { HelmetProvider } from 'react-helmet-async';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { onIdTokenChanged, getRedirectResult } from 'firebase/auth';
import { auth, debugGetAppCheckTokenSnippet } from './firebase';

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
    console.debug('Capacitor initialization skipped or failed:', error);
  }
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

const installDiagnostics = () => {
  if (typeof window === 'undefined') return;

  const enabled = localStorage.getItem('debug_sentinel') === 'true';
  if (!enabled) return;

  const tag = '[SentinelDiag]';
  // eslint-disable-next-line no-console
  console.warn(`${tag} enabled (localStorage.debug_sentinel=true)`);

  // 1) Observe auth changes (this is authoritative for "why am I back to login")
  try {
    onIdTokenChanged(auth, async (user) => {
      try {
        if (!user) {
          // eslint-disable-next-line no-console
          console.warn(`${tag} onIdTokenChanged: user=null`);
          return;
        }
        const tokenResult = await user.getIdTokenResult();
        // eslint-disable-next-line no-console
        console.warn(`${tag} onIdTokenChanged: user`, {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          providerIds: user.providerData?.map(p => p.providerId),
          hasOrgClaim: Boolean((tokenResult.claims as Record<string, unknown>)?.organizationId),
          hasRoleClaim: Boolean((tokenResult.claims as Record<string, unknown>)?.role)
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`${tag} onIdTokenChanged handler error`, e);
      }
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`${tag} failed to attach onIdTokenChanged`, e);
  }

  // 2) Finalize redirect result globally (gives precise auth/* errors)
  (async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        // eslint-disable-next-line no-console
        console.warn(`${tag} getRedirectResult: success`, {
          uid: result.user.uid,
          providerIds: result.user.providerData?.map(p => p.providerId)
        });
      } else {
        // eslint-disable-next-line no-console
        console.warn(`${tag} getRedirectResult: empty`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`${tag} getRedirectResult error`, e);
    }
  })();

  // 3) Probe App Check token minting
  (async () => {
    try {
      const snippet = await debugGetAppCheckTokenSnippet();
      // eslint-disable-next-line no-console
      console.warn(`${tag} appCheck token`, { hasToken: Boolean(snippet), snippet });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`${tag} appCheck getToken error`, e);
    }
  })();

  // 4) Wrap fetch to surface 401/403 (Firestore/AppCheck failures usually show up here)
  try {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input, init);
      if (res.status === 401 || res.status === 403) {
        let url = '';
        try {
          url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
        } catch {
          url = '';
        }
        // eslint-disable-next-line no-console
        console.warn(`${tag} fetch ${res.status}`, {
          url,
          method: init?.method || (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).method : 'GET'),
          mode: init?.mode,
          credentials: init?.credentials
        });
      }
      return res;
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`${tag} failed to wrap fetch`, e);
  }
};

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

installDiagnostics();

// Initialize app after render
initializeApp();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then(() => {
        // console.log('SW registered');
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}