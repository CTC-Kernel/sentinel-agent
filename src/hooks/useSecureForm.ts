import { useState, useCallback } from 'react';
import { InputSanitizer } from '../services/inputSanitizationService';
import { RateLimiter } from '../services/rateLimitService';
import { ErrorLogger } from '../services/errorLogger';
import { useStore } from '../store';

/**
 * Hook React pour créer des formulaires sécurisés
 * Combine la sanitization, le rate limiting et la validation
 *
 * @example
 * const { values, errors, handleChange, handleSubmit, isSubmitting } = useSecureForm({
 *   initialValues: { name: '', email: '' },
 *   onSubmit: async (sanitizedData) => {
 *     await createAsset(sanitizedData);
 *   },
 *   validate: (values) => {
 *     const errors: Record<string, string> = {};
 *     if (!values.name) errors.name = 'Nom requis';
 *     return errors;
 *   }
 * });
 */

interface UseSecureFormOptions<T extends Record<string, unknown>> {
  initialValues: T;
  onSubmit: (values: T) => Promise<void> | void;
  validate?: (values: T) => Record<string, string>;
  rateLimitOperation?: string; // auth, api, search, export, etc.
  sanitizationOptions?: {
    maxLength?: number;
    allowHTML?: boolean;
  };
  onError?: (error: Error) => void;
  t?: (key: string, options?: { defaultValue?: string; seconds?: number; size?: number } & Record<string, string | number>) => string;
}

interface UseSecureFormReturn<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  handleChange: (field: keyof T) => (value: unknown) => void;
  handleBlur: (field: keyof T) => () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  resetForm: () => void;
  setFieldValue: (field: keyof T, value: unknown) => void;
  setFieldError: (field: keyof T, error: string) => void;
}

export function useSecureForm<T extends Record<string, unknown>>({
  initialValues,
  onSubmit,
  validate,
  rateLimitOperation = 'api',
  sanitizationOptions = {},
  onError,
  t: tProp
}: UseSecureFormOptions<T>): UseSecureFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast, t: tStore } = useStore();
  const user = useStore(state => state.user);
  const t = tProp || tStore;

  /**
   * Sanitize une valeur selon son type
   */
  const sanitizeValue = useCallback((value: unknown): unknown => {
    if (typeof value === 'string') {
      return InputSanitizer.sanitizeString(value, sanitizationOptions);
    } else if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item));
    } else if (value !== null && typeof value === 'object') {
      return InputSanitizer.sanitizeObject(value as Record<string, unknown>, sanitizationOptions);
    }
    return value;
  }, [sanitizationOptions]);

  /**
   * Met à jour la valeur d'un champ avec sanitization
   */
  const handleChange = useCallback((field: keyof T) => {
    return (value: unknown) => {
      const sanitizedValue = sanitizeValue(value);

      setValues(prev => ({
        ...prev,
        [field]: sanitizedValue
      }));

      // Nettoyer l'erreur si le champ était touché
      if (touched[field as string]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field as string];
          return newErrors;
        });
      }
    };
  }, [sanitizeValue, touched]);

  /**
   * Marque un champ comme touché
   */
  const handleBlur = useCallback((field: keyof T) => {
    return () => {
      setTouched(prev => ({
        ...prev,
        [field]: true
      }));

      // Valider le champ au blur si validation fournie
      if (validate) {
        const validationErrors = validate(values);
        if (validationErrors[field as string]) {
          setErrors(prev => ({
            ...prev,
            [field]: validationErrors[field as string]
          }));
        }
      }
    };
  }, [validate, values]);

  /**
   * Définit la valeur d'un champ directement
   */
  const setFieldValue = useCallback((field: keyof T, value: unknown) => {
    const sanitizedValue = sanitizeValue(value);
    setValues(prev => ({
      ...prev,
      [field]: sanitizedValue
    }));
  }, [sanitizeValue]);

  /**
   * Définit une erreur pour un champ
   */
  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  }, []);

  /**
   * Soumet le formulaire avec toutes les vérifications de sécurité
   */
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Rate limiting
    if (!RateLimiter.checkLimit(rateLimitOperation, user?.uid)) {
      const waitTime = RateLimiter.getWaitTime(rateLimitOperation, user?.uid);
      const waitSeconds = Math.ceil(waitTime / 1000);
      const message = t('common.toast.rateLimited', { defaultValue: "Trop de requêtes. Veuillez patienter {{seconds}} seconde(s).", seconds: waitSeconds });

      addToast(message, 'error');
      ErrorLogger.warn('Rate limit exceeded on form submit', 'useSecureForm', {
        metadata: {
          operation: rateLimitOperation,
          userId: user?.uid,
          waitTime
        }
      });
      return;
    }

    // Validation
    if (validate) {
      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        addToast(t('common.toast.fixFormErrors', { defaultValue: 'Veuillez corriger les erreurs du formulaire' }), 'error');
        return;
      }
    }

    // Marquer tous les champs comme touchés
    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setTouched(allTouched);

    setIsSubmitting(true);

    try {
      // Double sanitization avant soumission (sécurité en profondeur)
      const sanitizedValues = InputSanitizer.sanitizeObject(values, sanitizationOptions);

      // Détection des tentatives d'attaque
      const valuesString = JSON.stringify(sanitizedValues);
      if (InputSanitizer.detectSQLInjection(valuesString)) {
        ErrorLogger.warn('SQL injection attempt detected in form', 'useSecureForm', {
          metadata: {
            userId: user?.uid,
            operation: rateLimitOperation
          }
        });
      }

      if (InputSanitizer.detectPathTraversal(valuesString)) {
        ErrorLogger.warn('Path traversal attempt detected in form', 'useSecureForm', {
          metadata: {
            userId: user?.uid,
            operation: rateLimitOperation
          }
        });
      }

      // Soumettre
      await onSubmit(sanitizedValues as T);

      // Succès
      ErrorLogger.info('Form submitted successfully', 'useSecureForm', {
        metadata: {
          operation: rateLimitOperation,
          userId: user?.uid
        }
      });
    } catch (error) {
      ErrorLogger.error(error, 'useSecureForm.handleSubmit', {
        metadata: {
          operation: rateLimitOperation,
          userId: user?.uid
        }
      });

      if (onError) {
        onError(error as Error);
      } else {
        addToast(t('common.toast.submitError', { defaultValue: 'Une erreur est survenue lors de la soumission' }), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, onSubmit, rateLimitOperation, user, addToast, onError, sanitizationOptions, t]);

  /**
   * Réinitialise le formulaire
   */
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  /**
   * Vérifie si le formulaire est valide
   */
  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldError
  };
}

