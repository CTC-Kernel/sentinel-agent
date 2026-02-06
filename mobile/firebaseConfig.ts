import { initializeApp } from 'firebase/app';
// @ts-expect-error - ignore verification: getReactNativePersistence is not correctly typed in some versions but works at runtime
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, CustomProvider } from 'firebase/app-check';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Hardcoded for now or use EXPO_PUBLIC_ env vars
// Ideally, you should put these in a .env file with EXPO_PUBLIC_ prefix
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize App Check
// In development, use debug token; in production, use reCAPTCHA Enterprise
const isDebug = __DEV__ || process.env.EXPO_PUBLIC_APP_CHECK_DEBUG === 'true';

if (isDebug) {
    // Debug provider for development - allows testing without reCAPTCHA
    // Set FIREBASE_APPCHECK_DEBUG_TOKEN in Firebase Console > App Check > Apps > Manage debug tokens
    const debugToken = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
    if (debugToken) {
        initializeAppCheck(app, {
            provider: new CustomProvider({
                getToken: async () => ({
                    token: debugToken,
                    expireTimeMillis: Date.now() + 60 * 60 * 1000 // 1 hour
                })
            }),
            isTokenAutoRefreshEnabled: true
        });
    }
} else {
    // Production: use reCAPTCHA Enterprise
    const recaptchaSiteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
    if (recaptchaSiteKey) {
        initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
            isTokenAutoRefreshEnabled: true
        });
    }
}

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);

export { app, auth, db };
