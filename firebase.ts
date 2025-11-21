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
  appId: "1:728667422032:web:5ccdd871bef78d1da1c055",
  measurementId: "G-FM1NHTVTYG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Activer la persistance hors ligne pour optimiser les performances
// Cela permet de charger les données depuis le cache local instantanément
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('La persistance a échoué : multiples onglets ouverts.');
        } else if (err.code == 'unimplemented') {
            console.warn('Le navigateur ne supporte pas la persistance.');
        }
    });
} catch (e) {
    // Ignorer erreurs en environnement SSR ou spécifique
}

// Initialisation de la messagerie (Sécurisée avec détection de fonctionnalités)
let messaging: any = null;

if (typeof window !== 'undefined') {
  try {
    // Vérification stricte des fonctionnalités requises pour éviter l'erreur 'messaging/unsupported-browser'
    // Le SDK Firebase lance une erreur si ces API ne sont pas disponibles (ex: Navigation privée, HTTP, ou certains environnements de preview)
    const isSupported = 
      'serviceWorker' in navigator && 
      'PushManager' in window && 
      'indexedDB' in window;

    if (isSupported) {
      messaging = getMessaging(app);
    }
  } catch (err) {
    // On ignore silencieusement les erreurs d'initialisation de la messagerie
    // car c'est une fonctionnalité optionnelle et l'erreur est fréquente en développement
    console.debug('Firebase Messaging initialization skipped (unsupported environment).');
  }
}

export { messaging };
export const VAPID_KEY = "BE8hei47RZ6vu4M04Mg5Vj_em4FC3K7BMbP8qIgH9_TJGKx8_MDPi9zVfiHmvx_PbXHnLvjiTrk9wIIDgWKIkr8";