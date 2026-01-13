import '@testing-library/jest-dom';

import React from 'react';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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

// Mock getAnimations which is missing in JSDOM
if (typeof Element !== 'undefined' && !Element.prototype.getAnimations) {
    Element.prototype.getAnimations = () => [];
}

// Mock framer-motion for all tests
vi.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { layoutId?: string }>(({ children, className, layoutId: _layoutId, ...props }, ref) =>
            React.createElement('div', { className, ref, ...props }, children)
        ),
        button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { layoutId?: string }>(({ children, className, layoutId: _layoutId, ...props }, ref) =>
            React.createElement('button', { className, ref, ...props }, children)
        ),
        svg: React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement> & { layoutId?: string }>(({ children, className, layoutId: _layoutId, ...props }, ref) =>
            React.createElement('svg', { className, ref, ...props }, children)
        ),
        li: React.forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement> & { layoutId?: string }>(({ children, className, layoutId: _layoutId, ...props }, ref) =>
            React.createElement('li', { className, ref, ...props }, children)
        ),
        ul: React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement> & { layoutId?: string }>(({ children, className, layoutId: _layoutId, ...props }, ref) =>
            React.createElement('ul', { className, ref, ...props }, children)
        ),
        span: React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { layoutId?: string }>(({ children, className, layoutId: _layoutId, ...props }, ref) =>
            React.createElement('span', { className, ref, ...props }, children)
        ),
        a: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { layoutId?: string }>(({ children, className, layoutId: _layoutId, ...props }, ref) =>
            React.createElement('a', { className, ref, ...props }, children)
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
