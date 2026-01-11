/* eslint-disable @typescript-eslint/no-explicit-any -- Test mocks require flexible typing */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCriticalRisks } from '../useCriticalRisks';

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

describe('useCriticalRisks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null count when tenantId is undefined', () => {
    const { result } = renderHook(() => useCriticalRisks(undefined));

    expect(result.current.count).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should set loading to true initially', () => {
    vi.mocked(onSnapshot).mockImplementation(() => () => {});

    const { result } = renderHook(() => useCriticalRisks('tenant-123'));

    expect(result.current.loading).toBe(true);
  });

  it('should return count from snapshot', async () => {
    const mockUnsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
      // Simulate snapshot with 3 critical risks
      setTimeout(() => {
        const mockSnapshot = {
          size: 3,
          docs: [
            { data: () => ({ impact: 5, probability: 4 }) }, // score: 20 (critical)
            { data: () => ({ impact: 4, probability: 4 }) }, // score: 16 (critical)
            { data: () => ({ impact: 3, probability: 3 }) }, // score: 9 (not critical)
          ]
        };
        (onNext as (snapshot: any) => void)(mockSnapshot);
      }, 0);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useCriticalRisks('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(2); // Only 2 critical risks (score >= 15)
  });

  it('should set initial trend to stable', async () => {
    vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
      setTimeout(() => {
        const mockSnapshot = {
          size: 5,
          docs: [
            { data: () => ({ impact: 5, probability: 4 }) }, // score: 20 (critical)
            { data: () => ({ impact: 4, probability: 4 }) }, // score: 16 (critical)
            { data: () => ({ impact: 3, probability: 3 }) }, // score: 9 (not critical)
            { data: () => ({ impact: 2, probability: 2 }) }, // score: 4 (not critical)
            { data: () => ({ impact: 1, probability: 1 }) }, // score: 1 (not critical)
          ]
        };
        (onNext as (snapshot: any) => void)(mockSnapshot);
      }, 0);
      return () => {};
    });

    const { result } = renderHook(() => useCriticalRisks('tenant-123'));

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

    const { result } = renderHook(() => useCriticalRisks('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(mockError);
  });

  it('should cleanup subscription on unmount', () => {
    const mockUnsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockImplementation(() => mockUnsubscribe);

    const { unmount } = renderHook(() => useCriticalRisks('tenant-123'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should provide refetch function', async () => {
    let callCount = 0;
    vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
      callCount++;
      setTimeout(() => {
        const mockSnapshot = {
          size: callCount,
          docs: Array(callCount).fill(null).map(() => ({
            data: () => ({ impact: 5, probability: 4 }) // score: 20 (critical)
          }))
        };
        (onNext as (snapshot: any) => void)(mockSnapshot);
      }, 0);
      return () => {};
    });

    const { result } = renderHook(() => useCriticalRisks('tenant-123'));

    await waitFor(() => {
      expect(result.current.count).toBe(1);
    });

    // Call refetch
    result.current.refetch();

    await waitFor(() => {
      expect(callCount).toBeGreaterThan(1);
    });
  });

  it('should return zero count when no critical risks', async () => {
    vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
      setTimeout(() => {
        const mockSnapshot = {
          size: 2,
          docs: [
            { data: () => ({ impact: 3, probability: 3 }) }, // score: 9 (not critical)
            { data: () => ({ impact: 2, probability: 2 }) }, // score: 4 (not critical)
          ]
        };
        (onNext as (snapshot: any) => void)(mockSnapshot);
      }, 0);
      return () => {};
    });

    const { result } = renderHook(() => useCriticalRisks('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(0); // No critical risks (all scores < 15)
  });
});
