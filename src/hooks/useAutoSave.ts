/**
 * useAutoSave Hook (Story 1.4)
 *
 * Provides auto-save functionality with debouncing, status tracking,
 * and error handling. Designed to work with any form data.
 *
 * @module useAutoSave
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Auto-save status states
 * - idle: No changes pending, no save in progress
 * - pending: Changes detected, waiting for debounce
 * - saving: Save operation in progress
 * - saved: Save completed successfully
 * - error: Save failed, retry available
 */
export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Options for configuring auto-save behavior
 */
export interface UseAutoSaveOptions<T> {
 /** The data to auto-save */
 data: T;
 /** Callback function to perform the save operation */
 onSave: (data: T) => Promise<void>;
 /** Whether auto-save is enabled (default: true) */
 enabled?: boolean;
 /** Debounce delay in milliseconds (default: 30000 = 30 seconds) */
 debounceMs?: number;
 /**
 * Custom equality function for comparing data changes.
 * Default: reference equality (===).
 * For deep comparison, pass a function like: (a, b) => JSON.stringify(a) === JSON.stringify(b)
 */
 isEqual?: (a: T, b: T) => boolean;
}

/**
 * Return type for the useAutoSave hook
 */
export interface UseAutoSaveReturn {
 /** Current auto-save status */
 status: AutoSaveStatus;
 /** Timestamp of last successful save */
 lastSavedAt: Date | null;
 /** Error from last failed save attempt */
 error: Error | null;
 /** Trigger an immediate save */
 save: () => Promise<void>;
 /** Retry the last failed save */
 retry: () => Promise<void>;
}

/** Default debounce delay: 30 seconds (per ADR-002) */
const DEFAULT_DEBOUNCE_MS = 30000;

/**
 * Hook for auto-saving data with debouncing and status tracking.
 *
 * Implements ADR-002: Draft/Auto-save system with:
 * - Debounced saves (default 30 seconds)
 * - Status tracking for UI indicators
 * - Error handling with retry capability
 *
 * @param options - Configuration options
 * @returns Auto-save state and control functions
 *
 * @example
 * ```tsx
 * const { status, lastSavedAt, error, retry } = useAutoSave({
 * data: formData,
 * onSave: async (data) => {
 * await api.saveForm(data);
 * },
 * debounceMs: 30000,
 * });
 *
 * return (
 * <div>
 * <AutoSaveIndicator
 * status={status}
 * lastSavedAt={lastSavedAt}
 * error={error}
 * onRetry={retry}
 * />
 * <form>{...}</form>
 * </div>
 * );
 * ```
 */
/** Default equality check: reference equality */
const defaultIsEqual = <T>(a: T, b: T): boolean => a === b;

export function useAutoSave<T>({
 data,
 onSave,
 enabled = true,
 debounceMs = DEFAULT_DEBOUNCE_MS,
 isEqual = defaultIsEqual,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
 const [status, setStatus] = useState<AutoSaveStatus>('idle');
 const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
 const [error, setError] = useState<Error | null>(null);

 // Refs to track state without causing effect re-runs
 const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const dataRef = useRef<T>(data);
 const initialDataRef = useRef<T>(data);
 const isFirstRender = useRef(true);
 const isSaving = useRef(false);

 // Update data ref whenever data changes
 dataRef.current = data;

 /**
 * Perform the actual save operation
 */
 const performSave = useCallback(async () => {
 if (isSaving.current) return;

 isSaving.current = true;
 setStatus('saving');
 setError(null);

 try {
 await onSave(dataRef.current);
 setStatus('saved');
 setLastSavedAt(new Date());
 setError(null);
 } catch (err) {
 setStatus('error');
 setError(err instanceof Error ? err : new Error(String(err)));
 } finally {
 isSaving.current = false;
 }
 }, [onSave]);

 /**
 * Clear any pending debounce timeout
 */
 const clearDebounce = useCallback(() => {
 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 timeoutRef.current = null;
 }
 }, []);

 /**
 * Trigger an immediate save (bypasses debounce)
 */
 const save = useCallback(async () => {
 clearDebounce();
 await performSave();
 }, [clearDebounce, performSave]);

 /**
 * Retry the last failed save
 */
 const retry = useCallback(async () => {
 await performSave();
 }, [performSave]);

 // Effect to handle data changes and trigger debounced saves
 useEffect(() => {
 // Skip the first render (initial mount)
 if (isFirstRender.current) {
 isFirstRender.current = false;
 return;
 }

 // Skip if auto-save is disabled
 if (!enabled) {
 return;
 }

 // Skip if data hasn't changed (using custom or default equality check)
 if (isEqual(data, initialDataRef.current)) {
 return;
 }

 // Update initial ref to current data for future comparisons
 initialDataRef.current = data;

 // Clear any existing timeout
 clearDebounce();

 // Set status to pending
 setStatus('pending');

 // Set up new debounce timeout
 timeoutRef.current = setTimeout(() => {
 performSave();
 }, debounceMs);

 // Cleanup on unmount or before next effect run
 return () => {
 clearDebounce();
 };
 }, [data, enabled, debounceMs, clearDebounce, performSave, isEqual]);

 // Reset status to idle when disabled (MEDIUM-3 fix)
 useEffect(() => {
 if (!enabled) {
 clearDebounce();
 setStatus('idle');
 }
 }, [enabled, clearDebounce]);

 return {
 status,
 lastSavedAt,
 error,
 save,
 retry,
 };
}

export default useAutoSave;
