import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOngoingAudits } from '../useOngoingAudits';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {},
}));

import { onSnapshot } from 'firebase/firestore';

describe('useOngoingAudits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null count when tenantId is undefined', () => {
    const { result } = renderHook(() => useOngoingAudits(undefined));

    expect(result.current.count).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should set loading to true initially', () => {
    vi.mocked(onSnapshot).mockImplementation(() => () => {});

    const { result } = renderHook(() => useOngoingAudits('tenant-123'));

    expect(result.current.loading).toBe(true);
  });

  it('should return count from snapshot', async () => {
    const mockUnsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
      setTimeout(() => {
        (onNext as (snapshot: { size: number }) => void)({ size: 2 });
      }, 0);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useOngoingAudits('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(2);
  });

  it('should set initial trend to stable', async () => {
    vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
      setTimeout(() => {
        (onNext as (snapshot: { size: number }) => void)({ size: 4 });
      }, 0);
      return () => {};
    });

    const { result } = renderHook(() => useOngoingAudits('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trend).toBe('stable');
  });

  it('should handle errors', async () => {
    const mockError = new Error('Test error');
    vi.mocked(onSnapshot).mockImplementation((_, __, onError) => {
      setTimeout(() => {
        (onError as (error: Error) => void)(mockError);
      }, 0);
      return () => {};
    });

    const { result } = renderHook(() => useOngoingAudits('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(mockError);
  });

  it('should cleanup subscription on unmount', () => {
    const mockUnsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockImplementation(() => mockUnsubscribe);

    const { unmount } = renderHook(() => useOngoingAudits('tenant-123'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should provide refetch function', async () => {
    let callCount = 0;
    vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
      callCount++;
      setTimeout(() => {
        (onNext as (snapshot: { size: number }) => void)({ size: callCount });
      }, 0);
      return () => {};
    });

    const { result } = renderHook(() => useOngoingAudits('tenant-123'));

    await waitFor(() => {
      expect(result.current.count).toBe(1);
    });

    // Call refetch
    result.current.refetch();

    await waitFor(() => {
      expect(callCount).toBeGreaterThan(1);
    });
  });

  it('should return zero count when no ongoing audits', async () => {
    vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
      setTimeout(() => {
        (onNext as (snapshot: { size: number }) => void)({ size: 0 });
      }, 0);
      return () => {};
    });

    const { result } = renderHook(() => useOngoingAudits('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(0);
  });
});
