import { useState, useCallback } from 'react';
import { useDoubleSubmitPrevention } from './useDoubleSubmitPrevention';

/**
 * Hook pour la protection des formulaires avec validation
 */
export const useFormProtection = <T extends Record<string, unknown>>(initialData: T) => {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);

  const { handleSubmit } = useDoubleSubmitPrevention();

  const validateField = useCallback((_name: keyof T, value: unknown) => {
    // Validation basique - à personnaliser selon les besoins
    if (!value && value !== 0) {
      return 'This field is required';
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      return 'This field cannot be empty';
    }
    return null;
  }, []);

  const setFieldValue = useCallback((name: keyof T, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Valider le champ s'il a déjà été touché
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [touched, validateField]);

  const setFieldTouched = useCallback((name: keyof T) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    // Valider au toucher
    const error = validateField(name, formData[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [formData, validateField]);

  const validateForm = useCallback(() => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    Object.keys(formData).forEach(key => {
      const error = validateField(key as keyof T, formData[key]);
      if (error) {
        newErrors[key as keyof T] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    setTouched(Object.keys(formData).reduce((acc, key) => ({
      ...acc,
      [key]: true
    }), {}));

    return isValid;
  }, [formData, validateField]);

  const protectedSubmit = useCallback(async (
    submitFunction: (data: T) => Promise<void>
  ) => {
    setSubmitAttempt(prev => prev + 1);

    if (!validateForm()) {
      return;
    }

    await handleSubmit(async () => {
      await submitFunction(formData);
    });
  }, [formData, validateForm, handleSubmit]);

  const reset = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setSubmitAttempt(0);
  }, [initialData]);

  return {
    formData,
    errors,
    touched,
    isSubmitting,
    submitAttempt,
    setFieldValue,
    setFieldTouched,
    validateForm,
    protectedSubmit,
    reset
  };
};
