/**
 * usePersistedState Hook Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedState } from '../usePersistedState';

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        warn: vi.fn()
    }
}));

describe('usePersistedState', () => {
    let mockLocalStorage: Record<string, string>;

    beforeEach(() => {
        mockLocalStorage = {};

        // Mock localStorage
        const localStorageMock = {
            getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
            setItem: vi.fn((key: string, value: string) => {
                mockLocalStorage[key] = value;
            }),
            removeItem: vi.fn((key: string) => {
                delete mockLocalStorage[key];
            }),
            clear: vi.fn(() => {
                mockLocalStorage = {};
            })
        };

        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
            writable: true
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return initial value when localStorage is empty', () => {
        const { result } = renderHook(() => usePersistedState('testKey', 'initial'));

        expect(result.current[0]).toBe('initial');
    });

    it('should return value from localStorage if present', () => {
        mockLocalStorage['existingKey'] = JSON.stringify('stored value');

        const { result } = renderHook(() => usePersistedState('existingKey', 'initial'));

        expect(result.current[0]).toBe('stored value');
    });

    it('should update state and localStorage when setValue is called', () => {
        const { result } = renderHook(() => usePersistedState('testKey', 'initial'));

        act(() => {
            result.current[1]('new value');
        });

        expect(result.current[0]).toBe('new value');
        expect(mockLocalStorage['testKey']).toBe(JSON.stringify('new value'));
    });

    it('should support function updates', () => {
        const { result } = renderHook(() => usePersistedState<number>('counter', 0));

        act(() => {
            result.current[1](prev => prev + 1);
        });

        expect(result.current[0]).toBe(1);

        act(() => {
            result.current[1](prev => prev + 10);
        });

        expect(result.current[0]).toBe(11);
    });

    it('should work with object values', () => {
        const { result } = renderHook(() => usePersistedState('user', { name: 'John', age: 30 }));

        expect(result.current[0]).toEqual({ name: 'John', age: 30 });

        act(() => {
            result.current[1]({ name: 'Jane', age: 25 });
        });

        expect(result.current[0]).toEqual({ name: 'Jane', age: 25 });
    });

    it('should work with array values', () => {
        const { result } = renderHook(() => usePersistedState<string[]>('items', []));

        act(() => {
            result.current[1](['a', 'b', 'c']);
        });

        expect(result.current[0]).toEqual(['a', 'b', 'c']);
    });

    it('should work with boolean values', () => {
        const { result } = renderHook(() => usePersistedState('flag', false));

        act(() => {
            result.current[1](true);
        });

        expect(result.current[0]).toBe(true);
    });

    it('should work with null values', () => {
        const { result } = renderHook(() => usePersistedState<string | null>('nullable', null));

        expect(result.current[0]).toBeNull();

        act(() => {
            result.current[1]('not null');
        });

        expect(result.current[0]).toBe('not null');
    });

    it('should handle JSON parse errors gracefully', async () => {
        mockLocalStorage['badJson'] = 'not valid json';

        const { result } = renderHook(() => usePersistedState('badJson', 'fallback'));

        expect(result.current[0]).toBe('fallback');

        const { ErrorLogger } = await import('../../services/errorLogger');
        expect(ErrorLogger.warn).toHaveBeenCalled();
    });

    it('should handle localStorage.setItem errors gracefully', async () => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = vi.fn(() => {
            throw new Error('Storage full');
        });

        const { result } = renderHook(() => usePersistedState('errorKey', 'initial'));

        act(() => {
            result.current[1]('new value');
        });

        // State should still update even if localStorage fails
        expect(result.current[0]).toBe('new value');

        const { ErrorLogger } = await import('../../services/errorLogger');
        expect(ErrorLogger.warn).toHaveBeenCalled();

        localStorage.setItem = originalSetItem;
    });

    it('should use different keys independently', () => {
        const { result: result1 } = renderHook(() => usePersistedState('key1', 'value1'));
        const { result: result2 } = renderHook(() => usePersistedState('key2', 'value2'));

        expect(result1.current[0]).toBe('value1');
        expect(result2.current[0]).toBe('value2');

        act(() => {
            result1.current[1]('updated1');
        });

        expect(result1.current[0]).toBe('updated1');
        expect(result2.current[0]).toBe('value2');
    });

    it('should persist across re-renders', () => {
        const { result, rerender } = renderHook(() => usePersistedState('persistKey', 'initial'));

        act(() => {
            result.current[1]('persisted');
        });

        rerender();

        expect(result.current[0]).toBe('persisted');
    });
});