/**
 * Hook simplifié pour les formulaires avec validation Zod
 * @example
 * const form = useSecureFormWithZod({
 *   schema: assetSchema,
 *   onSubmit: async (data) => {
 *     await createAsset(data);
 *   }
 * });
 */

interface UseSecureFormWithZodOptions<T extends Record<string, unknown>> {
  schema: {
    parse: (data: unknown) => T;
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { errors: Array<{ path: string[]; message: string }> } };
  };
  initialValues?: Partial<T>;
  onSubmit: (values: T) => Promise<void> | void;
  rateLimitOperation?: string;
  onError?: (error: Error) => void;
  t?: (key: string, options?: { defaultValue?: string; seconds?: number; size?: number } & Record<string, string | number>) => string;
}

export function useSecureFormWithZod<T extends Record<string, unknown>>({
  schema,
  initialValues = {},
  onSubmit,
  rateLimitOperation = 'api',
  onError,
  t: tProp
}: UseSecureFormWithZodOptions<T>) {
  const validateWithZod = useCallback((values: Record<string, unknown>) => {
    const result = schema.safeParse(values);

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error?.errors.forEach(err => {
        const field = err.path.join('.');
        errors[field] = err.message;
      });
      return errors;
    }

    return {};
  }, [schema]);

  return useSecureForm({
    initialValues: initialValues as T,
    onSubmit,
    validate: validateWithZod,
    rateLimitOperation,
    onError,
    t: tProp
  });
}

/**
 * Hook pour gérer les uploads de fichiers sécurisés
 */

interface UseSecureFileUploadOptions {
  maxSize?: number; // en bytes
  allowedTypes?: string[]; // ['image/png', 'image/jpeg', 'application/pdf']
  onUpload: (file: File) => Promise<void>;
  rateLimitOperation?: string;
  t?: (key: string, options?: { defaultValue?: string; seconds?: number; size?: number } & Record<string, string | number>) => string;
}

export function useSecureFileUpload({
  maxSize = 10 * 1024 * 1024, // 10MB par défaut
  allowedTypes = [],
  onUpload,
  rateLimitOperation = 'file_upload',
  t: tProp
}: UseSecureFileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast, t: tStore } = useStore();
  const user = useStore(state => state.user);
  const t = tProp || tStore;

  const handleUpload = useCallback(async (file: File) => {
    setError(null);

    // Rate limiting
    if (!RateLimiter.checkLimit(rateLimitOperation, user?.uid)) {
      const waitTime = RateLimiter.getWaitTime(rateLimitOperation, user?.uid);
      const message = t('common.toast.uploadRateLimited', { defaultValue: "Trop d'uploads. Veuillez patienter {{seconds}}s.", seconds: Math.ceil(waitTime / 1000) });
      setError(message);
      addToast(message, 'error');
      return;
    }

    // Validation de la taille
    if (file.size > maxSize) {
      const message = t('common.toast.fileTooLarge', { defaultValue: "Fichier trop volumineux. Maximum: {{size}}MB", size: Math.round(maxSize / 1024 / 1024) });
      setError(message);
      addToast(message, 'error');
      return;
    }

    // Validation du type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      const message = t('common.toast.fileTypeNotAllowed', { defaultValue: "Type de fichier non autorisé. Types acceptés: {{types}}", types: allowedTypes.join(', ') });
      setError(message);
      addToast(message, 'error');
      return;
    }

    // Sanitization du nom de fichier
    const sanitizedName = InputSanitizer.sanitizeFilename(file.name);
    if (sanitizedName !== file.name) {
      ErrorLogger.warn('Filename sanitized', 'useSecureFileUpload', {
        metadata: {
          original: file.name,
          sanitized: sanitizedName
        }
      });
    }

    setIsUploading(true);

    try {
      // Créer un nouveau File avec le nom sanitizé
      const sanitizedFile = new File([file], sanitizedName, { type: file.type });

      await onUpload(sanitizedFile);

      addToast(t('common.toast.fileUploaded', { defaultValue: 'Fichier uploadé avec succès' }), 'success');
    } catch (err) {
      const message = t('common.toast.uploadError', { defaultValue: 'Erreur lors de l\'upload du fichier' });
      setError(message);
      addToast(message, 'error');
      ErrorLogger.error(err, 'useSecureFileUpload.handleUpload');
    } finally {
      setIsUploading(false);
    }
  }, [maxSize, allowedTypes, onUpload, rateLimitOperation, user, addToast, t]);

  return {
    handleUpload,
    isUploading,
    error
  };
}
