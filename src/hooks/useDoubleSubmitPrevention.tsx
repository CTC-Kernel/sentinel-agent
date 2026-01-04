import React, { useState, useCallback } from 'react';

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
      console.warn('Double submit prevented');
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
      console.error('Submit timeout - resetting submitting state');
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
 * Composant Button avec protection double-submit intégrée
 */
interface ProtectedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isSubmitting?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export const ProtectedButton: React.FC<ProtectedButtonProps> = ({
  isSubmitting = false,
  loadingText = 'Chargement...',
  children,
  disabled,
  className,
  onClick,
  ...props
}) => {
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;
    
    // Ignorer les clics multiples rapides (< 500ms)
    if (timeSinceLastClick < 500 && clickCount > 0) {
      e.preventDefault();
      console.warn('Rapid multiple clicks prevented');
      return;
    }

    setClickCount(prev => prev + 1);
    setLastClickTime(now);

    // Réinitialiser le compteur après 2 secondes
    setTimeout(() => {
      setClickCount(0);
    }, 2000);

    onClick?.(e);
  }, [onClick, lastClickTime, clickCount]);

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={disabled || isSubmitting}
      className={className}
      aria-busy={isSubmitting}
      aria-disabled={disabled || isSubmitting}
    >
      {isSubmitting ? (
        <>
          <span className="animate-spin mr-2">⟳</span>
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
};

/**
 * Hook pour la protection des formulaires avec validation
 */
export const useFormProtection = <T extends Record<string, any>>(initialData: T) => {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);

  const { handleSubmit } = useDoubleSubmitPrevention();

  const validateField = useCallback((name: keyof T, value: any) => {
    // Validation basique - à personnaliser selon les besoins
    if (!value && value !== 0) {
      return 'Ce champ est requis';
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      return 'Ce champ ne peut pas être vide';
    }
    return null;
  }, []);

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
