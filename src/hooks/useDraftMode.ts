/**
 * useDraftMode - Draft mode form validation hook (Story 1.3)
 *
 * Provides draft/publish mode switching for forms with relaxed validation.
 *
 * @module useDraftMode
 */

import { useState, useCallback, useMemo } from 'react';
import { useForm, UseFormProps, UseFormReturn, FieldValues, FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DRAFT_STATUS } from '../utils/draftSchema';
import type { SupportedLocale } from '../config/localeConfig';

/**
 * Options for useDraftMode hook
 */
export interface UseDraftModeOptions<
 TFullSchema extends z.ZodSchema,
 TDraftSchema extends z.ZodSchema
> extends Omit<UseFormProps<z.infer<TFullSchema> & FieldValues>, 'resolver'> {
 /** The complete validation schema for publishing */
 fullSchema: TFullSchema;
 /** The relaxed schema for draft saving (only required fields validated) */
 draftSchema: TDraftSchema;
 /** Initial draft state */
 initialDraftMode?: boolean;
 /** Entity type for determining status value */
 entityType?: keyof typeof DRAFT_STATUS;
}

/**
 * Return type for useDraftMode hook
 */
export interface UseDraftModeReturn<TData extends FieldValues> {
 /** react-hook-form methods */
 form: UseFormReturn<TData>;
 /** Whether the form is currently in draft mode */
 isDraft: boolean;
 /** Toggle draft mode on/off */
 setDraftMode: (draft: boolean) => void;
 /** Save the form as a draft (relaxed validation) */
 saveAsDraft: (onSave: (data: TData) => Promise<void>) => Promise<void>;
 /** Publish the form (full validation) */
 publish: (onPublish: (data: TData) => Promise<void>) => Promise<void>;
 /** Check if current form data can be saved as draft */
 canSaveDraft: () => { canSave: boolean; errors: Record<string, string> };
 /** The appropriate status value for the current entity type */
 draftStatusValue: string;
 /** Check if form data passes full validation */
 isValidForPublish: () => boolean;
}

/**
 * Hook that provides draft mode functionality for forms.
 *
 * In draft mode, only specified required fields are validated, allowing
 * users to save partial form progress. When publishing, full validation applies.
 *
 * @param options - Configuration including full and draft schemas
 * @returns Form methods and draft mode controls
 *
 * @example
 * ```tsx
 * const riskDraftSchema = createDraftSchema(riskSchema, {
 * requiredFields: ['threat'],
 * locale: 'fr',
 * });
 *
 * function RiskForm() {
 * const {
 * form,
 * isDraft,
 * setDraftMode,
 * saveAsDraft,
 * publish,
 * } = useDraftMode({
 * fullSchema: riskSchema,
 * draftSchema: riskDraftSchema,
 * entityType: 'document',
 * });
 *
 * return (
 * <form>
 * <Button onClick={() => saveAsDraft(handleSave)}>
 * Enregistrer en brouillon
 * </Button>
 * <Button onClick={() => publish(handleSave)}>
 * Publier
 * </Button>
 * </form>
 * );
 * }
 * ```
 */
export function useDraftMode<
 TFullSchema extends z.ZodSchema,
 TDraftSchema extends z.ZodSchema
