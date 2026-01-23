/**
 * FormError Component
 * Standardized error message component for form validation errors.
 *
 * Usage:
 * ```tsx
 * <FormError message={errors.email?.message} />
 * ```
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface FormErrorProps {
    /** Error message to display */
    message?: string | null;
    /** Additional CSS classes */
    className?: string;
    /** ID for aria-describedby accessibility */
    id?: string;
}

/**
 * Standardized form error component.
 * Uses text-sm for readability and accessibility.
 */
export const FormError: React.FC<FormErrorProps> = ({
    message,
    className,
    id
}) => {
    if (!message) return null;

    return (
        <p
            id={id}
            role="alert"
            className={cn(
                "mt-1 text-sm text-error-text font-medium animate-fade-in",
                className
            )}
        >
            {message}
        </p>
    );
};

FormError.displayName = 'FormError';

export default FormError;
