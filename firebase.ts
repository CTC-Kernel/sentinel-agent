

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

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
export const auth = getAuth(app);

// Initialisation standard de Firestore (Compatible v9+)
export const db = getFirestore(app);

// Enable Offline Persistence
try {
  enableIndexedDbPersistence(db).catch((err) => {
      if (err.code == 'failed-precondition') {
          console.warn('Firestore persistence failed: Multiple tabs open.');
      } else if (err.code == 'unimplemented') {
          console.warn('Firestore persistence not supported by browser.');
      }
  });
} catch(e) { 
  // Ignore persistence errors in certain envs
}

export const storage = getStorage(app);

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
} catch (err) {
  // Silence 'messaging/unsupported-browser' errors in preview/dev environments
  // console.debug('Firebase Messaging initialization skipped.');
}

export { messaging };
export const VAPID_KEY = "BE8hei47RZ6vu4M04Mg5Vj_em4FC3K7BMbP8qIgH9_TJGKx8_MDPi9zVfiHmvx_PbXHnLvjiTrk9wIIDgWKIkr8";