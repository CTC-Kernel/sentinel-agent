import { create } from 'zustand';
import { UserProfile, Organization, CustomRole } from './types';
import { toast } from 'sonner';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
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
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  language: 'fr' | 'en';
  setLanguage: (lang: 'fr' | 'en') => void;
  t: (key: string, options?: Record<string, unknown>) => string;

  demoMode: boolean;
  toggleDemoMode: () => void;


}

import i18n from './i18n';

export const useStore = create<AppState>((set) => ({
  user: null,
  organization: null,
  customRoles: [],
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'dark',
  isLoading: true,
  toasts: [],

  language: (localStorage.getItem('language') as 'fr' | 'en') || 'fr',
  setUser: (user) => set({ user }),
  setOrganization: (organization) => set({ organization }),
  setCustomRoles: (customRoles) => set({ customRoles }),
  setTheme: (theme) => set(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme };
  }),
  setLanguage: (lang) => {
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
    set({ language: lang });
  },
  t: (key: string, options?: Record<string, unknown>) => {
    return i18n.t(key, options) as string;
  },
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme: newTheme };
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  addToast: (message, type = 'info') => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
    // Legacy state update removed
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  demoMode: (import.meta.env.DEV || !!localStorage.getItem('E2E_TEST_USER')) && localStorage.getItem('demoMode') === 'true',
  toggleDemoMode: () => set((state) => {
    if (!import.meta.env.DEV) {
      if (state.demoMode) {
        localStorage.removeItem('demoMode');
      }
      return { demoMode: false };
    }
    const next = !state.demoMode;
    if (next) {
      localStorage.setItem('demoMode', 'true');
    } else {
      localStorage.removeItem('demoMode');
    }
    return { demoMode: next };
  }),


}));