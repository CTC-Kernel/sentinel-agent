/**
 * Zod form resolver utilities
 * 
 * Extracted from hooks/useZodForm.ts to satisfy the convention
 * that only hooks (use*) are exported from /hooks/ directory.
 * 
 * @module utils/zodFormUtils
 */

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * Creates a localized Zod error map
 */
function createLocalizedErrorMap(locale: 'fr' | 'en'): z.ZodErrorMap {
 if (locale === 'fr') {
 return (issue, ctx) => {
 if (issue.code === z.ZodIssueCode.too_small && issue.minimum === 1) {
 return { message: 'Ce champ est requis' };
 }
 if (issue.code === z.ZodIssueCode.invalid_type && issue.received === 'undefined') {
 return { message: 'Ce champ est requis' };
 }
 return { message: ctx.defaultError };
 };
 }
 return (issue, ctx) => ({ message: ctx.defaultError });
}

/**
 * Creates a localized Zod resolver for react-hook-form.
 */
export function createLocalizedResolver<TSchema extends z.ZodSchema>(
 schema: TSchema,
 locale: 'fr' | 'en'
) {
 const errorMap = createLocalizedErrorMap(locale);
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 return zodResolver(schema as any, { errorMap } as any);
}
