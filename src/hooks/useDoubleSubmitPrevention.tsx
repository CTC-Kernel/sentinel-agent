import { useState, useCallback } from 'react';
import { ErrorLogger } from '../services/errorLogger';

/**
 * Hook pour prévenir les double-soumissions dans les formulaires
 */
export const useDoubleSubmitPrevention = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  const handleSubmit = useCallback(async (
    submitFunction: () => Promise<void>,
    options?: {
      timeout?: number;
      resetOnSuccess?: boolean;
      onSuccess?: () => void;
      onError?: (error: Error) => void;
    }
  ) => {
    // Prévenir le double-submit
    if (isSubmitting) {
      ErrorLogger.warn('Double submit prevented', 'useDoubleSubmitPrevention');
      return;
    }

    setIsSubmitting(true);
    setSubmitCount(prev => prev + 1);

    const {
      timeout = 30000, // 30 secondes par défaut
      resetOnSuccess = true,
      onSuccess,
      onError
    } = options || {};

    // Timeout de sécurité
    const timeoutId = setTimeout(() => {
      ErrorLogger.error('Submit timeout - resetting submitting state', 'useDoubleSubmitPrevention');
      setIsSubmitting(false);
    }, timeout);

    try {
      await submitFunction();

      if (resetOnSuccess) {
        setIsSubmitting(false);
      }
      onSuccess?.();
    } catch (error) {
      setIsSubmitting(false);
      onError?.(error as Error);
    } finally {
      clearTimeout(timeoutId);
    }
  }, [isSubmitting]);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setSubmitCount(0);
  }, []);

  return {
    isSubmitting,
    submitCount,
    handleSubmit,
    reset
  };
};

/**
 * Hook pour la protection des formulaires avec validation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useFormProtection = <T extends Record<string, any>>(initialData: T) => {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);

  const { handleSubmit } = useDoubleSubmitPrevention();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validateField = useCallback((_name: keyof T, value: any) => {
    // Validation basique - à personnaliser selon les besoins
    if (!value && value !== 0) {
      return 'Ce champ est requis';
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      return 'Ce champ ne peut pas être vide';
    }
    return null;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setFieldValue = useCallback((name: keyof T, value: any) => {
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
