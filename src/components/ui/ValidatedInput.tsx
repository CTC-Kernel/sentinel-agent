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

/**
 * Props for the ValidatedInput component
 */

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
 return 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive';
 }
 if (state === 'valid') {
 return 'border-success-border focus-visible:border-success-border focus-visible:ring-success-border';
 }
 return 'border-input focus-visible:border-primary focus-visible:ring-primary';
}

/**
 * ValidatedInput component with integrated validation feedback.
 *
 * @example
 * ```tsx
 * <ValidatedInput
 * name="email"
 * label="Email"
 * schema={z.string().email()}
 * trigger="blur"
 * required
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
 value: controlledValue,
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
 const generatedId = useId();
 const inputId = id || generatedId;
 const errorId = `${inputId}-error`;

 // Determine if component is controlled
 const isControlled = controlledValue !== undefined;

 // Create a default schema if none provided
 const effectiveSchema = useMemo(() => schema || z.string(), [schema]);

 // Use the field validation hook
 const {
 state,
 value: internalValue,
 error: validationError,
 setValue,
 onBlur,
 } = useFieldValidation({
 schema: effectiveSchema,
 trigger,
 delayMs,
 initialValue: (defaultValue as string) || '',
 });

 // Use controlled value if provided, otherwise use internal value
 const displayValue = isControlled ? controlledValue : internalValue;

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

 // Sync controlled value with internal state for validation
 useEffect(() => {
 if (isControlled && controlledValue !== internalValue) {
 setValue(controlledValue);
 }
 }, [isControlled, controlledValue, internalValue, setValue]);

 // Handle input change
 const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const newValue = e.target.value;
 if (!isControlled) {
 setValue(newValue);
 }
 if (onChange) {
 onChange(newValue);
 }
 };

 // Build input classes
 const inputClasses = [
 'block w-full rounded-xl shadow-sm',
 'px-3 py-2 text-sm',
 'bg-background',
 'text-foreground',
 'placeholder-muted-foreground',
 getBorderClass(effectiveState, hasError),
 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
 'disabled:bg-secondary disabled:text-muted-foreground disabled:cursor-not-allowed',
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
 className="block text-sm font-medium text-foreground mb-1"
 >
 {label}
 {required && <span className="text-destructive ml-1">*</span>}
 </label>
 )}

 {/* Input wrapper */}
 <div className="relative">
 <input
 ref={ref}
 id={inputId}
 type="text"
 value={displayValue || ''}
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
  className="w-5 h-5 text-success-text"
  aria-hidden="true"
 />
 )}
 {effectiveState === 'invalid' && (
 <AlertCircle
  className="w-5 h-5 text-destructive"
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
 className={`mt-1 text-sm ${displayError
 ? 'text-destructive'
 : 'text-muted-foreground'
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
