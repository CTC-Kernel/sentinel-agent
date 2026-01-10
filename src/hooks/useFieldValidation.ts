/**
 * useFieldValidation Hook (Story 1.5)
 *
 * Provides field-level validation with blur and delay triggers.
 * Integrates with Zod schemas for type-safe validation.
 *
 * @module useFieldValidation
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { z } from 'zod';

/**
 * Validation state for a field
 * - idle: No validation has run yet
 * - valid: Field value passed validation
 * - invalid: Field value failed validation
 *
 * Note: 'validating' state was removed as validation is synchronous via Zod safeParse.
 * If async validation is needed in the future, add 'validating' state back.
 */
export type FieldValidationState = 'idle' | 'valid' | 'invalid';

/**
 * Validation trigger mode
 * - blur: Validate when field loses focus
 * - delay: Validate after a delay when user stops typing
 * - both: Validate on both blur and delay
 */
export type ValidationTrigger = 'blur' | 'delay' | 'both';

/**
 * Options for configuring field validation behavior
 */
export interface UseFieldValidationOptions<T> {
  /** Zod schema for field validation */
  schema: z.ZodType<T>;
  /** Validation trigger mode (default: 'blur') */
  trigger?: ValidationTrigger;
  /** Delay in ms for delay trigger (default: 500) */
  delayMs?: number;
  /** Initial value */
  initialValue?: T;
}

/**
 * Return type for the useFieldValidation hook
 */
export interface UseFieldValidationReturn<T> {
  /** Current validation state */
  state: FieldValidationState;
  /** Current field value */
  value: T | undefined;
  /** Error message if invalid */
  error: string | null;
  /** Set field value */
  setValue: (value: T) => void;
  /** Trigger validation manually */
  validate: () => Promise<boolean>;
  /** Handle blur event */
  onBlur: () => void;
  /** Reset to initial state */
  reset: () => void;
}

/** Default validation delay in milliseconds */
const DEFAULT_DELAY_MS = 500;

/**
 * Hook for field-level validation with configurable triggers.
 *
 * Supports validation on blur, after a delay, or both.
 * Integrates with Zod schemas for type-safe validation.
 *
 * @param options - Configuration options
 * @returns Validation state and control functions
 *
 * @example
 * ```tsx
 * const { state, value, error, setValue, onBlur } = useFieldValidation({
 *   schema: z.string().min(3),
 *   trigger: 'blur',
 * });
 *
 * return (
 *   <input
 *     value={value || ''}
 *     onChange={(e) => setValue(e.target.value)}
 *     onBlur={onBlur}
 *     className={state === 'invalid' ? 'border-red-500' : ''}
 *   />
 * );
 * ```
 */
export function useFieldValidation<T>({
  schema,
  trigger = 'blur',
  delayMs = DEFAULT_DELAY_MS,
  initialValue,
}: UseFieldValidationOptions<T>): UseFieldValidationReturn<T> {
  const [state, setState] = useState<FieldValidationState>('idle');
  const [value, setValue] = useState<T | undefined>(initialValue);
  const [error, setError] = useState<string | null>(null);

  // Refs for managing debounce
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialValueRef = useRef<T | undefined>(initialValue);

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
   * Perform validation against the schema (synchronous for predictable behavior)
   */
  const performValidation = useCallback(
    (valueToValidate: T | undefined): boolean => {
      const result = schema.safeParse(valueToValidate);

      if (result.success) {
        setState('valid');
        setError(null);
        return true;
      } else {
        // Zod v4 uses 'issues' property
        const firstIssue = result.error.issues?.[0];
        setError(firstIssue?.message || 'Validation failed');
        setState('invalid');
        return false;
      }
    },
    [schema]
  );

  /**
   * Set the field value and optionally trigger delay validation
   */
  const setValueWithTrigger = useCallback(
    (newValue: T) => {
      setValue(newValue);

      // If trigger includes delay, set up debounced validation
      if (trigger === 'delay' || trigger === 'both') {
        clearDebounce();
        timeoutRef.current = setTimeout(() => {
          performValidation(newValue);
        }, delayMs);
      }
    },
    [trigger, delayMs, clearDebounce, performValidation]
  );

  /**
   * Handle blur event - validate if trigger includes blur
   */
  const handleBlur = useCallback(() => {
    if (trigger === 'blur' || trigger === 'both') {
      clearDebounce();
      performValidation(value);
    }
  }, [trigger, value, clearDebounce, performValidation]);

  /**
   * Manually trigger validation
   */
  const validate = useCallback((): Promise<boolean> => {
    clearDebounce();
    const result = performValidation(value);
    return Promise.resolve(result);
  }, [value, clearDebounce, performValidation]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    clearDebounce();
    setState('idle');
    setValue(initialValueRef.current);
    setError(null);
  }, [clearDebounce]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearDebounce();
    };
  }, [clearDebounce]);

  return {
    state,
    value,
    error,
    setValue: setValueWithTrigger,
    validate,
    onBlur: handleBlur,
    reset,
  };
}

export default useFieldValidation;
