import '@testing-library/jest-dom';

import React from 'react';
import { vi, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// Suppress noisy warnings in tests
const originalWarn = console.warn;
const originalError = console.error;
beforeAll(() => {
 // Suppress React Router v7 deprecation warnings
 console.warn = (...args: unknown[]) => {
 const message = args[0];
 if (typeof message === 'string') {
 // Suppress React Router v7 warnings
 if (message.includes('React Router Future Flag Warning')) {
 return;
 }
 // Suppress Recharts dimension warnings in tests (container has 0 dimensions in JSDOM)
 if (message.includes('width(0) and height(0)')) {
 return;
 }
 }
 originalWarn.apply(console, args);
 };

 // Suppress Three.js/R3F element casing warnings in tests
 console.error = (...args: unknown[]) => {
 const message = args[0];
 if (typeof message === 'string') {
 // Suppress lowercase element casing warnings from Three.js
 if (message.includes('is using incorrect casing') ||
 message.includes('is unrecognized in this browser')) {
 return;
 }
 // Suppress React DOM property warnings for Three.js elements
 if (message.includes('React does not recognize') &&
 (message.includes('castShadow') || message.includes('receiveShadow'))) {
 return;
 }
 }
 originalError.apply(console, args);
 };
});

// Global mocks if needed
global.React = React;

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
 observe() { }
 unobserve() { }
 disconnect() { }
};

// Mock TextEncoder/TextDecoder for JSDOM
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
// @ts-expect-error -- TextDecoder is not defined in the global type definition for Node environment
global.TextDecoder = TextDecoder;

// Mock Firebase
vi.mock('firebase/app', () => ({
 initializeApp: vi.fn(() => ({})),
 getApp: vi.fn(),
 getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
 getAuth: vi.fn(() => ({
 currentUser: null,
 onAuthStateChanged: vi.fn(() => () => { }),
 signOut: vi.fn(),
 })),
 setPersistence: vi.fn(),
 indexedDBLocalPersistence: {},
 browserLocalPersistence: {},
 connectAuthEmulator: vi.fn(),
 GoogleAuthProvider: vi.fn(),
 EmailAuthProvider: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
 getFirestore: vi.fn(() => ({})),
 initializeFirestore: vi.fn(() => ({})),
 connectFirestoreEmulator: vi.fn(),
 persistentLocalCache: vi.fn(),
 memoryLocalCache: vi.fn(),
 persistentMultipleTabManager: vi.fn(),
 collection: vi.fn(),
 doc: vi.fn(),
 getDoc: vi.fn(),
 getDocs: vi.fn(),
 setDoc: vi.fn(),
 updateDoc: vi.fn(),
 deleteDoc: vi.fn(),
 query: vi.fn(),
 where: vi.fn((field, op, value) => ({ type: 'where', fieldPath: field, opStr: op, value })),
 orderBy: vi.fn((field, dir) => ({ type: 'orderBy', fieldPath: field, directionStr: dir })),
 limit: vi.fn((limit) => ({ type: 'limit', limit })),
 startAfter: vi.fn((...args) => ({ type: 'startAfter', args })),
 startAt: vi.fn((...args) => ({ type: 'startAt', args })),
 endAt: vi.fn((...args) => ({ type: 'endAt', args })),
 endBefore: vi.fn((...args) => ({ type: 'endBefore', args })),
 onSnapshot: vi.fn(() => () => { }),
 Timestamp: {
 now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
 fromDate: (date: Date) => ({ toDate: () => date, toMillis: () => date.getTime() }),
 },
 writeBatch: vi.fn(() => ({
 set: vi.fn(),
 update: vi.fn(),
 delete: vi.fn(),
 commit: vi.fn(),
 })),
}));

