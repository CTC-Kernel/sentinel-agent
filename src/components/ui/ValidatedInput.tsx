/**
 * ValidatedInput Component (Story 1.5)
 *
 * Input component with integrated field-level validation.
 * Displays visual feedback for validation state.
 *
 * @module ValidatedInput
 */

import { forwardRef, useId, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { Check, AlertCircle } from './Icons';
import {
  useFieldValidation,
  type FieldValidationState,
  type ValidationTrigger,
} from '../../hooks/useFieldValidation';
import type { SupportedLocale } from '../../config/localeConfig';

/**
 * Localized labels for validation states
 */
const validationLabels = {
  fr: {
    required: 'Ce champ est requis',
    invalid: 'Valeur invalide',
  },
  en: {
    required: 'This field is required',
    invalid: 'Invalid value',
  },
} as const;

/**
 * Get validation label for a locale
 */
export function getValidationLabel(
  locale: SupportedLocale,
  key: keyof typeof validationLabels.fr
): string {
  return validationLabels[locale][key];
}

/**
 * Props for the ValidatedInput component
 */
export interface ValidatedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  /** Zod schema for validation */
  schema?: z.ZodType<string>;
  /** Validation trigger mode */
  trigger?: ValidationTrigger;
  /** Delay in ms for delay trigger (default: 500) */
  delayMs?: number;
  /** Label for the input */
  label?: string;
  /** Helper text shown below the input */
  helperText?: string;
  /** External error message (for server-side errors) */
  externalError?: string;
  /** Controlled value (for controlled mode) */
  value?: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Callback when validation state changes */
  onValidationChange?: (state: FieldValidationState, error: string | null) => void;
  /** Custom class for the container */
  containerClassName?: string;
  /** Hide the validation icon */
  hideIcon?: boolean;
}

/**
 * Get border color class based on validation state
 */
function getBorderClass(state: FieldValidationState, hasError: boolean): string {
  if (hasError || state === 'invalid') {
    return 'border-rose-500 focus:border-rose-500 focus:ring-rose-500';
  }
  if (state === 'valid') {
    return 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500';
  }
  return 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500';
}

/**
 * ValidatedInput component with integrated validation feedback.
 *
 * @example
 * ```tsx
 * <ValidatedInput
 *   name="email"
 *   label="Email"
 *   schema={z.string().email()}
 *   trigger="blur"
 *   required
 * />
 * ```
 */
export const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  (
    {
      schema,
      trigger = 'blur',
      delayMs = 500,
      label,
      helperText,
      externalError,
      onChange,
      onValidationChange,
      containerClassName = '',
      hideIcon = false,
      required,
      disabled,
      className = '',
      id,
      defaultValue,
      ...inputProps
    },
    ref
  ) => {
    useLocale(); // Hook called for potential future use
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;

    // Create a default schema if none provided
    const effectiveSchema = schema || z.string();

    // Use the field validation hook
    const {
      state,
      value,
      error: validationError,
      setValue,
      onBlur,
    } = useFieldValidation({
      schema: effectiveSchema,
      trigger,
      delayMs,
      initialValue: (defaultValue as string) || '',
    });

    // Combine validation error with external error
    const displayError = externalError || validationError;
    const hasError = !!displayError;
    const effectiveState = externalError ? 'invalid' : state;

    // Notify parent of validation changes
    useEffect(() => {
      if (onValidationChange) {
        onValidationChange(effectiveState, displayError);
      }
    }, [effectiveState, displayError, onValidationChange]);

    // Handle input change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      if (onChange) {
        onChange(newValue);
      }
    };

    // Build input classes
    const inputClasses = [
      'block w-full rounded-md shadow-sm',
      'px-3 py-2 text-sm',
      'bg-white dark:bg-slate-800',
      'text-slate-900 dark:text-slate-100',
      'placeholder-slate-400 dark:placeholder-slate-500',
      getBorderClass(effectiveState, hasError),
      'focus:outline-none focus:ring-2 focus:ring-offset-0',
      'disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed',
      'transition-colors duration-150',
      hideIcon ? '' : 'pr-10', // Space for icon
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={`relative ${containerClassName}`}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="text"
            value={value || ''}
            onChange={handleChange}
            onBlur={onBlur}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={inputClasses}
            {...inputProps}
          />

          {/* Validation icon */}
          {!hideIcon && effectiveState !== 'idle' && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              {effectiveState === 'valid' && (
                <Check
                  className="w-5 h-5 text-emerald-500"
                  aria-hidden="true"
                />
              )}
              {effectiveState === 'invalid' && (
                <AlertCircle
                  className="w-5 h-5 text-rose-500"
                  aria-hidden="true"
                />
              )}
            </div>
          )}
        </div>

        {/* Helper text or error message */}
        {(helperText || displayError) && (
          <p
            id={errorId}
            className={`mt-1 text-sm ${
              displayError
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
            role={displayError ? 'alert' : undefined}
          >
            {displayError || helperText}
          </p>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';

export default ValidatedInput;
