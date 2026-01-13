/**
 * useConnectivity Hook Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectivity } from '../useConnectivity';

// Mock Firebase
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})),
    onAuthStateChanged: vi.fn((_auth, callback) => {
        // Simulate successful auth state change
        callback(null);
        return vi.fn(); // unsubscribe function
    })
    // If the intent was to add a new mock or modify it differently,
    // the instruction needs to provide a syntactically valid code snippet.
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(() => ({})),
    enableNetwork: vi.fn(),
    disableNetwork: vi.fn()
}));

describe('useConnectivity', () => {
    let originalNavigatorOnLine: boolean;
    let onlineHandler: (() => void) | null = null;
    let offlineHandler: (() => void) | null = null;

    beforeEach(() => {
        originalNavigatorOnLine = navigator.onLine;

        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: true
        });

        // Capture event handlers
        const originalAddEventListener = window.addEventListener;
        vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
            if (event === 'online') {
                onlineHandler = handler as () => void;
            } else if (event === 'offline') {
                offlineHandler = handler as () => void;
            }
            return originalAddEventListener.call(window, event, handler);
        });
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: originalNavigatorOnLine
        });
        onlineHandler = null;
        offlineHandler = null;
        vi.clearAllMocks();
    });

    it('should return online status when navigator is online', () => {
        const { result } = renderHook(() => useConnectivity());

        expect(result.current.isOnline).toBe(true);
    });

    it('should return operational statuses when online', () => {
        const { result } = renderHook(() => useConnectivity());

        expect(result.current.authStatus).toBe('operational');
        expect(result.current.dbStatus).toBe('operational');
        expect(result.current.storageStatus).toBe('operational');
        expect(result.current.edgeStatus).toBe('operational');
    });

    it('should return offline status when navigator is offline', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false
        });

        const { result } = renderHook(() => useConnectivity());

        expect(result.current.isOnline).toBe(false);
    });

    it('should return downtime statuses when offline', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false
        });

        const { result } = renderHook(() => useConnectivity());

        expect(result.current.storageStatus).toBe('downtime');
        expect(result.current.edgeStatus).toBe('downtime');
    });

    it('should add event listeners on mount', () => {
        renderHook(() => useConnectivity());

        expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
        expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should update status when online event fires', async () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false
        });

        const { result } = renderHook(() => useConnectivity());

        expect(result.current.isOnline).toBe(false);

        // Simulate coming online
        if (onlineHandler) {
            act(() => {
                Object.defineProperty(navigator, 'onLine', {
                    writable: true,
                    value: true
                });
                onlineHandler!();
            });
        }

        expect(result.current.isOnline).toBe(true);
    });

    it('should update status when offline event fires', () => {
        const { result } = renderHook(() => useConnectivity());

        expect(result.current.isOnline).toBe(true);

        // Simulate going offline
        if (offlineHandler) {
            act(() => {
                Object.defineProperty(navigator, 'onLine', {
                    writable: true,
                    value: false
                });
                offlineHandler!();
            });
        }

        expect(result.current.isOnline).toBe(false);
    });

    it('should cleanup event listeners on unmount', () => {
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount } = renderHook(() => useConnectivity());

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
});
