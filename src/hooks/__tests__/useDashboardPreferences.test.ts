/**
 * Tests for useDashboardPreferences hook
 * Story 2-6: Configurable Dashboard Widgets
 * Task 7.3: Test useDashboardPreferences Firestore save/load
 * Task 7.7: Test resetLayout restores role defaults
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDashboardPreferences, type WidgetLayout } from '../useDashboardPreferences';

// Mock Firebase
const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  serverTimestamp: () => 'server_timestamp',
}));

vi.mock('../../firebase', () => ({
  db: {},
}));

vi.mock('../../services/errorLogger', () => ({
  ErrorLogger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock getDefaultLayoutForRole
vi.mock('../../config/dashboardDefaults', () => ({
  getDefaultLayoutForRole: vi.fn((role: string) => {
    const layouts: Record<string, WidgetLayout[]> = {
      rssi: [
        { id: 'rssi-1', widgetId: 'rssi-critical-risks', colSpan: 2 },
        { id: 'rssi-2', widgetId: 'rssi-incidents', colSpan: 1 },
      ],
      direction: [
        { id: 'dir-1', widgetId: 'executive-kpi', colSpan: 3 },
        { id: 'dir-2', widgetId: 'compliance-score', colSpan: 1 },
      ],
      user: [
        { id: 'user-1', widgetId: 'my-workspace', colSpan: 2 },
        { id: 'user-2', widgetId: 'compliance-progress', colSpan: 1 },
      ],
    };
    return layouts[role] || layouts.user;
  }),
}));

describe('useDashboardPreferences', () => {
  const mockLocalStorage: Record<string, string> = {};
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
      },
      writable: true,
    });

    // Clear mock localStorage
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);

    // Default onSnapshot mock - immediately calls callback with empty doc
    mockOnSnapshot.mockImplementation((_docRef, onNext, _onError) => {
      // Simulate async behavior
      setTimeout(() => {
        onNext({
          exists: () => false,
          data: () => null,
        });
      }, 0);
      return mockUnsubscribe;
    });

    mockSetDoc.mockResolvedValue(undefined);
    mockDoc.mockReturnValue({ path: 'test/path' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should return default layout when no user', () => {
      const { result } = renderHook(() => useDashboardPreferences(undefined, undefined, 'user'));

      expect(result.current.layout).toBeDefined();
      expect(result.current.layout.length).toBeGreaterThan(0);
      expect(result.current.hasLoaded).toBe(true);
      expect(result.current.isCustomized).toBe(false);
    });

    it('should return role-specific default layout', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      await waitFor(() => {
        expect(result.current.hasLoaded).toBe(true);
      });

      expect(result.current.layout.some((w) => w.widgetId === 'rssi-critical-risks')).toBe(true);
    });

    it('should load from localStorage when Firestore doc does not exist', async () => {
      const storedLayout: WidgetLayout[] = [
        { id: 'stored-1', widgetId: 'custom-widget', colSpan: 2 },
      ];

      mockLocalStorage['sentinel_dashboard_prefs_v1_user-123_rssi'] = JSON.stringify({
        layout: storedLayout,
        customized: true,
      });

      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      // Initial state should include localStorage data
      expect(result.current.layout.some((w) => w.widgetId === 'custom-widget')).toBe(true);
      expect(result.current.isCustomized).toBe(true);
    });
  });

  describe('Firestore persistence', () => {
    it('should subscribe to Firestore updates', async () => {
      renderHook(() => useDashboardPreferences('user-123', 'tenant-123', 'rssi'));

      await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
      });

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'tenants/tenant-123/dashboardConfigs/user-123');
    });

    it('should update state when Firestore document changes', async () => {
      const firestoreLayout: WidgetLayout[] = [
        { id: 'fs-1', widgetId: 'firestore-widget', colSpan: 1 },
      ];

      mockOnSnapshot.mockImplementation((_docRef, onNext) => {
        setTimeout(() => {
          onNext({
            exists: () => true,
            data: () => ({
              layout: firestoreLayout,
              customized: true,
            }),
          });
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      await waitFor(() => {
        expect(result.current.hasLoaded).toBe(true);
      });

      expect(result.current.layout.some((w) => w.widgetId === 'firestore-widget')).toBe(true);
    });

    it('should unsubscribe from Firestore on unmount', async () => {
      const { unmount } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle Firestore errors gracefully', async () => {
      mockOnSnapshot.mockImplementation((_docRef, _onNext, onError) => {
        setTimeout(() => {
          onError(new Error('Firestore error'));
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      await waitFor(() => {
        expect(result.current.hasLoaded).toBe(true);
      });

      // Should still have default layout
      expect(result.current.layout.length).toBeGreaterThan(0);
    });
  });

  describe('updateLayout', () => {
    it('should update local state immediately', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      await waitFor(() => {
        expect(result.current.hasLoaded).toBe(true);
      });

      const newLayout: WidgetLayout[] = [
        { id: 'new-1', widgetId: 'new-widget', colSpan: 3 },
      ];

      act(() => {
        result.current.updateLayout(newLayout);
      });

      expect(result.current.layout).toEqual(newLayout);
      expect(result.current.isCustomized).toBe(true);
    });

    it('should save to localStorage immediately', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      await waitFor(() => {
        expect(result.current.hasLoaded).toBe(true);
      });

      const newLayout: WidgetLayout[] = [
        { id: 'new-1', widgetId: 'new-widget', colSpan: 3 },
      ];

      act(() => {
        result.current.updateLayout(newLayout);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'sentinel_dashboard_prefs_v1_user-123_rssi',
        expect.stringContaining('new-widget')
      );
    });

    it('should debounce Firestore saves', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      // Wait for initial load
      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      const newLayout: WidgetLayout[] = [
        { id: 'new-1', widgetId: 'new-widget', colSpan: 3 },
      ];

      act(() => {
        result.current.updateLayout(newLayout);
      });

      // Firestore should not be called immediately
      expect(mockSetDoc).not.toHaveBeenCalled();

      // Advance timers past debounce delay (1000ms)
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should not save when no userId', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences(undefined, 'tenant-123', 'rssi')
      );

      const newLayout: WidgetLayout[] = [
        { id: 'new-1', widgetId: 'new-widget', colSpan: 3 },
      ];

      act(() => {
        result.current.updateLayout(newLayout);
      });

      // Layout should not change without userId
      expect(result.current.layout).not.toEqual(newLayout);
    });
  });

  describe('resetLayout (Task 7.7)', () => {
    it('should reset to role defaults', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      await waitFor(() => {
        expect(result.current.hasLoaded).toBe(true);
      });

      // First customize the layout
      act(() => {
        result.current.updateLayout([
          { id: 'custom-1', widgetId: 'custom-widget', colSpan: 1 },
        ]);
      });

      expect(result.current.isCustomized).toBe(true);

      // Reset
      act(() => {
        result.current.resetLayout();
      });

      // Should have rssi defaults back
      expect(result.current.layout.some((w) => w.widgetId === 'rssi-critical-risks')).toBe(true);
      expect(result.current.isCustomized).toBe(false);
    });

    it('should clear localStorage on reset', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      await waitFor(() => {
        expect(result.current.hasLoaded).toBe(true);
      });

      act(() => {
        result.current.resetLayout();
      });

      expect(localStorage.removeItem).toHaveBeenCalledWith('sentinel_dashboard_prefs_v1_user-123_rssi');
    });

    it('should save reset state to Firestore', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      // Wait for initial load
      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      act(() => {
        result.current.resetLayout();
      });

      // Reset should save immediately (no debounce)
      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          customized: false,
        }),
        expect.anything()
      );
    });

    it('should restore direction defaults for direction role', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'direction')
      );

      await waitFor(() => {
        expect(result.current.hasLoaded).toBe(true);
      });

      // Customize
      act(() => {
        result.current.updateLayout([
          { id: 'custom-1', widgetId: 'custom-widget', colSpan: 1 },
        ]);
      });

      // Reset
      act(() => {
        result.current.resetLayout();
      });

      // Should have direction defaults
      expect(result.current.layout.some((w) => w.widgetId === 'executive-kpi')).toBe(true);
    });
  });

  describe('syncing state', () => {
    it('should have isSyncing property available', async () => {
      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      await waitFor(() => {
        expect(result.current.hasLoaded).toBe(true);
      });

      // isSyncing should be false initially
      expect(result.current.isSyncing).toBe(false);
    });

    it('should call setDoc when saving to Firestore', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      // Wait for initial load
      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      act(() => {
        result.current.updateLayout([
          { id: 'new-1', widgetId: 'new-widget', colSpan: 1 },
        ]);
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // setDoc should have been called
      expect(mockSetDoc).toHaveBeenCalled();
    });
  });

  describe('merging new widgets', () => {
    it('should merge new default widgets with stored layout', async () => {
      // Stored layout missing rssi-incidents
      const storedLayout: WidgetLayout[] = [
        { id: 'stored-1', widgetId: 'rssi-critical-risks', colSpan: 2 },
      ];

      mockLocalStorage['sentinel_dashboard_prefs_v1_user-123_rssi'] = JSON.stringify({
        layout: storedLayout,
        customized: true,
      });

      const { result } = renderHook(() =>
        useDashboardPreferences('user-123', 'tenant-123', 'rssi')
      );

      // Should have both stored widget and missing default widget
      expect(result.current.layout.some((w) => w.widgetId === 'rssi-critical-risks')).toBe(true);
      expect(result.current.layout.some((w) => w.widgetId === 'rssi-incidents')).toBe(true);
    });
  });
});
