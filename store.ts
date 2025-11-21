import { create } from 'zustand';
import { UserProfile } from './types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  user: UserProfile | null;
  theme: 'light' | 'dark';
  isLoading: boolean;
  toasts: ToastMessage[];
  setUser: (user: UserProfile | null) => void;
  toggleTheme: () => void;
  setLoading: (loading: boolean) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  isLoading: true,
  toasts: [],
  setUser: (user) => set({ user }),
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
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));