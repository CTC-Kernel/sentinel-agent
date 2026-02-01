import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useComplianceScore, useRecalculateScore } from '../useComplianceScore';
import { ScoreService } from '../../services/scoreService';
import type { GlobalComplianceScore as ComplianceScore, GlobalScoreHistory as ScoreHistory } from '../../types/score.types';

// Mock ScoreService
vi.mock('../../services/scoreService', () => ({
  ScoreService: {
    getComplianceScore: vi.fn(),
    getScoreHistory: vi.fn(),
    subscribeToScore: vi.fn(),
  },
}));

// Mock Firebase functions
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: { success: true } }))),
}));

const mockScore: ComplianceScore = {
  global: 75,
  byFramework: {
    iso27001: 80,
    nis2: 70,
    dora: 65,
    rgpd: 85,
  },
  trend: 'up',
  lastCalculated: new Date().toISOString(),
  breakdown: {
    risks: { score: 70, weight: 0.30 },
    controls: { score: 80, weight: 0.40 },
    documents: { score: 75, weight: 0.10 },
    audits: { score: 72, weight: 0.20 },
  },
};

const mockHistory: ScoreHistory[] = [
  { date: '2026-01-08', global: 70 },
  { date: '2026-01-09', global: 72 },
  { date: '2026-01-10', global: 75 },
];

describe('useComplianceScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return loading state initially', async () => {
    const unsubscribe = vi.fn();
    vi.mocked(ScoreService.subscribeToScore).mockImplementation(() => unsubscribe);
    const mockInitialHistory = [{ date: '2026-01-01', global: 50 }];
    vi.mocked(ScoreService.getScoreHistory).mockResolvedValue(mockInitialHistory);

    const { result } = renderHook(() => useComplianceScore('org-123'));

    expect(result.current.loading).toBe(true);
    expect(result.current.score).toBeNull();

    // Wait for history fetch to complete to avoid act() warning
    await waitFor(() => {
      expect(result.current.history).toEqual(mockInitialHistory);
    });

    // Loading should still be true because we haven't received the score update yet
    expect(result.current.loading).toBe(true);
  });

  it('should return null values when organizationId is undefined', async () => {
    const { result } = renderHook(() => useComplianceScore(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.score).toBeNull();
    expect(result.current.breakdown).toBeNull();
    expect(result.current.trend).toBeNull();
    expect(result.current.history).toEqual([]);
  });

  it('should subscribe to score updates when realtime is enabled', () => {
    const unsubscribe = vi.fn();
    vi.mocked(ScoreService.subscribeToScore).mockImplementation((_orgId, callback) => {
      callback(mockScore);
      return unsubscribe;
    });
    vi.mocked(ScoreService.getScoreHistory).mockResolvedValue(mockHistory);

    const { unmount } = renderHook(() =>
      useComplianceScore('org-123', { realtime: true })
    );

    expect(ScoreService.subscribeToScore).toHaveBeenCalledWith('org-123', expect.any(Function));

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should fetch score once when realtime is disabled', async () => {
    vi.mocked(ScoreService.getComplianceScore).mockResolvedValue(mockScore);
    vi.mocked(ScoreService.getScoreHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() =>
      useComplianceScore('org-123', { realtime: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(ScoreService.getComplianceScore).toHaveBeenCalledWith('org-123');
    expect(result.current.score).toEqual(mockScore);
  });

  it('should update score when subscription callback fires', async () => {
    const unsubscribe = vi.fn();
    let capturedCallback: ((score: ComplianceScore | null) => void) | null = null;

    vi.mocked(ScoreService.subscribeToScore).mockImplementation((_orgId, callback) => {
      capturedCallback = callback;
      return unsubscribe;
    });
    vi.mocked(ScoreService.getScoreHistory).mockResolvedValue([]);

    const { result } = renderHook(() => useComplianceScore('org-123'));

    // Initial state
    expect(result.current.loading).toBe(true);

    // Simulate score update
    act(() => {
      capturedCallback?.(mockScore);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.score).toEqual(mockScore);
    expect(result.current.breakdown).toEqual(mockScore.breakdown);
    expect(result.current.trend).toBe('up');
  });

  it('should handle subscription error', async () => {
    const unsubscribe = vi.fn();
    const error = new Error('Subscription failed');

    vi.mocked(ScoreService.subscribeToScore).mockImplementation((_orgId, callback) => {
      callback(null, error);
      return unsubscribe;
    });
    vi.mocked(ScoreService.getScoreHistory).mockResolvedValue([]);

    const { result } = renderHook(() => useComplianceScore('org-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.score).toBeNull();
  });

  it('should fetch history with correct number of days', async () => {
    const unsubscribe = vi.fn();
    vi.mocked(ScoreService.subscribeToScore).mockImplementation(() => unsubscribe);
    vi.mocked(ScoreService.getScoreHistory).mockResolvedValue(mockHistory);

    renderHook(() => useComplianceScore('org-123', { historyDays: 60 }));

    await waitFor(() => {
      expect(ScoreService.getScoreHistory).toHaveBeenCalledWith('org-123', 60);
    });
  });

  it('should update history state with fetched data', async () => {
    const unsubscribe = vi.fn();
    vi.mocked(ScoreService.subscribeToScore).mockImplementation((_orgId, callback) => {
      callback(mockScore);
      return unsubscribe;
    });
    vi.mocked(ScoreService.getScoreHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useComplianceScore('org-123'));

    await waitFor(() => {
      expect(result.current.history).toEqual(mockHistory);
    });
  });

  it('should handle fetch error gracefully', async () => {
    vi.mocked(ScoreService.getComplianceScore).mockRejectedValue(new Error('Fetch failed'));
    vi.mocked(ScoreService.getScoreHistory).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useComplianceScore('org-123', { realtime: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Fetch failed');
  });

  it('should re-subscribe when organizationId changes', async () => {
    const unsubscribe = vi.fn();
    vi.mocked(ScoreService.subscribeToScore).mockImplementation(() => unsubscribe);
    vi.mocked(ScoreService.getScoreHistory).mockResolvedValue([]);

    const { rerender } = renderHook(
      ({ orgId }) => useComplianceScore(orgId),
      { initialProps: { orgId: 'org-123' } }
    );

    expect(ScoreService.subscribeToScore).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ orgId: 'org-456' });
    });

    expect(unsubscribe).toHaveBeenCalled();
    expect(ScoreService.subscribeToScore).toHaveBeenCalledTimes(2);
  });
});

describe('useRecalculateScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide recalculate function', () => {
    const { result } = renderHook(() => useRecalculateScore());

    expect(result.current.recalculate).toBeDefined();
    expect(typeof result.current.recalculate).toBe('function');
  });

  it('should have initial state of not recalculating', () => {
    const { result } = renderHook(() => useRecalculateScore());

    expect(result.current.isRecalculating).toBe(false);
    expect(result.current.recalculateError).toBeNull();
  });

  it('should return null when organizationId is empty', async () => {
    const { result } = renderHook(() => useRecalculateScore());

    let returnValue;
    await act(async () => {
      returnValue = await result.current.recalculate('');
    });

    expect(returnValue).toBeNull();
  });
});
