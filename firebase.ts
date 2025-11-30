

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, Messaging } from 'firebase/messaging';
import { getFunctions } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';
// import { initializeAppCheck } from 'firebase/app-check';

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
// Initialize App Check with ReCAPTCHA Enterprise
// if (typeof window !== 'undefined') {
//   // Enable debug token ONLY for localhost (prevents it from breaking production if env var leaks)
//   // Enable debug token for localhost OR if explicitly enabled via localStorage OR for the specific app domain
//   const isDebugMode = localStorage.getItem('debug_app_check') === 'true';
//   const isLocal = window.location.hostname === 'localhost' ||
//     window.location.hostname === '127.0.0.1' ||
//     isDebugMode;

//   if (isLocal) {
//     // Hardcode the token to prevent it from changing when cache is cleared
//     // @ts-expect-error - FIREBASE_APPCHECK_DEBUG_TOKEN is not defined on self
//     self.FIREBASE_APPCHECK_DEBUG_TOKEN = "***REDACTED***";

//     console.log("Using Hardcoded App Check Token: ***REDACTED***");
//   }

//   try {
//     if (typeof initializeAppCheck === 'function') {
//       // initializeAppCheck(app, {
//       //   provider: new ReCaptchaEnterpriseProvider('6Le2FxUsAAAAAOn9WU8omrp4NXSMJIHIRUBhYFSR'),
//       //   isTokenAutoRefreshEnabled: true
//       // });
//       console.log("App Check disabled temporarily for debugging.");
//     }
//   } catch (_error) {
//     console.warn('App Check initialization failed:', error);
//   }
// }

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
export const VAPID_KEY = "BE8hei47RZ6vu4M04Mg5Vj_em4FC3K7BMbP8qIgH9_TJGKx8_MDPi9zVfiHmvx_PbXHnLvjiTrk9wIIDgWKIkr8";