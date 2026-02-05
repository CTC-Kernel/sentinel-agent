/**
 * Unit tests for useFieldValidation hook (Story 1.5)
 *
 * Tests for field-level validation with blur and delay triggers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { useFieldValidation } from '../useFieldValidation';

// Mock useLocale hook
vi.mock('../useLocale', () => ({
 useLocale: () => ({ locale: 'fr' }),
}));

describe('useFieldValidation', () => {
 beforeEach(() => {
 vi.useFakeTimers();
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 describe('initialization', () => {
 it('starts with idle state', () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema })
 );

 expect(result.current.state).toBe('idle');
 expect(result.current.error).toBeNull();
 expect(result.current.value).toBeUndefined();
 });

 it('accepts initial value', () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, initialValue: 'test' })
 );

 expect(result.current.value).toBe('test');
 expect(result.current.state).toBe('idle');
 });
 });

 describe('setValue', () => {
 it('updates value without triggering validation immediately', () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur' })
 );

 act(() => {
 result.current.setValue('ab');
 });

 expect(result.current.value).toBe('ab');
 expect(result.current.state).toBe('idle');
 expect(result.current.error).toBeNull();
 });
 });

 describe('blur trigger', () => {
 it('validates on blur when trigger is blur', () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur' })
 );

 act(() => {
 result.current.setValue('ab');
 });

 act(() => {
 result.current.onBlur();
 });

 // Validation is synchronous, so state should be updated immediately
 expect(result.current.state).toBe('invalid');
 expect(result.current.error).not.toBeNull();
 });

 it('shows valid state on blur with valid value', () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur' })
 );

 act(() => {
 result.current.setValue('valid');
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.state).toBe('valid');
 expect(result.current.error).toBeNull();
 });
 });

 describe('delay trigger', () => {
 it('validates after delay when trigger is delay', async () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'delay', delayMs: 500 })
 );

 act(() => {
 result.current.setValue('ab');
 });

 // Before delay, should still be idle
 expect(result.current.state).toBe('idle');

 // Advance timers
 await act(async () => {
 vi.advanceTimersByTime(500);
 });

 expect(result.current.state).toBe('invalid');
 expect(result.current.error).not.toBeNull();
 });

 it('debounces validation on rapid value changes', async () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'delay', delayMs: 500 })
 );

 // Type rapidly
 act(() => {
 result.current.setValue('a');
 });

 await act(async () => {
 vi.advanceTimersByTime(200);
 });

 act(() => {
 result.current.setValue('ab');
 });

 await act(async () => {
 vi.advanceTimersByTime(200);
 });

 act(() => {
 result.current.setValue('abc');
 });

 // Still idle because timer keeps resetting
 expect(result.current.state).toBe('idle');

 // Now wait full delay
 await act(async () => {
 vi.advanceTimersByTime(500);
 });

 // Should validate the final value
 expect(result.current.state).toBe('valid');
 });

 it('uses default delay of 500ms', async () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'delay' })
 );

 act(() => {
 result.current.setValue('ab');
 });

 // At 400ms, should still be idle
 await act(async () => {
 vi.advanceTimersByTime(400);
 });

 expect(result.current.state).toBe('idle');

 // At 500ms, should validate
 await act(async () => {
 vi.advanceTimersByTime(100);
 });

 expect(result.current.state).toBe('invalid');
 });
 });

 describe('both trigger', () => {
 it('validates on both blur and delay', async () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'both', delayMs: 500 })
 );

 // Test blur trigger
 act(() => {
 result.current.setValue('ab');
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.state).toBe('invalid');

 // Reset
 act(() => {
 result.current.reset();
 });

 expect(result.current.state).toBe('idle');

 // Test delay trigger
 act(() => {
 result.current.setValue('xy');
 });

 await act(async () => {
 vi.advanceTimersByTime(500);
 });

 expect(result.current.state).toBe('invalid');
 });
 });

 describe('manual validate', () => {
 it('allows manual validation trigger', async () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur' })
 );

 act(() => {
 result.current.setValue('ab');
 });

 let isValid: boolean = false;
 await act(async () => {
 isValid = await result.current.validate();
 });

 expect(isValid).toBe(false);
 expect(result.current.state).toBe('invalid');
 });

 it('returns true for valid values', async () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur' })
 );

 act(() => {
 result.current.setValue('valid');
 });

 let isValid: boolean = false;
 await act(async () => {
 isValid = await result.current.validate();
 });

 expect(isValid).toBe(true);
 expect(result.current.state).toBe('valid');
 });
 });

 describe('reset', () => {
 it('resets to initial state', () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur', initialValue: 'test' })
 );

 act(() => {
 result.current.setValue('ab');
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.state).toBe('invalid');

 act(() => {
 result.current.reset();
 });

 expect(result.current.state).toBe('idle');
 expect(result.current.value).toBe('test');
 expect(result.current.error).toBeNull();
 });
 });

 describe('error messages', () => {
 it('exposes Zod error message when invalid', () => {
 const schema = z.string().min(3, 'At least 3 characters');

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur' })
 );

 act(() => {
 result.current.setValue('ab');
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.error).toBe('At least 3 characters');
 });

 it('clears error when value becomes valid', () => {
 const schema = z.string().min(3);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur' })
 );

 // First, make it invalid
 act(() => {
 result.current.setValue('ab');
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.state).toBe('invalid');

 // Now make it valid
 act(() => {
 result.current.setValue('valid');
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.state).toBe('valid');
 expect(result.current.error).toBeNull();
 });
 });

 describe('complex schemas', () => {
 it('works with email validation', () => {
 const schema = z.string().email();

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur' })
 );

 act(() => {
 result.current.setValue('not-an-email');
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.state).toBe('invalid');

 act(() => {
 result.current.setValue('test@example.com');
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.state).toBe('valid');
 });

 it('works with number schemas', () => {
 const schema = z.coerce.number().min(0).max(100);

 const { result } = renderHook(() =>
 useFieldValidation({ schema, trigger: 'blur' })
 );

 act(() => {
 result.current.setValue(150);
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.state).toBe('invalid');

 act(() => {
 result.current.setValue(50);
 });

 act(() => {
 result.current.onBlur();
 });

 expect(result.current.state).toBe('valid');
 });
 });
});
