
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth';
// Capacitor import removed from static scope to prevent web issues
// import { Capacitor } from '@capacitor/core';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, Messaging } from 'firebase/messaging';
import { getFunctions } from 'firebase/functions';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, type AppCheck } from "firebase/app-check";

import { ErrorLogger } from './services/errorLogger';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const app = initializeApp(firebaseConfig);

let appCheck: AppCheck | null = null;

// Flag to indicate if App Check failed (e.g. due to ad blocker)
// This can be used by UI components to show a warning
export let isAppCheckFailed = false;

// Initialize App Check with ReCAPTCHA Enterprise
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
  const appCheckKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY as string | undefined;
  const appCheckDebugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as string | undefined;

  // SECURITY: Never allow enabling App Check debug mode in production via localStorage.
  // Debug tokens must only be used on localhost/127.0.0.1.
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const isDebugMode = !import.meta.env.PROD && localStorage.getItem('debug_app_check') === 'true';
  const isVerboseDebug = localStorage.getItem('debug_app_check') === 'true';

  // Expose App Check instance for diagnostics and downstream usage.
  // Not exported directly to avoid changing public API shape at module level.
  let appCheckInstance: AppCheck | null = null;

  if (appCheckDebugToken && (isLocal || !import.meta.env.PROD)) {
    // SECURITY: debug tokens must never be used from production origins.
    // Allow explicit debug token only on localhost or in non-PROD builds.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken;
  } else if (isLocal || isDebugMode) {
    // Generate a new debug token for localhost if one isn't provided
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    if (appCheckKey) {
      // SECURITY: Debug tokens should be provided via environment variable only
      // Never hardcode debug tokens in source code - they were removed for security

      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckKey),
        isTokenAutoRefreshEnabled: true
      });

      appCheck = appCheckInstance;

      // Optional diagnostics: verify we can mint an App Check token.
      // Enabled only when localStorage.debug_app_check === 'true'.
      if (isVerboseDebug && appCheckInstance) {
        (async () => {
          try {
            const tokenResult = await getToken(appCheckInstance, false);
            ErrorLogger.warn('App Check session acquired', 'firebase.appCheck', {
              metadata: {
                // Token snippet removed for security
                hasToken: Boolean(tokenResult.token)
              }
            });
          } catch (error) {
            ErrorLogger.error(error, 'firebase.appCheck.getToken');
          }
        })();
      }
    } else {
      // Graceful fallback: disable App Check if site key is missing
      // This prevents 403 errors during development
      if (import.meta.env.PROD) {
        throw new Error('Missing required environment variable: VITE_RECAPTCHA_ENTERPRISE_KEY');
      }
      if (import.meta.env.MODE !== 'test') {
        ErrorLogger.warn('App Check disabled - site key missing. Set VITE_RECAPTCHA_ENTERPRISE_KEY to enable.', 'firebase.ts');
        isAppCheckFailed = true;
      }
    }
  } catch (error) {
    isAppCheckFailed = true;
    ErrorLogger.warn('App Check initialization failed - potential Ad Blocker interference', 'firebase.ts', { metadata: { error } });
  }
}

export const debugGetAppCheckTokenSnippet = async (): Promise<string | null> => {
  if (!appCheck) return null;
  const tokenResult = await getToken(appCheck, false);
  if (!tokenResult?.token) return null;
  return `${tokenResult.token.slice(0, 12)}...`;
};

// Use getAuth for immediate instance, which works reliably on Web
export const auth = getAuth(app);

// Connect to Emulators if requested (e.g. for E2E tests)
// Connect to Emulators logic moved below initialization of all services

// Configure persistence dynamically to ensure iOS works correctly
// This avoids static Capacitor imports that break Web, but sets persistence for Native
(async () => {
  try {
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    const isNative = typeof window !== 'undefined' &&
      typeof w.Capacitor?.isNativePlatform === 'function' &&
      w.Capacitor.isNativePlatform();

    if (isNative) {
      // On iOS/Android, we MUST use indexedDBLocalPersistence for correct session restoration
      // We import it dynamically to be safe, though it's already imported above
      await setPersistence(auth, indexedDBLocalPersistence);
    } else {
      // On Web, browserLocalPersistence is default, but we can be explicit
      await setPersistence(auth, browserLocalPersistence);
    }
  } catch (error) {
    ErrorLogger.error(error, 'firebase.persistenceConfig');
  }
})();

// Initialize Firestore with modern persistent cache (replaces deprecated enableIndexedDbPersistence)
// Fallback to in-memory cache if IndexedDB is blocked/unavailable (private mode, hardened browsers, etc.).
// Initialize Firestore with memory cache and forced long-polling for maximum stability.
// We enable persistent cache for offline support, but auto-detect settings to avoid tab variance issues.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app);
export const functions = getFunctions(app);
export let analytics: Analytics | null = null;

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  const { connectAuthEmulator } = await import('firebase/auth');
  const { connectFirestoreEmulator } = await import('firebase/firestore');
  const { connectFunctionsEmulator } = await import('firebase/functions');
  const { connectStorageEmulator } = await import('firebase/storage');

  console.log('[Firebase] Connecting to Emulators...');
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8085);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectStorageEmulator(storage, 'localhost', 9199);
}

(async () => {
  try {
    if (typeof window === 'undefined') return;
    if (await isSupported()) {
      analytics = getAnalytics(app);
    }
  } catch (error) {
    ErrorLogger.warn('Analytics initialization skipped', 'firebase.analytics', { metadata: { error } });
  }
})();

// Initialisation de la messagerie (Sécurisée avec détection de fonctionnalités)
let messaging: Messaging | null = null;

const isMessagingSupported = () => {
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  if (!('indexedDB' in window)) return false;
  // Messaging strictly requires a secure context (HTTPS or localhost)
  if (!window.isSecureContext) return false;
  return true;
};

try {
  if (isMessagingSupported()) {
    messaging = getMessaging(app);
  }
} catch (error) {
  // Silence 'messaging/unsupported-browser' errors in preview/dev environments
  // Log only in debug mode to help with troubleshooting
  if (import.meta.env.DEV) {
    ErrorLogger.warn('Firebase Messaging initialization skipped - browser may not support push notifications', 'firebase.messaging', { metadata: { error } });
  }
}

export { messaging };
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;