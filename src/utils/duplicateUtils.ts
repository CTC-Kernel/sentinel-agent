/**
 * Duplicate suffix utilities
 * 
 * Extracted from hooks/useDuplicate.ts to satisfy the convention
 * that only hooks (use*) are exported from /hooks/ directory.
 * 
 * @module utils/duplicateUtils
 */

import type { SupportedLocale } from '../config/localeConfig';

const DUPLICATE_SUFFIX: Record<SupportedLocale, string> = {
 fr: '(Copie)',
 en: '(Copy)',
 de: '(Kopie)',
};

/**
 * Add locale-aware duplicate suffix to a name
 */
export function addDuplicateSuffix(name: string, locale: SupportedLocale): string {
 const suffix = DUPLICATE_SUFFIX[locale];
 return `${name} ${suffix}`;
}