vi.mock('firebase/storage', () => ({
 getStorage: vi.fn(() => ({})),
 connectStorageEmulator: vi.fn(),
 ref: vi.fn(),
 uploadBytes: vi.fn(),
 getDownloadURL: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
 getFunctions: vi.fn(() => ({})),
 connectFunctionsEmulator: vi.fn(),
 httpsCallable: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/analytics', () => ({
 getAnalytics: vi.fn(),
 logEvent: vi.fn(),
 isSupported: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('firebase/messaging', () => ({
 getMessaging: vi.fn(),
 getToken: vi.fn(),
 onMessage: vi.fn(),
}));

vi.mock('firebase/app-check', () => ({
 initializeAppCheck: vi.fn(),
 ReCaptchaEnterpriseProvider: vi.fn(),
 getToken: vi.fn(),
}));

// Mock the project's firebase module to prevent env var validation errors in CI
vi.mock('./firebase', () => ({
 app: {},
 auth: {
 currentUser: null,
 onAuthStateChanged: vi.fn(() => () => { }),
 signOut: vi.fn(),
 },
 db: {},
 storage: {},
 functions: {},
 analytics: null,
 messaging: null,
 isAppCheckFailed: false,
 onAppCheckRecovery: vi.fn(() => vi.fn()),
 debugGetAppCheckTokenSnippet: vi.fn(() => Promise.resolve(null)),
 initializeAnalytics: vi.fn(() => Promise.resolve(null)),
 VAPID_KEY: undefined,
}));

// Mock getAnimations which is missing in JSDOM
if (typeof Element !== 'undefined' && !Element.prototype.getAnimations) {
 Element.prototype.getAnimations = () => [];
}

// Mock framer-motion for all tests
vi.mock('framer-motion', () => ({
 motion: {
 div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }>(({ children, className, layoutId: _layoutId, whileHover: _wh, whileTap: _wt, initial: _i, animate: _a, exit: _e, transition: _t, variants: _v, viewport: _vp, ...props }, ref) =>
 React.createElement('div', { className, ref, ...props }, children as React.ReactNode)
 ),
 button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { [key: string]: unknown }>(({ children, className, layoutId: _layoutId, whileHover: _wh, whileTap: _wt, initial: _i, animate: _a, exit: _e, transition: _t, variants: _v, viewport: _vp, ...props }, ref) =>
 React.createElement('button', { className, ref, ...props }, children as React.ReactNode)
 ),
 svg: React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement> & { [key: string]: unknown }>(({ children, className, layoutId: _layoutId, whileHover: _wh, whileTap: _wt, initial: _i, animate: _a, exit: _e, transition: _t, variants: _v, viewport: _vp, ...props }, ref) =>
 React.createElement('svg', { className, ref, ...props }, children as React.ReactNode)
 ),
 circle: React.forwardRef<SVGCircleElement, React.SVGProps<SVGCircleElement> & { [key: string]: unknown }>(({ children, className, layoutId: _layoutId, whileHover: _wh, whileTap: _wt, initial: _i, animate: _a, exit: _e, transition: _t, variants: _v, viewport: _vp, ...props }, ref) =>
 React.createElement('circle', { className, ref, ...props }, children as React.ReactNode)
 ),
 li: React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement> & { [key: string]: unknown }>(({ children, className, layoutId: _layoutId, whileHover: _wh, whileTap: _wt, initial: _i, animate: _a, exit: _e, transition: _t, variants: _v, viewport: _vp, ...props }, ref) =>
 React.createElement('li', { className, ref, ...props }, children as React.ReactNode)
 ),
 ul: React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement> & { [key: string]: unknown }>(({ children, className, layoutId: _layoutId, whileHover: _wh, whileTap: _wt, initial: _i, animate: _a, exit: _e, transition: _t, variants: _v, viewport: _vp, ...props }, ref) =>
 React.createElement('ul', { className, ref, ...props }, children as React.ReactNode)
 ),
 span: React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { [key: string]: unknown }>(({ children, className, layoutId: _layoutId, whileHover: _wh, whileTap: _wt, initial: _i, animate: _a, exit: _e, transition: _t, variants: _v, viewport: _vp, ...props }, ref) =>
 React.createElement('span', { className, ref, ...props }, children as React.ReactNode)
 ),
 a: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { [key: string]: unknown }>(({ children, className, layoutId: _layoutId, whileHover: _wh, whileTap: _wt, initial: _i, animate: _a, exit: _e, transition: _t, variants: _v, viewport: _vp, ...props }, ref) =>
 React.createElement('a', { className, ref, ...props }, children as React.ReactNode)
 ),
 },
 AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
 layoutId: 'test-layout-id',
}));

// Initialize i18n for tests
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

if (!i18n.isInitialized) {
 i18n
 .use(initReactI18next)
 .init({
 lng: 'en',
 fallbackLng: 'en',
 ns: ['translation'],
 defaultNS: 'translation',
 debug: false,
 interpolation: {
 escapeValue: false,
 },
 resources: {
 en: {
  translation: {}
 }
 }
 });
}
// Mock project i18n configuration to prevent double initialization
vi.mock('./i18n', () => ({
 default: i18n,
}));


// Mock useLocale hook globally to delegate to react-i18next's useTranslation
// This ensures components using useLocale get translations from test mocks of react-i18next
vi.mock('./hooks/useLocale', () => {
return {
useLocale: () => {
// Import useTranslation dynamically to get the mocked version
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { useTranslation } = require('react-i18next');
const { t: i18nT } = useTranslation();
return {
locale: 'en' as const,
config: {
code: 'en',
name: 'English',
dateFormat: 'MM/dd/yyyy',
dateTimeFormat: 'MM/dd/yyyy HH:mm',
numberFormat: { decimal: '.', thousands: ',' },
currency: 'USD',
},
dateFnsLocale: {},
formatDate: (date: Date) => date.toLocaleDateString('en-US'),
formatLocalizedDate: (date: Date | string | null) => date ? new Date(date).toLocaleDateString('en-US') : '',
parseDate: (str: string) => new Date(str),
formatNumber: (val: number) => val.toLocaleString('en-US'),
formatCurrency: (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
formatPercentage: (val: number) => `${(val * 100).toFixed(0)}%`,
zodMessages: {
required: 'This field is required',
invalidType: 'Invalid type',
tooSmall: 'Value too small',
tooBig: 'Value too big',
invalidDate: 'Invalid date',
invalidEmail: 'Invalid email',
invalidUrl: 'Invalid URL',
},
createDateSchema: () => ({}),
createNumberSchema: () => ({}),
t: i18nT,
};
},
};
});

// Global cleanup
afterEach(() => {
 cleanup();
});
