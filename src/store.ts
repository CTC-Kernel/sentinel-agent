import { create } from 'zustand';
import { UserProfile, Organization, CustomRole } from './types';
import { toast } from './lib/toast';
import { SecureStorage } from './services/secureStorage';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface AppState {
  user: UserProfile | null;
  organization: Organization | null;
  customRoles: CustomRole[];
  theme: 'light' | 'dark';
  isLoading: boolean;
  toasts: ToastMessage[];
  setUser: (user: UserProfile | null) => void;
  setOrganization: (org: Organization | null) => void;
  setCustomRoles: (roles: CustomRole[]) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setLoading: (loading: boolean) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info', action?: { label: string; onClick: () => void }) => void;
  removeToast: (id: string) => void;

  language: 'fr' | 'en' | 'de';
  setLanguage: (lang: 'fr' | 'en' | 'de') => void;
  t: (key: string, options?: Record<string, unknown>) => string;

  demoMode: boolean;
  toggleDemoMode: () => void;

  activeFramework: string | null;
  setActiveFramework: (framework: string | null) => void;
}

import i18n from './i18n';

// Helper for safe storage access
const safeGetItem = (key: string) => {
  try { return localStorage.getItem(key); } catch { /* ignore */ return null; }
};

export const useStore = create<AppState>((set) => ({
  user: null,
  organization: null,
  customRoles: [],
  theme: (safeGetItem('theme') as 'light' | 'dark') || 'dark',
  isLoading: true,
  toasts: [],

  language: (safeGetItem('language') as 'fr' | 'en' | 'de') || 'fr',
  setUser: (user) => set({ user }),
  setOrganization: (organization) => set({ organization }),
  setCustomRoles: (customRoles) => set({ customRoles }),
  setTheme: (theme) => set(() => {
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme };
  }),
  setLanguage: (lang) => {
    try { localStorage.setItem('language', lang); } catch { /* ignore */ }
    i18n.changeLanguage(lang);
    set({ language: lang });
  },
  t: (key: string, options?: Record<string, unknown>) => {
    return i18n.t(key, options) as string;
  },
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', newTheme); } catch { /* ignore */ }
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme: newTheme };
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  addToast: (message, type = 'info', action) => {
    if (type === 'success') {
      toast.success('Succès', message, action);
    } else if (type === 'error') {
      toast.error('Erreur', message, action);
    } else {
      toast.info('Information', message, action);
    }
    // Legacy state update removed
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  // Robust demoMode initialization
  demoMode: (typeof window !== 'undefined' && !!((window as unknown as { __TEST_MODE__: boolean }).__TEST_MODE__)) ||
    SecureStorage.getSecureItem('demoMode') === 'true',

  toggleDemoMode: () => set((state) => {
    const next = !state.demoMode;
    if (next) {
      SecureStorage.setSecureItem('demoMode', next);
    } else {
      SecureStorage.removeSecureItem('demoMode');
    }
    return { demoMode: next };
  }),

  activeFramework: safeGetItem('activeFramework'),
  setActiveFramework: (activeFramework) => set(() => {
    if (activeFramework) {
      try { localStorage.setItem('activeFramework', activeFramework); } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem('activeFramework'); } catch { /* ignore */ }
    }
    return { activeFramework };
  }),
}));