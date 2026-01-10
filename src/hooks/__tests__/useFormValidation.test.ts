/**
 * Unit tests for useFormValidation hook (Story 1.5)
 *
 * Tests for form-level validation tracking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '../useFormValidation';

describe('useFormValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('initializes with isFormValid as true when no fields registered', () => {
      const { result } = renderHook(() => useFormValidation());

      expect(result.current.isFormValid).toBe(true);
    });

    it('initializes with empty fields object', () => {
      const { result } = renderHook(() => useFormValidation());

      expect(result.current.getFieldState('nonexistent')).toBe('idle');
    });
  });

  describe('field registration', () => {
    it('registers a field validator', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
      });

      expect(result.current.getFieldState('email')).toBe('idle');
    });

    it('unregisters a field validator', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
      });

      act(() => {
        result.current.unregisterField('email');
      });

      expect(result.current.getFieldState('email')).toBe('idle');
    });
  });

  describe('field state updates', () => {
    it('updates field state when setFieldState is called', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
        result.current.setFieldState('email', 'valid');
      });

      expect(result.current.getFieldState('email')).toBe('valid');
    });

    it('updates isFormValid to false when any field is invalid', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
        result.current.registerField('password', async () => false);
        result.current.setFieldState('email', 'valid');
        result.current.setFieldState('password', 'invalid');
      });

      expect(result.current.isFormValid).toBe(false);
    });

    it('updates isFormValid to true when all fields are valid', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
        result.current.registerField('password', async () => true);
        result.current.setFieldState('email', 'valid');
        result.current.setFieldState('password', 'valid');
      });

      expect(result.current.isFormValid).toBe(true);
    });

    it('considers idle fields as valid for isFormValid', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
        result.current.registerField('password', async () => true);
        result.current.setFieldState('email', 'valid');
        // password stays idle
      });

      expect(result.current.isFormValid).toBe(true);
    });
  });

  describe('validateAll', () => {
    it('runs all registered validators', async () => {
      const validator1 = vi.fn().mockResolvedValue(true);
      const validator2 = vi.fn().mockResolvedValue(true);

      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('field1', validator1);
        result.current.registerField('field2', validator2);
      });

      await act(async () => {
        await result.current.validateAll();
      });

      expect(validator1).toHaveBeenCalled();
      expect(validator2).toHaveBeenCalled();
    });

    it('returns true when all validators pass', async () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('field1', async () => true);
        result.current.registerField('field2', async () => true);
      });

      let isValid: boolean = false;
      await act(async () => {
        isValid = await result.current.validateAll();
      });

      expect(isValid).toBe(true);
    });

    it('returns false when any validator fails', async () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('field1', async () => true);
        result.current.registerField('field2', async () => false);
      });

      let isValid: boolean = true;
      await act(async () => {
        isValid = await result.current.validateAll();
      });

      expect(isValid).toBe(false);
    });

    it('returns true when no fields registered', async () => {
      const { result } = renderHook(() => useFormValidation());

      let isValid: boolean = false;
      await act(async () => {
        isValid = await result.current.validateAll();
      });

      expect(isValid).toBe(true);
    });
  });

  describe('touched fields tracking', () => {
    it('tracks touched fields', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
        result.current.setFieldTouched('email', true);
      });

      expect(result.current.isFieldTouched('email')).toBe(true);
    });

    it('returns false for untouched fields', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
      });

      expect(result.current.isFieldTouched('email')).toBe(false);
    });

    it('can untouch a field', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
        result.current.setFieldTouched('email', true);
      });

      act(() => {
        result.current.setFieldTouched('email', false);
      });

      expect(result.current.isFieldTouched('email')).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all field states to idle', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
        result.current.registerField('password', async () => true);
        result.current.setFieldState('email', 'valid');
        result.current.setFieldState('password', 'invalid');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.getFieldState('email')).toBe('idle');
      expect(result.current.getFieldState('password')).toBe('idle');
    });

    it('resets all touched fields', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => true);
        result.current.setFieldTouched('email', true);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.isFieldTouched('email')).toBe(false);
    });

    it('resets isFormValid to true', () => {
      const { result } = renderHook(() => useFormValidation());

      act(() => {
        result.current.registerField('email', async () => false);
        result.current.setFieldState('email', 'invalid');
      });

      expect(result.current.isFormValid).toBe(false);

      act(() => {
        result.current.reset();
      });

      expect(result.current.isFormValid).toBe(true);
    });
  });
});
