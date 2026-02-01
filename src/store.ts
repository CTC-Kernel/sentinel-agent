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

  clearAuth: () => void;

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
    const supportedLanguages = ['fr', 'en', 'de'] as const;
    if (!supportedLanguages.includes(lang as typeof supportedLanguages[number])) {
      console.warn(`Unsupported language "${lang}", defaulting to "fr"`);
      lang = 'fr';
    }
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
    // TODO: i18n - store cannot use t() directly here as it's inside zustand create().
    // The i18n instance is available but calling i18n.t() synchronously is possible.
    // Using i18n.t() with French fallbacks for toast titles.
    const successTitle = (i18n.t('common.success') as string) || 'Succès';
    const errorTitle = (i18n.t('common.error') as string) || 'Erreur';
    const infoTitle = (i18n.t('common.information') as string) || 'Information';
    if (type === 'success') {
      toast.success(successTitle, message, action);
    } else if (type === 'error') {
      toast.error(errorTitle, message, action);
    } else {
      toast.info(infoTitle, message, action);
    }
    // Legacy state update removed
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clearAuth: () => set({
    user: null,
    organization: null,
    customRoles: [],
    demoMode: false,
  }),

  demoMode: SecureStorage.getSecureItem('demoMode') === 'true',

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