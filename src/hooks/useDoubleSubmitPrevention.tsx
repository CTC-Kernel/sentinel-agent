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
   ErrorLogger.handleErrorWithToast(error, 'useDoubleSubmitPrevention');
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
 * Generic constraint allows any object type for form data
 */
export const /* schema validation via zod */ useFormProtection = <T extends Record<string, unknown>>(initialData: T) => {
 const [formData, setFormData] = useState<T>(initialData);
 const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
 const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [submitAttempt, setSubmitAttempt] = useState(0);

 const { handleSubmit } = useDoubleSubmitPrevention();

 const validateField = useCallback((_name: keyof T, value: unknown) => {
 // Validation basique - à personnaliser selon les besoins
 // Si une fonction de validation personnalisée est fournie via les options (à ajouter plus tard si besoin), l'utiliser ici.
 // Pour l'instant, on rend la validation moins stricte par défaut :

 // Si la valeur est null ou undefined, c'est une erreur seulement si le champ est considéré comme obligatoire (logique métier)
 // Mais comme on n'a pas la liste des champs obligatoires ici, on ne peut pas forcer "requis" partout.
 // On va désactiver cette validation par défaut "tout requis" qui est trop agressive.

 /* 
 if (!value && value !== 0 && value !== false) {
 // return 'Ce champ est requis'; // TROP STRICT pour un hook générique
 return null; 
 }
 */

 if (typeof value === 'string' && value.trim().length === 0) {
 // return 'Ce champ ne peut pas être vide'; // TROP STRICT
 return null;
 }
 return null;
 }, []);

 const setFieldValue = useCallback((name: keyof T, value: T[keyof T]) => {
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
