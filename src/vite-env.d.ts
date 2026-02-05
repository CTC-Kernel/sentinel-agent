/// <reference types="vite/client" />

declare const __BUILD_DATE__: string;

interface ImportMetaEnv {
 readonly VITE_FIREBASE_API_KEY: string;
 readonly VITE_FIREBASE_AUTH_DOMAIN: string;
 readonly VITE_FIREBASE_PROJECT_ID: string;
 readonly VITE_FIREBASE_STORAGE_BUCKET: string;
 readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
 readonly VITE_FIREBASE_APP_ID: string;
 readonly VITE_FIREBASE_MEASUREMENT_ID: string;
 readonly VITE_N8N_WEBHOOK_URL?: string;
 readonly VITE_OVH_API_BASE_URL?: string;
 readonly VITE_GOOGLE_CLIENT_ID?: string;
 readonly VITE_MICROSOFT_CLIENT_ID?: string;
 readonly VITE_ENABLE_E2E_MODE?: string;
 readonly VITE_ENCRYPTION_KEY?: string;
 readonly VITE_RECAPTCHA_ENTERPRISE_KEY?: string;
 readonly VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
 readonly VITE_APP_CHECK_DEBUG_TOKEN?: string;
 readonly VITE_USE_EMULATORS?: string;
 readonly VITE_FIREBASE_VAPID_KEY?: string;
 readonly VITE_APP_BASE_URL?: string;
 readonly VITE_USE_FIREBASE_EMULATOR?: string;
 readonly VITE_SENTRY_DSN?: string;
 readonly VITE_ENABLE_EMAIL_PREVIEW?: string;
}

interface ImportMeta {
 readonly env: ImportMetaEnv;
}

declare module 'jspdf' {
 interface jsPDF {
 autoTable: (options: Record<string, unknown>) => jsPDF;
 lastAutoTable: { finalY: number };
 internal: { pageSize: { width: number; height: number };[key: string]: unknown };
 }
}
