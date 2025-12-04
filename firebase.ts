
import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, Messaging } from 'firebase/messaging';
import { getFunctions } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";


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

const app = initializeApp(firebaseConfig);

// Initialize App Check with ReCAPTCHA Enterprise
if (typeof window !== 'undefined') {
  const appCheckKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY as string | undefined;
  const appCheckDebugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as string | undefined;

  // Enable debug token for localhost OR if explicitly enabled via localStorage OR for the specific app domain
  const isDebugMode = localStorage.getItem('debug_app_check') === 'true';
  const isLocal = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    isDebugMode;

  if (appCheckDebugToken) {
    // Enforce debug token if available in env, regardless of localhost
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken;
  } else if (isLocal) {
    // Generate a new debug token for localhost if one isn't provided
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    if (appCheckKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckKey),
        isTokenAutoRefreshEnabled: true
      });
    } else {
      ErrorLogger.warn('App Check site key missing', 'firebase.ts');
    }
  } catch (error) {
    ErrorLogger.warn('App Check initialization failed', 'firebase.ts', { metadata: { error } });
  }
}



// Use IndexedDB persistence for Capacitor (native), otherwise standard browser persistence
export const auth = initializeAuth(app, {
  persistence: Capacitor.isNativePlatform() ? indexedDBLocalPersistence : browserLocalPersistence
});

// Initialize Firestore with modern persistent cache (replaces deprecated enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const storage = getStorage(app);
export const functions = getFunctions(app);
export const analytics = getAnalytics(app);

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
} catch {
  // Silence 'messaging/unsupported-browser' errors in preview/dev environments
  // console.debug('Firebase Messaging initialization skipped.');
}

export { messaging };
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;