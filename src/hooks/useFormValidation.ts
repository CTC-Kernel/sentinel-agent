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
