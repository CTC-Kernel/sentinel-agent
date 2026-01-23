
export interface ValidationRule {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    min?: number;
    max?: number;
    email?: boolean;
    url?: boolean;
    custom?: (value: unknown) => boolean;
    message?: string;
}

export interface ValidationErrors {
    [key: string]: string | undefined;
}

// Validate a single field
export const validateField = (value: unknown, rules: ValidationRule): string | undefined => {
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
    data: Record<string, unknown>,
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

import { SupportedLocale } from '../config/localeConfig';

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
    de: {
        required: 'Dieses Feld ist erforderlich',
        invalid: 'Ungültiger Wert',
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
