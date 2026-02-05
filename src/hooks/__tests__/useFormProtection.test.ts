/**
 * Unit tests for useFormProtection hook
 * Tests form protection with validation, field values, touched states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFormProtection } from '../useFormProtection';

// Mock useDoubleSubmitPrevention
vi.mock('../useDoubleSubmitPrevention', () => ({
 useDoubleSubmitPrevention: () => ({
 handleSubmit: vi.fn(async (fn: () => Promise<void>) => {
 await fn();
 })
 })
}));

describe('useFormProtection', () => {
 const initialData = {
 name: 'Test Name',
 email: 'test@example.com',
 description: ''
 };

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('initialization', () => {
 it('initializes with provided data', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 expect(result.current.formData).toEqual(initialData);
 expect(result.current.errors).toEqual({});
 expect(result.current.touched).toEqual({});
 expect(result.current.isSubmitting).toBe(false);
 expect(result.current.submitAttempt).toBe(0);
 });

 it('provides all expected functions', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 expect(typeof result.current.setFieldValue).toBe('function');
 expect(typeof result.current.setFieldTouched).toBe('function');
 expect(typeof result.current.validateForm).toBe('function');
 expect(typeof result.current.protectedSubmit).toBe('function');
 expect(typeof result.current.reset).toBe('function');
 });
 });

 describe('setFieldValue', () => {
 it('updates form data', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 act(() => {
 result.current.setFieldValue('name', 'New Name');
 });

 expect(result.current.formData.name).toBe('New Name');
 });

 it('validates field if already touched', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 // First touch the field
 act(() => {
 result.current.setFieldTouched('name');
 });

 // Then update with empty value
 act(() => {
 result.current.setFieldValue('name', '');
 });

 expect(result.current.errors.name).toBe('This field is required');
 });

 it('does not validate field if not touched', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 act(() => {
 result.current.setFieldValue('name', '');
 });

 expect(result.current.errors.name).toBeUndefined();
 });
 });

 describe('setFieldTouched', () => {
 it('marks field as touched', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 act(() => {
 result.current.setFieldTouched('name');
 });

 expect(result.current.touched.name).toBe(true);
 });

 it('validates field on touch', () => {
 const { result } = renderHook(() => useFormProtection({
 ...initialData,
 name: ''
 }));

 act(() => {
 result.current.setFieldTouched('name');
 });

 expect(result.current.errors.name).toBe('This field is required');
 });

 it('shows error for whitespace-only string', () => {
 const { result } = renderHook(() => useFormProtection({
 ...initialData,
 name: ' '
 }));

 act(() => {
 result.current.setFieldTouched('name');
 });

 expect(result.current.errors.name).toBe('This field cannot be empty');
 });

 it('no error for valid value', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 act(() => {
 result.current.setFieldTouched('name');
 });

 expect(result.current.errors.name).toBeNull();
 });
 });

 describe('validateForm', () => {
 it('returns true when all fields valid', () => {
 const { result } = renderHook(() => useFormProtection({
 name: 'Valid Name',
 email: 'valid@email.com'
 }));

 let isValid: boolean;
 act(() => {
 isValid = result.current.validateForm();
 });

 expect(isValid!).toBe(true);
 // Check that there are no error messages (null means valid)
 expect(result.current.errors.name === null || result.current.errors.name === undefined).toBe(true);
 expect(result.current.errors.email === null || result.current.errors.email === undefined).toBe(true);
 });

 it('returns false when fields are invalid', () => {
 const { result } = renderHook(() => useFormProtection({
 name: '',
 email: 'valid@email.com'
 }));

 let isValid: boolean;
 act(() => {
 isValid = result.current.validateForm();
 });

 expect(isValid!).toBe(false);
 expect(result.current.errors.name).toBe('This field is required');
 });

 it('marks all fields as touched', () => {
 const { result } = renderHook(() => useFormProtection({
 name: 'Name',
 email: 'Email'
 }));

 act(() => {
 result.current.validateForm();
 });

 expect(result.current.touched.name).toBe(true);
 expect(result.current.touched.email).toBe(true);
 });

 it('validates numeric zero as valid', () => {
 const { result } = renderHook(() => useFormProtection({
 count: 0
 }));

 let isValid: boolean;
 act(() => {
 isValid = result.current.validateForm();
 });

 expect(isValid!).toBe(true);
 // Zero should not produce an error
 expect(result.current.errors.count).toBeFalsy();
 });
 });

 describe('protectedSubmit', () => {
 it('increments submit attempt', async () => {
 const { result } = renderHook(() => useFormProtection(initialData));
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.protectedSubmit(submitFn);
 });

 expect(result.current.submitAttempt).toBe(1);
 });

 it('does not call submit function when validation fails', async () => {
 const { result } = renderHook(() => useFormProtection({
 name: '',
 email: ''
 }));
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.protectedSubmit(submitFn);
 });

 expect(submitFn).not.toHaveBeenCalled();
 });

 it('calls submit function when validation passes', async () => {
 const { result } = renderHook(() => useFormProtection({
 name: 'Valid',
 email: 'valid@test.com'
 }));
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.protectedSubmit(submitFn);
 });

 await waitFor(() => {
 expect(submitFn).toHaveBeenCalledWith({
  name: 'Valid',
  email: 'valid@test.com'
 });
 });
 });

 it('passes form data to submit function', async () => {
 const { result } = renderHook(() => useFormProtection({
 name: 'John Doe',
 role: 'Admin'
 }));
 const submitFn = vi.fn().mockResolvedValue(undefined);

 await act(async () => {
 await result.current.protectedSubmit(submitFn);
 });

 await waitFor(() => {
 expect(submitFn).toHaveBeenCalledWith({
  name: 'John Doe',
  role: 'Admin'
 });
 });
 });
 });

 describe('reset', () => {
 it('resets form data to initial values', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 act(() => {
 result.current.setFieldValue('name', 'Changed Name');
 });

 act(() => {
 result.current.reset();
 });

 expect(result.current.formData).toEqual(initialData);
 });

 it('clears errors', () => {
 const { result } = renderHook(() => useFormProtection({
 name: ''
 }));

 act(() => {
 result.current.setFieldTouched('name');
 });

 expect(result.current.errors.name).toBeDefined();

 act(() => {
 result.current.reset();
 });

 expect(result.current.errors).toEqual({});
 });

 it('clears touched state', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 act(() => {
 result.current.setFieldTouched('name');
 });

 expect(result.current.touched.name).toBe(true);

 act(() => {
 result.current.reset();
 });

 expect(result.current.touched).toEqual({});
 });

 it('resets isSubmitting to false', () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 act(() => {
 result.current.reset();
 });

 expect(result.current.isSubmitting).toBe(false);
 });

 it('resets submitAttempt to 0', async () => {
 const { result } = renderHook(() => useFormProtection(initialData));

 await act(async () => {
 await result.current.protectedSubmit(vi.fn());
 });

 expect(result.current.submitAttempt).toBe(1);

 act(() => {
 result.current.reset();
 });

 expect(result.current.submitAttempt).toBe(0);
 });
 });
});
