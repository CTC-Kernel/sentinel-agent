import { create } from 'zustand';
import { UserProfile } from './types';
import { toast } from 'sonner';

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
  setTheme: (theme: 'light' | 'dark') => void;
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
  setTheme: (theme) => set(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme };
  }),
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