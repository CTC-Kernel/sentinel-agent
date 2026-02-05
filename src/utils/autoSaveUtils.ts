import { SupportedLocale } from '../config/localeConfig';

/**
 * Localized labels for the AutoSaveIndicator
 */
const labels = {
 fr: {
 saving: 'Enregistrement...',
 saved: 'Enregistré',
 error: "Échec de l'enregistrement",
 retry: 'Réessayer',
 pending: 'Modifications en attente...',
 justNow: "À l'instant",
 minutesAgo: (n: number) => `il y a ${n} min`,
 hoursAgo: (n: number) => `il y a ${n}h`,
 },
 en: {
 saving: 'Saving...',
 saved: 'Saved',
 error: 'Save failed',
 retry: 'Retry',
 pending: 'Changes pending...',
 justNow: 'Just now',
 minutesAgo: (n: number) => `${n} min ago`,
 hoursAgo: (n: number) => `${n}h ago`,
 },
 de: {
 saving: 'Speichern...',
 saved: 'Gespeichert',
 error: 'Speichern fehlgeschlagen',
 retry: 'Erneut versuchen',
 pending: 'Änderungen ausstehend...',
 justNow: 'Gerade eben',
 minutesAgo: (n: number) => `vor ${n} Min.`,
 hoursAgo: (n: number) => `vor ${n} Std.`,
 },
} as const;

/**
 * Get localized label for a key
 */
export function getAutoSaveLabel(
 locale: SupportedLocale,
 key: keyof typeof labels.fr
): string | ((n: number) => string) {
 return labels[locale][key];
}

export function getAutoSaveLabels(locale: SupportedLocale) {
 return labels[locale];
}
