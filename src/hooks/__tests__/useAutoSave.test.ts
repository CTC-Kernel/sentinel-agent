/**
 * Unit tests for useAutoSave hook (Story 1.4)
 *
 * Tests for auto-save functionality with debouncing and status tracking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '../useAutoSave';

// Mock useLocale hook
vi.mock('../useLocale', () => ({
 useLocale: () => ({ locale: 'fr' }),
}));

describe('useAutoSave', () => {
 beforeEach(() => {
 vi.useFakeTimers();
 });

 afterEach(() => {
 vi.useRealTimers();
 vi.clearAllMocks();
 });

 describe('initialization', () => {
 it('initializes with idle status', () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { result } = renderHook(() =>
 useAutoSave({
 data: { title: 'Test' },
 onSave,
 })
 );

 expect(result.current.status).toBe('idle');
 expect(result.current.lastSavedAt).toBeNull();
 expect(result.current.error).toBeNull();
 });

 it('respects enabled option when false', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 enabled: false,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Change data
 rerender({ data: { title: 'Changed' } });

 // Advance timers
 await act(async () => {
 await vi.advanceTimersByTimeAsync(35000);
 });

 // Should not trigger save
 expect(onSave).not.toHaveBeenCalled();
 expect(result.current.status).toBe('idle');
 });

 it('uses default debounceMs of 30000', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Change data to trigger debounce
 rerender({ data: { title: 'Changed' } });

 // Should not save before 30 seconds
 await act(async () => {
 await vi.advanceTimersByTimeAsync(29000);
 });
 expect(onSave).not.toHaveBeenCalled();

 // Should save after 30 seconds
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });
 expect(onSave).toHaveBeenCalledWith({ title: 'Changed' });
 });
 });

 describe('debounce behavior', () => {
 it('triggers save after debounce delay', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 5000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Change data
 rerender({ data: { title: 'Changed' } });

 // Should not save immediately
 expect(onSave).not.toHaveBeenCalled();

 // Advance time past debounce
 await act(async () => {
 await vi.advanceTimersByTimeAsync(5500);
 });

 expect(onSave).toHaveBeenCalledWith({ title: 'Changed' });
 });

 it('resets debounce timer on subsequent data changes', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 5000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // First change
 rerender({ data: { title: 'First' } });

 // Wait 3 seconds
 await act(async () => {
 await vi.advanceTimersByTimeAsync(3000);
 });

 // Second change - should reset timer
 rerender({ data: { title: 'Second' } });

 // Wait another 3 seconds (6 seconds from first change, 3 from second)
 await act(async () => {
 await vi.advanceTimersByTimeAsync(3000);
 });

 // Should not have saved yet (only 3s since last change)
 expect(onSave).not.toHaveBeenCalled();

 // Wait 2 more seconds (5 seconds from second change)
 await act(async () => {
 await vi.advanceTimersByTimeAsync(2500);
 });

 // Now should have saved with latest data
 expect(onSave).toHaveBeenCalledWith({ title: 'Second' });
 expect(onSave).toHaveBeenCalledTimes(1);
 });

 it('does not trigger save if data has not changed', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);
 const data = { title: 'Same' };

 const { rerender } = renderHook(
 ({ data: d }) =>
 useAutoSave({
 data: d,
 onSave,
 debounceMs: 5000,
 }),
 { initialProps: { data } }
 );

 // Rerender with same reference
 rerender({ data });

 // Advance time
 await act(async () => {
 await vi.advanceTimersByTimeAsync(10000);
 });

 // Should not save because data reference is the same
 expect(onSave).not.toHaveBeenCalled();
 });
 });

 describe('status transitions', () => {
 it('transitions idle → pending → saving → saved on successful save', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 1000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Initial state
 expect(result.current.status).toBe('idle');

 // Change data → should go to pending
 rerender({ data: { title: 'Changed' } });

 // After rerender, status should be pending
 expect(result.current.status).toBe('pending');

 // Advance past debounce and wait for promise to resolve
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });

 // After save completes, should be saved
 expect(result.current.status).toBe('saved');
 });

 it('transitions to error status on save failure', async () => {
 const saveError = new Error('Network error');
 const onSave = vi.fn().mockRejectedValue(saveError);

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 1000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Change data
 rerender({ data: { title: 'Changed' } });

 // Advance past debounce
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });

 // Should be in error state
 expect(result.current.status).toBe('error');
 expect(result.current.error).toBe(saveError);
 });

 it('resets to pending when data changes while in saved state', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 1000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // First save cycle
 rerender({ data: { title: 'First' } });
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });

 expect(result.current.status).toBe('saved');

 // Change data again
 rerender({ data: { title: 'Second' } });

 expect(result.current.status).toBe('pending');
 });
 });

 describe('lastSavedAt timestamp', () => {
 it('updates lastSavedAt after successful save', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 1000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 expect(result.current.lastSavedAt).toBeNull();

 // Trigger save
 rerender({ data: { title: 'Changed' } });
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });

 expect(result.current.lastSavedAt).toBeInstanceOf(Date);
 });

 it('does not update lastSavedAt on failed save', async () => {
 const onSave = vi.fn().mockRejectedValue(new Error('Failed'));

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 1000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Trigger save
 rerender({ data: { title: 'Changed' } });
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });

 expect(result.current.status).toBe('error');
 expect(result.current.lastSavedAt).toBeNull();
 });
 });

 describe('error handling and retry', () => {
 it('exposes error when save fails', async () => {
 const saveError = new Error('Save failed');
 const onSave = vi.fn().mockRejectedValue(saveError);

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 1000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Trigger save
 rerender({ data: { title: 'Changed' } });
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });

 expect(result.current.error?.message).toBe('Save failed');
 });

 it('retry function attempts save again', async () => {
 const onSave = vi
 .fn()
 .mockRejectedValueOnce(new Error('First failure'))
 .mockResolvedValueOnce(undefined);

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 1000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Trigger initial save that fails
 rerender({ data: { title: 'Changed' } });
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });

 expect(result.current.status).toBe('error');
 expect(onSave).toHaveBeenCalledTimes(1);

 // Retry
 await act(async () => {
 await result.current.retry();
 });

 expect(onSave).toHaveBeenCalledTimes(2);
 expect(result.current.status).toBe('saved');
 expect(result.current.error).toBeNull();
 });

 it('clears error on successful retry', async () => {
 const onSave = vi
 .fn()
 .mockRejectedValueOnce(new Error('Failed'))
 .mockResolvedValueOnce(undefined);

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 1000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Trigger failing save
 rerender({ data: { title: 'Changed' } });
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });

 expect(result.current.error).not.toBeNull();

 // Retry successfully
 await act(async () => {
 await result.current.retry();
 });

 expect(result.current.error).toBeNull();
 expect(result.current.status).toBe('saved');
 });
 });

 describe('manual save', () => {
 it('save function triggers immediate save', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { result, rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 30000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Change data
 rerender({ data: { title: 'Changed' } });

 // Call save directly without waiting for debounce
 await act(async () => {
 await result.current.save();
 });

 expect(onSave).toHaveBeenCalledWith({ title: 'Changed' });
 });
 });

 describe('cleanup', () => {
 it('clears timeout on unmount', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { rerender, unmount } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 5000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 // Trigger debounce
 rerender({ data: { title: 'Changed' } });

 // Unmount before debounce fires
 unmount();

 // Advance time
 await act(async () => {
 await vi.advanceTimersByTimeAsync(10000);
 });

 // Save should not have been called
 expect(onSave).not.toHaveBeenCalled();
 });
 });

 describe('configurable debounce', () => {
 it('uses custom debounceMs value', async () => {
 const onSave = vi.fn().mockResolvedValue(undefined);

 const { rerender } = renderHook(
 ({ data }) =>
 useAutoSave({
 data,
 onSave,
 debounceMs: 2000,
 }),
 { initialProps: { data: { title: 'Initial' } } }
 );

 rerender({ data: { title: 'Changed' } });

 // Should not save before 2 seconds
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1500);
 });
 expect(onSave).not.toHaveBeenCalled();

 // Should save after 2 seconds
 await act(async () => {
 await vi.advanceTimersByTimeAsync(1000);
 });
 expect(onSave).toHaveBeenCalled();
 });
 });
});
