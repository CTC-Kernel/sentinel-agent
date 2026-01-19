/**
 * useSessionMonitor Hook Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionMetrics, useActivityRecorder } from '../useSessionMonitor';

// Mock session monitor
const mockMetrics = {
    sessionDuration: 60000,
    lastActivity: Date.now(),
    activityCount: 10,
};

const mockRecordActivity = vi.fn();
const mockGetMetrics = vi.fn(() => mockMetrics);

vi.mock('../../services/sessionMonitoringService', () => ({
    SessionMonitor: {
        getMetrics: () => mockGetMetrics(),
        recordActivity: () => mockRecordActivity(),
    },
}));

describe('useSessionMetrics', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return initial metrics', () => {
        const { result } = renderHook(() => useSessionMetrics());

        expect(result.current).toEqual(mockMetrics);
    });

    it('should update metrics every 5 seconds', async () => {
        const updatedMetrics = {
            sessionDuration: 65000,
            lastActivity: Date.now(),
            activityCount: 15,
        };

        mockGetMetrics.mockReturnValueOnce(mockMetrics).mockReturnValueOnce(updatedMetrics);

        const { result } = renderHook(() => useSessionMetrics());

        expect(result.current?.sessionDuration).toBe(60000);

        // Advance timer by 5 seconds
        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(result.current?.sessionDuration).toBe(65000);
    });

    it('should clear interval on unmount', () => {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        const { unmount } = renderHook(() => useSessionMetrics());

        unmount();

        expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should call getMetrics on interval', () => {
        const { unmount } = renderHook(() => useSessionMetrics());

        expect(mockGetMetrics).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(mockGetMetrics).toHaveBeenCalledTimes(2);

        // Clean up before next timer advance to avoid issues
        unmount();
    });
});

describe('useActivityRecorder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return a function', () => {
        const { result } = renderHook(() => useActivityRecorder());

        expect(typeof result.current).toBe('function');
    });

    it('should call SessionMonitor.recordActivity when invoked', () => {
        const { result } = renderHook(() => useActivityRecorder());

        result.current();

        expect(mockRecordActivity).toHaveBeenCalled();
    });

    it('should call recordActivity multiple times', () => {
        const { result } = renderHook(() => useActivityRecorder());

        result.current();
        result.current();
        result.current();

        expect(mockRecordActivity).toHaveBeenCalledTimes(3);
    });
});
