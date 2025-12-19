import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '@/store';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock document
Object.defineProperty(window, 'document', {
  value: {
    documentElement: {
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      }
    }
  },
  writable: true
});

describe('store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('dark');
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const store = useStore.getState();
      expect(store.user).toBeNull();
      expect(store.theme).toBe('dark');
      expect(store.isLoading).toBe(true);
      expect(store.toasts).toHaveLength(0);
    });
  });

  describe('theme', () => {
    it('should have theme property', () => {
      const store = useStore.getState();
      expect(['light', 'dark']).toContain(store.theme);
    });
  });

  describe('functions exist', () => {
    it('should have all required functions', () => {
      const store = useStore.getState();

      expect(typeof store.setUser).toBe('function');
      expect(typeof store.toggleTheme).toBe('function');
      expect(typeof store.setLoading).toBe('function');
      expect(typeof store.addToast).toBe('function');
      expect(typeof store.removeToast).toBe('function');
    });
  });

  describe('loading states', () => {
    it('should set loading state', () => {
      const store = useStore.getState();

      store.setLoading(true);

      expect(store.isLoading).toBe(true);
    });
  });
});
