/**
 * Unit tests for useDoubleSubmitPrevention hook
 * Tests double submit prevention and timeout handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
 ErrorLogger: {
 warn: vi.fn(),
 error: vi.fn()
 }
}));

import { useDoubleSubmitPrevention } from '../useDoubleSubmitPrevention';

describe('useDoubleSubmitPrevention', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('initialization', () => {
 it('initializes with default state', () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());

 expect(result.current.isSubmitting).toBe(false);
 expect(result.current.submitCount).toBe(0);
 });

 it('provides all expected functions', () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());

 expect(typeof result.current.handleSubmit).toBe('function');
 expect(typeof result.current.reset).toBe('function');
 });
 });

 describe('handleSubmit', () => {
 it('sets isSubmitting to true during submission', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 let resolveSubmit: () => void;
 const submitPromise = new Promise<void>(r => { resolveSubmit = r; });
 const submitFn = vi.fn().mockImplementation(() => submitPromise);

 act(() => {
 result.current.handleSubmit(submitFn);
 });

 expect(result.current.isSubmitting).toBe(true);

 await act(async () => {
 resolveSubmit!();
 await submitPromise;
 });
 });

 it('increments submitCount on each submit', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.handleSubmit(submitFn);
 });

 expect(result.current.submitCount).toBe(1);
 });

 it('prevents double submit when already submitting', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 let resolveFirst: () => void;
 const firstSubmit = new Promise<void>(r => { resolveFirst = r; });
 const secondSubmit = vi.fn().mockResolvedValue(undefined);

 // Start first submission
 act(() => {
 result.current.handleSubmit(() => firstSubmit);
 });

 // Try second submission while first is pending
 act(() => {
 result.current.handleSubmit(secondSubmit);
 });

 expect(secondSubmit).not.toHaveBeenCalled();

 // Resolve first submission
 await act(async () => {
 resolveFirst!();
 await firstSubmit;
 });
 });

 it('calls onSuccess callback on successful submission', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const submitFn = vi.fn().mockResolvedValue(undefined);
 const onSuccess = vi.fn();

 await act(async () => {
 await result.current.handleSubmit(submitFn, { onSuccess });
 });

 expect(onSuccess).toHaveBeenCalled();
 });

 it('calls onError callback on failed submission', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const error = new Error('Submit failed');
 const submitFn = vi.fn().mockRejectedValue(error);
 const onError = vi.fn();

 await act(async () => {
 await result.current.handleSubmit(submitFn, { onError });
 });

 expect(onError).toHaveBeenCalledWith(error);
 });

 it('resets isSubmitting on success when resetOnSuccess is true', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.handleSubmit(submitFn, { resetOnSuccess: true });
 });

 expect(result.current.isSubmitting).toBe(false);
 });

 it('keeps isSubmitting true when resetOnSuccess is false', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.handleSubmit(submitFn, { resetOnSuccess: false });
 });

 expect(result.current.isSubmitting).toBe(true);
 });

 it('resets isSubmitting on error', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const submitFn = vi.fn().mockRejectedValue(new Error('Failed'));

 await act(async () => {
 await result.current.handleSubmit(submitFn, { onError: vi.fn() });
 });

 expect(result.current.isSubmitting).toBe(false);
 });
 });

 describe('reset', () => {
 it('resets isSubmitting to false', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.handleSubmit(submitFn, { resetOnSuccess: false });
 });

 expect(result.current.isSubmitting).toBe(true);

 act(() => {
 result.current.reset();
 });

 expect(result.current.isSubmitting).toBe(false);
 });

 it('resets submitCount to 0', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.handleSubmit(submitFn);
 });

 expect(result.current.submitCount).toBe(1);

 act(() => {
 result.current.reset();
 });

 expect(result.current.submitCount).toBe(0);
 });
 });

 describe('options', () => {
 it('accepts timeout option', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.handleSubmit(submitFn, { timeout: 5000 });
 });

 expect(submitFn).toHaveBeenCalled();
 });

 it('uses default resetOnSuccess behavior', async () => {
 const { result } = renderHook(() => useDoubleSubmitPrevention());
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.handleSubmit(submitFn);
 });

 // Default is resetOnSuccess: true
 expect(result.current.isSubmitting).toBe(false);
 });
 });
});
