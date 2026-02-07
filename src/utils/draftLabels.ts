/**
 * Draft mode label utilities
 * 
 * Extracted from hooks/useDraftMode.ts to satisfy the convention
 * that only hooks (use*) are exported from /hooks/ directory.
 * 
 * @module utils/draftLabels
 */

import type { SupportedLocale } from '../config/localeConfig';

/**
 * Gets the localized label for draft status.
 */
export function getDraftLabel(locale: SupportedLocale): string {
 return locale === 'fr' ? 'Brouillon' : 'Draft';
}

/**
 * Gets the localized label for publish action.
 */
export function getPublishLabel(locale: SupportedLocale): string {
 return locale === 'fr' ? 'Publier' : 'Publish';
}

/**
 * Gets the localized label for save as draft action.
 */
export function getSaveAsDraftLabel(locale: SupportedLocale): string {
 return locale === 'fr' ? 'Enregistrer en brouillon' : 'Save as Draft';
}
