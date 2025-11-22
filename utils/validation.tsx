
import { useState } from 'react';

// Validation Rules
export interface ValidationRule {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    min?: number;
    max?: number;
    email?: boolean;
    url?: boolean;
    custom?: (value: any) => boolean;
    message?: string;
}

export interface ValidationErrors {
    [key: string]: string | undefined;
}

// Validate a single field
export const validateField = (value: any, rules: ValidationRule): string | undefined => {
    if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
        return rules.message || 'Ce champ est requis';
    }

    if (!value) return undefined; // If not required and empty, it's valid

    const stringValue = String(value);

    if (rules.minLength && stringValue.length < rules.minLength) {
        return rules.message || `Minimum ${rules.minLength} caractères requis`;
    }

    if (rules.maxLength && stringValue.length > rules.maxLength) {
        return rules.message || `Maximum ${rules.maxLength} caractères autorisés`;
    }

    if (rules.pattern && !rules.pattern.test(stringValue)) {
        return rules.message || 'Format invalide';
    }

    if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)) {
        return rules.message || 'Email invalide';
    }

    if (rules.url && !/^https?:\/\/.+/.test(stringValue)) {
        return rules.message || 'URL invalide';
    }

    if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
            return rules.message || `Valeur minimum : ${rules.min}`;
        }

        if (rules.max !== undefined && value > rules.max) {
            return rules.message || `Valeur maximum : ${rules.max}`;
        }
    }

    if (rules.custom && !rules.custom(value)) {
        return rules.message || 'Valeur invalide';
    }

    return undefined;
};

// Validate entire form
export const validateForm = (
    data: Record<string, any>,
    rules: Record<string, ValidationRule>
): { isValid: boolean; errors: ValidationErrors } => {
    const errors: ValidationErrors = {};

    Object.keys(rules).forEach(field => {
        const error = validateField(data[field], rules[field]);
        if (error) {
            errors[field] = error;
        }
    });

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

// Hook for form validation
export const useFormValidation = (initialData: Record<string, any>, rules: Record<string, ValidationRule>) => {
    const [data, setData] = useState(initialData);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const validateSingleField = (field: string, value: any) => {
        if (rules[field]) {
            const error = validateField(value, rules[field]);
            setErrors(prev => ({ ...prev, [field]: error }));
            return error === undefined;
        }
        return true;
    };

    const handleChange = (field: string, value: any) => {
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

// Input component with validation
interface ValidatedInputProps {
    label: string;
    field: string;
    value: any;
    error?: string;
    touched?: boolean;
    onChange: (value: any) => void;
    onBlur: () => void;
    type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel';
    placeholder?: string;
    required?: boolean;
    className?: string;
    disabled?: boolean;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
    label,
    field,
    value,
    error,
    touched,
    onChange,
    onBlur,
    type = 'text',
    placeholder,
    required,
    className = '',
    disabled = false
}) => {
    const hasError = touched && error;

    return (
        <div className={className}>
            <label htmlFor={field} className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                id={field}
                type={type}
                value={value ?? ''}
                onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={disabled}
                className={`w-full px-4 py-3.5 rounded-2xl border ${hasError
                        ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10'
                        : 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20'
                    } text-slate-900 dark:text-white focus:ring-2 ${hasError ? 'focus:ring-red-500' : 'focus:ring-brand-500'
                    } outline-none font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            {hasError && (
                <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                </p>
            )}
        </div>
    );
};
