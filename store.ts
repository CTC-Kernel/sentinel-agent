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
  t: (key: string) => string;
}

import { translations } from './i18n/translations';

export const useStore = create<AppState>((set, get) => ({
  user: null,
  organization: null,
  customRoles: [],
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
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
  setLanguage: (lang) => set(() => {
    localStorage.setItem('language', lang);
    return { language: lang };
  }),
  t: (path: string) => {
    const lang = get().language;
    const keys = path.split('.');
    let value: Record<string, unknown> | string = translations[lang];
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key] as Record<string, unknown> | string;
      } else {
        return path;
      }
    }
    return value as string;
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

}));