/**
 * useSyncStatus Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncStatus } from '../useSyncStatus';

describe('useSyncStatus', () => {
    let originalOnLine: boolean;

    beforeEach(() => {
        originalOnLine = navigator.onLine;
        vi.clearAllMocks();
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'onLine', {
            value: originalOnLine,
            writable: true
        });
    });

    it('should return initial online state from navigator', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true
        });

        const { result } = renderHook(() => useSyncStatus());

        expect(result.current.isOnline).toBe(true);
    });

    it('should return initial offline state from navigator', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: false,
            writable: true
        });

        const { result } = renderHook(() => useSyncStatus());

        expect(result.current.isOnline).toBe(false);
    });

    it('should have lastSynced as Date initially', () => {
        const { result } = renderHook(() => useSyncStatus());

        expect(result.current.lastSynced).toBeInstanceOf(Date);
    });

    it('should update to offline when offline event fires', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true
        });

        const { result } = renderHook(() => useSyncStatus());

        expect(result.current.isOnline).toBe(true);

        act(() => {
            Object.defineProperty(navigator, 'onLine', {
                value: false,
                writable: true
            });
            window.dispatchEvent(new Event('offline'));
        });

        expect(result.current.isOnline).toBe(false);
    });

    it('should update to online when online event fires', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: false,
            writable: true
        });

        const { result } = renderHook(() => useSyncStatus());

        expect(result.current.isOnline).toBe(false);

        act(() => {
            Object.defineProperty(navigator, 'onLine', {
                value: true,
                writable: true
            });
            window.dispatchEvent(new Event('online'));
        });

        expect(result.current.isOnline).toBe(true);
    });

    it('should update lastSynced when coming back online', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: false,
            writable: true
        });

        const { result } = renderHook(() => useSyncStatus());

        const initialSyncTime = result.current.lastSynced;

        // Wait a bit to ensure different timestamps
        vi.useFakeTimers();
        vi.advanceTimersByTime(1000);

        act(() => {
            window.dispatchEvent(new Event('online'));
        });

        expect(result.current.lastSynced).not.toBe(initialSyncTime);

        vi.useRealTimers();
    });

    it('should clean up event listeners on unmount', () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount } = renderHook(() => useSyncStatus());

        expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });
});