>(
 options: UseDraftModeOptions<TFullSchema, TDraftSchema>
): UseDraftModeReturn<z.infer<TFullSchema> & FieldValues> {
 const {
 fullSchema,
 draftSchema,
 initialDraftMode = true,
 entityType = 'document',
 ...formOptions
 } = options;

 const [isDraft, setIsDraft] = useState(initialDraftMode);

 // Create resolver based on current mode
 // Note: Type assertion is necessary due to known incompatibility between
 // @hookform/resolvers/zod generic types and Zod's ZodSchema generic.
 // The zodResolver expects ZodType<TFieldValues, ZodTypeDef, TFieldValues>
 // but our generic TFullSchema/TDraftSchema extends ZodSchema which has different variance.
 // Note: Type assertions needed for Zod 4 compatibility with @hookform/resolvers
 const resolver = useMemo(() => {
 // Note: errorMap removed due to Zod 4 incompatibility with @hookform/resolvers
 // Error messages are handled by Zod's built-in localized messages
 const schema = isDraft ? draftSchema : fullSchema;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 return zodResolver(schema as any) as any;
 }, [isDraft, draftSchema, fullSchema]);

 // Initialize form with current resolver
 const form = useForm<z.infer<TFullSchema> & FieldValues>({
 ...formOptions,
 resolver,
 });

 // Get the appropriate draft status value
 const draftStatusValue = DRAFT_STATUS[entityType] || DRAFT_STATUS.document;

 // Toggle draft mode
 const setDraftMode = useCallback((draft: boolean) => {
 setIsDraft(draft);
 }, []);

 // Check if current data can be saved as draft
 const canSaveDraft = useCallback(() => {
 const data = form.getValues() as Record<string, unknown>;
 // Get required fields from draft schema shape
 const draftResult = draftSchema.safeParse(data);
 if (draftResult.success) {
 return { canSave: true, errors: {} };
 }

 const errors: Record<string, string> = {};
 for (const issue of draftResult.error.issues) {
 const path = issue.path.join('.') || '_root';
 errors[path] = issue.message;
 }
 return { canSave: false, errors };
 }, [form, draftSchema]);

 // Check if data passes full validation
 const isValidForPublish = useCallback(() => {
 const data = form.getValues();
 const result = fullSchema.safeParse(data);
 return result.success;
 }, [form, fullSchema]);

 // Save as draft with relaxed validation
 const saveAsDraft = useCallback(
 async (onSave: (data: z.infer<TFullSchema> & FieldValues) => Promise<void>) => {
 // Temporarily switch to draft mode for validation
 const wasInDraft = isDraft;
 if (!wasInDraft) {
 setIsDraft(true);
 }

 // Validate against draft schema
 const data = form.getValues();
 const result = draftSchema.safeParse(data);

 if (!result.success) {
 // Set errors on the form
 // Note: Zod issue paths are dynamic, so we cast to FieldPath which is the
 // proper react-hook-form type for dot-notation paths like "address.street"
 for (const issue of result.error.issues) {
 const path = issue.path.join('.') as FieldPath<z.infer<TFullSchema> & FieldValues>;
 form.setError(path, {
 type: 'manual',
 message: issue.message,
 });
 }
 return;
 }

 // Save with draft status
 await onSave({
 ...data,
 status: draftStatusValue,
 isDraft: true,
 } as z.infer<TFullSchema> & FieldValues);
 },
 [isDraft, form, draftSchema, draftStatusValue]
 );

 // Publish with full validation
 const publish = useCallback(
 async (onPublish: (data: z.infer<TFullSchema> & FieldValues) => Promise<void>) => {
 // Switch to full validation mode
 if (isDraft) {
 setIsDraft(false);
 }

 // Use handleSubmit for full validation
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 await form.handleSubmit(async (validData: any) => {
 await onPublish({
 ...validData,
 isDraft: false,
 });
 })();
 },
 [isDraft, form]
 );

 return {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 form: form as any,
 isDraft,
 setDraftMode,
 saveAsDraft,
 publish,
 canSaveDraft,
 draftStatusValue,
 isValidForPublish,
 };
}

/**
 * Helper hook that creates a simple draft/publish state without form integration.
 * Use this when you need draft mode logic but already have form handling.
 *
 * @param entityType - Entity type for status value
 * @param initialDraft - Initial draft state
 * @returns Draft mode state and controls
 */
export function useDraftState(
 entityType: keyof typeof DRAFT_STATUS = 'document',
 initialDraft = true
) {
 const [isDraft, setIsDraft] = useState(initialDraft);
 const draftStatusValue = DRAFT_STATUS[entityType] || DRAFT_STATUS.document;

 const toggle = useCallback(() => {
 setIsDraft((prev) => !prev);
 }, []);

 return {
 isDraft,
 setDraftMode: setIsDraft,
 toggle,
 draftStatusValue,
 };
}

// Re-export label utilities (moved to utils/draftLabels.ts to satisfy hooks naming convention)
export { getDraftLabel, getPublishLabel, getSaveAsDraftLabel } from '../utils/draftLabels';
