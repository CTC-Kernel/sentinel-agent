/**
 * useFormValidation Hooks (Story 1.5)
 *
 * Provides form-level validation functionality:
 * - useFormValidation: Original hook for form data + validation rules
 * - useFormValidationState: New hook for tracking field validation states
 *
 * @module useFormValidation
 */

import { useState, useCallback, useRef } from 'react';
import { ValidationRule, ValidationErrors, validateField, validateForm } from '../utils/validationUtils';
import type { FieldValidationState } from './useFieldValidation';

/**
 * Original form validation hook - manages form data AND validation rules
 */
export const useFormValidation = (initialData: Record<string, unknown>, rules: Record<string, ValidationRule>) => {
  const [data, setData] = useState(initialData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateSingleField = (field: string, value: unknown) => {
    if (rules[field]) {
      const error = validateField(value, rules[field]);
      setErrors(prev => ({ ...prev, [field]: error }));
      return error === undefined;
    }
    return true;
  };

  const handleChange = (field: string, value: unknown) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      validateSingleField(field, value);
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateSingleField(field, data[field]);
  };

  const validateAll = (): boolean => {
    const result = validateForm(data, rules);
    setErrors(result.errors);
    setTouched(Object.keys(rules).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    return result.isValid;
  };

  const reset = () => {
    setData(initialData);
    setErrors({});
    setTouched({});
  };

  return {
    data,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    reset,
    setData
  };
};

// ============================================================================
// NEW: useFormValidationState Hook (Story 1.5)
// ============================================================================

/**
 * Validator function type for field validation
 */
export type FieldValidator = () => Promise<boolean>;

/**
 * Options for configuring form validation state behavior
 */
export interface UseFormValidationStateOptions {
  /** Validation mode (reserved for future use) */
  mode?: 'onChange' | 'onBlur' | 'onSubmit';
}

/**
 * Return type for the useFormValidationState hook
 */
export interface UseFormValidationStateReturn {
  /** Whether all registered fields are valid */
  isFormValid: boolean;
  /** Register a field for validation tracking */
  registerField: (name: string, validate: FieldValidator) => void;
  /** Unregister a field */
  unregisterField: (name: string) => void;
  /** Set the validation state for a field */
  setFieldState: (name: string, state: FieldValidationState) => void;
  /** Get validation state for a specific field */
  getFieldState: (name: string) => FieldValidationState;
  /** Validate all registered fields */
  validateAll: () => Promise<boolean>;
  /** Check if a field has been touched */
  isFieldTouched: (name: string) => boolean;
  /** Set a field's touched state */
  setFieldTouched: (name: string, touched: boolean) => void;
  /** Reset all field states */
  reset: () => void;
}

interface FieldEntry {
  validate: FieldValidator;
  state: FieldValidationState;
  touched: boolean;
}

/**
 * Hook for tracking field validation states from ValidatedInput components.
 *
 * Unlike useFormValidation (which manages form data), this hook only tracks
 * validation states. Use this with ValidatedInput components.
 *
 * @param _options - Configuration options (reserved for future use)
 * @returns Form validation state and control functions
 *
 * @example
 * ```tsx
 * const { isFormValid, setFieldState, validateAll, reset } = useFormValidationState();
 *
 * return (
 *   <form onSubmit={async (e) => {
 *     e.preventDefault();
 *     if (await validateAll()) {
 *       // Submit form
 *     }
 *   }}>
 *     <ValidatedInput
 *       name="email"
 *       schema={z.string().email()}
 *       onValidationChange={(state) => setFieldState('email', state)}
 *     />
 *
 *     <button type="submit" disabled={!isFormValid}>
 *       Submit
 *     </button>
 *   </form>
 * );
 * ```
 */
export function useFormValidationState(
  _options: UseFormValidationStateOptions = {}
): UseFormValidationStateReturn {
  // Use ref to store field entries to avoid re-renders on registration
  const fieldsRef = useRef<Map<string, FieldEntry>>(new Map());

  // Track form validity as state (computed outside of render)
  const [isFormValid, setIsFormValid] = useState(true);

  /**
   * Recalculate form validity from current field states
   * Only called from event handlers, not during render
   */
  const recalculateValidity = useCallback(() => {
    const fields = fieldsRef.current;
    if (fields.size === 0) {
      setIsFormValid(true);
      return;
    }

    for (const entry of fields.values()) {
      if (entry.state === 'invalid') {
        setIsFormValid(false);
        return;
      }
    }
    setIsFormValid(true);
  }, []);

  /**
   * Register a field for validation tracking
   */
  const registerField = useCallback((name: string, validate: FieldValidator) => {
    fieldsRef.current.set(name, {
      validate,
      state: 'idle',
      touched: false,
    });
    recalculateValidity();
  }, [recalculateValidity]);

  /**
   * Unregister a field from validation tracking
   */
  const unregisterField = useCallback((name: string) => {
    fieldsRef.current.delete(name);
    recalculateValidity();
  }, [recalculateValidity]);

  /**
   * Set the validation state for a specific field
   */
  const setFieldState = useCallback(
    (name: string, state: FieldValidationState) => {
      const entry = fieldsRef.current.get(name);
      if (entry) {
        entry.state = state;
        recalculateValidity();
      }
    },
    [recalculateValidity]
  );

  /**
   * Get the validation state for a specific field
   */
  const getFieldState = useCallback((name: string): FieldValidationState => {
    const entry = fieldsRef.current.get(name);
    return entry?.state ?? 'idle';
  }, []);

  /**
   * Validate all registered fields
   */
  const validateAllFields = useCallback(async (): Promise<boolean> => {
    const fields = fieldsRef.current;
    if (fields.size === 0) return true;

    const results = await Promise.all(
      Array.from(fields.entries()).map(async ([, entry]) => {
        const isValid = await entry.validate();
        entry.state = isValid ? 'valid' : 'invalid';
        entry.touched = true;
        return isValid;
      })
    );

    recalculateValidity();
    return results.every((valid) => valid);
  }, [recalculateValidity]);

  /**
   * Check if a field has been touched
   */
  const isFieldTouched = useCallback((name: string): boolean => {
    const entry = fieldsRef.current.get(name);
    return entry?.touched ?? false;
  }, []);

  /**
   * Set a field's touched state
   */
  const setFieldTouched = useCallback((name: string, touched: boolean) => {
    const entry = fieldsRef.current.get(name);
    if (entry) {
      entry.touched = touched;
    }
  }, []);

  /**
   * Reset all field states to idle and untouched
   */
  const resetState = useCallback(() => {
    for (const entry of fieldsRef.current.values()) {
      entry.state = 'idle';
      entry.touched = false;
    }
    setIsFormValid(true);
  }, []);

  return {
    isFormValid,
    registerField,
    unregisterField,
    setFieldState,
    getFieldState,
    validateAll: validateAllFields,
    isFieldTouched,
    setFieldTouched,
    reset: resetState,
  };
}

export default useFormValidation;
