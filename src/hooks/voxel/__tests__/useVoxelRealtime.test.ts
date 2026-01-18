/**
 * Unit tests for useVoxelRealtime hook
 *
 * Tests for:
 * - Firestore subscription setup
 * - Batch updates
 * - Debouncing
 * - Cleanup on unmount
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock dependencies before imports
const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  DocumentChange: vi.fn(),
}));

vi.mock('@/firebase', () => ({
  db: {},
}));

const mockUseStore = vi.fn();
vi.mock('@/store', () => ({
  useStore: () => mockUseStore(),
}));

const mockAddNode = vi.fn();
const mockUpdateNode = vi.fn();
const mockRemoveNode = vi.fn();
const mockSetSyncStatus = vi.fn();
const mockSetLastSyncAt = vi.fn();

vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn((selector) => {
    const state = {
      addNode: mockAddNode,
      updateNode: mockUpdateNode,
      removeNode: mockRemoveNode,
      setSyncStatus: mockSetSyncStatus,
      setLastSyncAt: mockSetLastSyncAt,
    };
    return selector(state);
  }),
}));

describe('useVoxelRealtime', () => {
  let unsubscribeMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    unsubscribeMock = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribeMock);
    mockCollection.mockReturnValue('collection-ref');
    mockQuery.mockReturnValue('query-ref');
    mockWhere.mockReturnValue('where-clause');

    mockUseStore.mockReturnValue({
      user: { organizationId: 'org-123', uid: 'user-123' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ============================================================================
  // Subscription Setup Tests
  // ============================================================================

  describe('subscription setup', () => {
    it('should setup listeners when enabled and user is authenticated', async () => {
      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() => useVoxelRealtime({ enabled: true }));

      await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
      });
    });

    it('should not setup listeners when disabled', async () => {
      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() => useVoxelRealtime({ enabled: false }));

      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it('should not setup listeners when user is not authenticated', async () => {
      mockUseStore.mockReturnValue({ user: null });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() => useVoxelRealtime({ enabled: true }));

      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it('should not setup listeners when organizationId is missing', async () => {
      mockUseStore.mockReturnValue({
        user: { uid: 'user-123' },
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() => useVoxelRealtime({ enabled: true }));

      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it('should setup listeners for all configured collections', async () => {
      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets', 'risks', 'controls'],
        })
      );

      await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalledTimes(3);
      });
    });

    it('should filter by organizationId in queries', async () => {
      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
        })
      );

      await waitFor(() => {
        expect(mockWhere).toHaveBeenCalledWith('organizationId', '==', 'org-123');
      });
    });
  });

  // ============================================================================
  // Snapshot Handling Tests
  // ============================================================================

  describe('snapshot handling', () => {
    it('should add nodes for "added" changes', async () => {
      vi.useFakeTimers();

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docChanges: () => [
            {
              type: 'added',
              doc: {
                id: 'asset-1',
                data: () => ({
                  name: 'Test Asset',
                  status: 'active',
                  createdAt: { toDate: () => new Date() },
                  updatedAt: { toDate: () => new Date() },
                }),
              },
            },
          ],
        });
        return unsubscribeMock;
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
          debounceMs: 0,
        })
      );

      // Advance timers to trigger debounced flush
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockAddNode).toHaveBeenCalled();
    });

    it('should update nodes for "modified" changes', async () => {
      vi.useFakeTimers();

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docChanges: () => [
            {
              type: 'modified',
              doc: {
                id: 'asset-1',
                data: () => ({
                  name: 'Updated Asset',
                  status: 'inactive',
                  createdAt: { toDate: () => new Date() },
                  updatedAt: { toDate: () => new Date() },
                }),
              },
            },
          ],
        });
        return unsubscribeMock;
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
          debounceMs: 0,
        })
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockUpdateNode).toHaveBeenCalled();
    });

    it('should remove nodes for "removed" changes', async () => {
      vi.useFakeTimers();

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docChanges: () => [
            {
              type: 'removed',
              doc: {
                id: 'asset-1',
                data: () => ({}),
              },
            },
          ],
        });
        return unsubscribeMock;
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
          debounceMs: 0,
        })
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockRemoveNode).toHaveBeenCalledWith('asset-1');
    });
  });

  // ============================================================================
  // Debouncing Tests
  // ============================================================================

  describe('debouncing', () => {
    it('should debounce batch updates', async () => {
      vi.useFakeTimers();

      let snapshotCallback: (snapshot: unknown) => void = () => {};

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        snapshotCallback = onSuccess;
        return unsubscribeMock;
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
          debounceMs: 100,
        })
      );

      // Simulate multiple rapid changes
      act(() => {
        snapshotCallback({
          docChanges: () => [
            { type: 'added', doc: { id: 'a1', data: () => ({ name: 'Asset 1' }) } },
          ],
        });
      });

      act(() => {
        snapshotCallback({
          docChanges: () => [
            { type: 'added', doc: { id: 'a2', data: () => ({ name: 'Asset 2' }) } },
          ],
        });
      });

      act(() => {
        snapshotCallback({
          docChanges: () => [
            { type: 'added', doc: { id: 'a3', data: () => ({ name: 'Asset 3' }) } },
          ],
        });
      });

      // Should not have flushed yet
      expect(mockAddNode).not.toHaveBeenCalled();

      // Advance past debounce time
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Now should have flushed
      expect(mockAddNode).toHaveBeenCalledTimes(3);
    });

    it('should use custom debounce time', async () => {
      vi.useFakeTimers();

      let snapshotCallback: (snapshot: unknown) => void = () => {};

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        snapshotCallback = onSuccess;
        return unsubscribeMock;
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
          debounceMs: 200,
        })
      );

      act(() => {
        snapshotCallback({
          docChanges: () => [
            { type: 'added', doc: { id: 'a1', data: () => ({ name: 'Asset 1' }) } },
          ],
        });
      });

      // Advance 100ms - should not have flushed
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(mockAddNode).not.toHaveBeenCalled();

      // Advance another 150ms - should have flushed
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(mockAddNode).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Sync Status Tests
  // ============================================================================

  describe('sync status', () => {
    it('should set sync status to syncing when starting', async () => {
      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
        })
      );

      await waitFor(() => {
        expect(mockSetSyncStatus).toHaveBeenCalledWith('syncing');
      });
    });

    it('should set sync status to connected after successful snapshot', async () => {
      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docChanges: () => [],
        });
        return unsubscribeMock;
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
        })
      );

      await waitFor(() => {
        expect(mockSetSyncStatus).toHaveBeenCalledWith('connected');
      });
    });

    it('should set sync status to offline on error', async () => {
      mockOnSnapshot.mockImplementation((_, _onSuccess, onError) => {
        onError(new Error('Network error'));
        return unsubscribeMock;
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
        })
      );

      await waitFor(() => {
        expect(mockSetSyncStatus).toHaveBeenCalledWith('offline');
      });
    });

    it('should update lastSyncAt after flushing updates', async () => {
      vi.useFakeTimers();

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docChanges: () => [
            { type: 'added', doc: { id: 'a1', data: () => ({ name: 'Asset 1' }) } },
          ],
        });
        return unsubscribeMock;
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
          debounceMs: 0,
        })
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockSetLastSyncAt).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('cleanup', () => {
    it('should unsubscribe from all listeners on unmount', async () => {
      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      const { unmount } = renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets', 'risks'],
        })
      );

      await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
      });

      unmount();

      // Should have unsubscribed from all listeners
      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should clear pending timers on unmount', async () => {
      vi.useFakeTimers();

      let snapshotCallback: (snapshot: unknown) => void = () => {};

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        snapshotCallback = onSuccess;
        return unsubscribeMock;
      });

      const { useVoxelRealtime } = await import('../useVoxelRealtime');

      const { unmount } = renderHook(() =>
        useVoxelRealtime({
          enabled: true,
          collections: ['assets'],
          debounceMs: 100,
        })
      );

      // Trigger a change to start the debounce timer
      act(() => {
        snapshotCallback({
          docChanges: () => [
            { type: 'added', doc: { id: 'a1', data: () => ({ name: 'Asset 1' }) } },
          ],
        });
      });

      // Unmount before timer fires
      unmount();

      // Advance timers after unmount
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Should not have called addNode since component unmounted
      expect(mockAddNode).not.toHaveBeenCalled();
    });
  });
});
