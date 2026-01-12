/**
 * useDebounce Hook Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 500));
        expect(result.current).toBe('initial');
    });

    it('should debounce value updates', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 500 } }
        );

        expect(result.current).toBe('initial');

        // Update value
        rerender({ value: 'updated', delay: 500 });

        // Value should not update immediately
        expect(result.current).toBe('initial');

        // Fast forward past delay
        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Now value should be updated
        expect(result.current).toBe('updated');
    });

    it('should cancel previous timer on rapid updates', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 500 } }
        );

        // Rapid updates
        rerender({ value: 'update1', delay: 500 });
        act(() => {
            vi.advanceTimersByTime(200);
        });

        rerender({ value: 'update2', delay: 500 });
        act(() => {
            vi.advanceTimersByTime(200);
        });

        rerender({ value: 'final', delay: 500 });

        // Still showing initial value
        expect(result.current).toBe('initial');

        // Advance past last update
        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Should show final value, not intermediate ones
        expect(result.current).toBe('final');
    });

    it('should work with different delay values', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 1000 } }
        );

        rerender({ value: 'updated', delay: 1000 });

        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Not enough time passed
        expect(result.current).toBe('initial');

        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Now enough time passed
        expect(result.current).toBe('updated');
    });

    it('should work with number values', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 0, delay: 100 } }
        );

        rerender({ value: 42, delay: 100 });

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(result.current).toBe(42);
    });

    it('should work with object values', () => {
        const initialObj = { name: 'test' };
        const updatedObj = { name: 'updated' };

        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: initialObj, delay: 100 } }
        );

        expect(result.current).toBe(initialObj);

        rerender({ value: updatedObj, delay: 100 });

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(result.current).toBe(updatedObj);
    });

    it('should handle zero delay', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 0 } }
        );

        rerender({ value: 'updated', delay: 0 });

        act(() => {
            vi.advanceTimersByTime(0);
        });

        expect(result.current).toBe('updated');
    });
});
