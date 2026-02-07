/**
 * useZodForm - Locale-aware form validation hook (Story 1.2)
 *
 * Combines react-hook-form with localized Zod error messages.
 *
 * @module useZodForm
 */

import { useForm, UseFormProps, UseFormReturn, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale } from './useLocale';
import { createLocalizedErrorMap } from '../utils/zodErrorMap';

/**
 * Options for useZodForm hook
 */
export interface UseZodFormOptions<TSchema extends z.ZodSchema>
 extends Omit<UseFormProps<z.infer<TSchema> & FieldValues>, 'resolver'> {
 /** Zod schema for validation */
 schema: TSchema;
}

/**
 * Hook that creates a form with locale-aware Zod validation.
 *
 * This hook combines react-hook-form with our localized Zod error map,
 * ensuring all validation errors are displayed in the user's language.
 *
 * @param options - Form options including the Zod schema
 * @returns react-hook-form's UseFormReturn with localized errors
 *
 * @example
 * ```tsx
 * const UserSchema = z.object({
 * name: z.string().min(3),
 * email: z.string().email(),
 * });
 *
 * function MyForm() {
 * const form = useZodForm({
 * schema: UserSchema,
 * defaultValues: { name: '', email: '' }
 * });
 *
 * return (
 * <form onSubmit={form.handleSubmit(onSubmit)}>
 * <input {...form.register('name')} />
 * {form.formState.errors.name?.message}
 * // Displays "Minimum 3 caractères requis" in FR
 * // or "Minimum 3 characters required" in EN
 * </form>
 * );
 * }
 * ```
 */
export function useZodForm<TSchema extends z.ZodSchema>(
 options: UseZodFormOptions<TSchema>
): UseFormReturn<z.infer<TSchema> & FieldValues> {
 const { schema, ...formOptions } = options;
 const { locale } = useLocale();

 const errorMap = createLocalizedErrorMap(locale);

 return useForm<z.infer<TSchema> & FieldValues>({
 ...formOptions,
 // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required: zodResolver expects ZodType<any> but TSchema is ZodSchema, causing type incompatibility between @hookform/resolvers/zod and zod generics
 resolver: zodResolver(schema as any, { errorMap } as any),
 });
}

// Re-export utility (moved to utils/zodFormUtils.ts to satisfy hooks naming convention)
export { createLocalizedResolver } from '../utils/zodFormUtils';
