

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import { getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "***REDACTED***",
  authDomain: "sentinel-grc-a8701.firebaseapp.com",
  projectId: "sentinel-grc-a8701",
  storageBucket: "sentinel-grc-a8701.firebasestorage.app",
  messagingSenderId: "728667422032",
  appId: "1:728667422032:web:f7bb344574e49320a1c055",
  measurementId: "G-2MLLGDZ6GP"
};

const app = initializeApp(firebaseConfig);

// Initialize App Check with ReCAPTCHA Enterprise
if (typeof window !== 'undefined') {
  // Enable debug token ONLY for localhost (prevents it from breaking production if env var leaks)
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN && isLocal) {
    // @ts-expect-error - FIREBASE_APPCHECK_DEBUG_TOKEN is not defined on self
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN;
  } else if (import.meta.env.DEV) {
    // @ts-expect-error - FIREBASE_APPCHECK_DEBUG_TOKEN is not defined on self
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    if (typeof initializeAppCheck === 'function') {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider('6Le2FxUsAAAAAOn9WU8omrp4NXSMJIHIRUBhYFSR'),
        isTokenAutoRefreshEnabled: true
      });
      console.log("App Check initialized.");
    } else {
      console.warn("initializeAppCheck is not a function.");
    }
  } catch (error) {
    console.warn('App Check initialization failed:', error);
  }
}

export const auth = getAuth(app);

// Initialize Firestore with modern persistent cache (replaces deprecated enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({
      forceOwnership: false
    })
  })
});

export const storage = getStorage(app);
export const functions = getFunctions(app);

// Initialisation de la messagerie (Sécurisée avec détection de fonctionnalités)
let messaging: any = null;

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
} catch (_err) {
  // Silence 'messaging/unsupported-browser' errors in preview/dev environments
  // console.debug('Firebase Messaging initialization skipped.');
}

export { messaging };
export const VAPID_KEY = "BE8hei47RZ6vu4M04Mg5Vj_em4FC3K7BMbP8qIgH9_TJGKx8_MDPi9zVfiHmvx_PbXHnLvjiTrk9wIIDgWKIkr8";