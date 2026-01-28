/**
 * Centralized Locale Configuration (ADR-001)
 *
 * Single source of truth for all date and number formatting across the application.
 * Supports FR and EN locales with consistent formatting patterns.
 *
 * @module localeConfig
 */

import { format, parse, isValid } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { z } from 'zod';

/**
 * Supported locale types
 */
export type SupportedLocale = 'fr' | 'en' | 'de';

/**
 * Number format configuration
 */
export interface NumberFormatConfig {
  /** Decimal separator character */
  decimal: string;
  /** Thousands separator character */
  thousands: string;
}

/**
 * Locale-aware Zod error messages
 * Comprehensive set for all common Zod validation scenarios
 */
export interface ZodMessages {
  // Basic validations
  required: string;
  invalidType: string;

  // String validations
  invalidString: string;
  tooShort: (min: number) => string;
  tooLong: (max: number) => string;
  invalidEmail: string;
  invalidUrl: string;
  invalidUuid: string;
  invalidRegex: string;

  // Number validations
  invalidNumber: string;
  notInteger: string;
  tooSmall: (min: number) => string;
  tooBig: (max: number) => string;
  notPositive: string;
  notNegative: string;
  notNonNegative: string;

  // Date validations
  invalidDate: string;

  // Array validations
  arrayTooShort: (min: number) => string;
  arrayTooLong: (max: number) => string;

  // Enum validations
  invalidEnum: (options: string[]) => string;

  // Custom messages
  custom: string;
}

/**
 * Complete locale configuration for a single locale
 */
export interface LocaleConfig {
  /** Date format pattern (e.g., 'dd/MM/yyyy') */
  dateFormat: string;
  /** DateTime format pattern (e.g., 'dd/MM/yyyy HH:mm') */
  dateTimeFormat: string;
  /** Time format pattern */
  timeFormat: string;
  /** Number formatting configuration */
  numberFormat: NumberFormatConfig;
  /** Locale-specific Zod validation messages */
  zodMessages: ZodMessages;
  /** date-fns locale object */
  dateFnsLocale: Locale;
  /** Intl locale string */
  intlLocale: string;
}

/**
 * Complete locale configurations for all supported locales
 */
export const localeConfig = {
  fr: {
    dateFormat: 'dd/MM/yyyy',
    dateTimeFormat: 'dd/MM/yyyy HH:mm',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
    },
    zodMessages: {
      // Basic validations
      required: 'Ce champ est requis',
      invalidType: 'Type de valeur invalide',

      // String validations
      invalidString: 'Ce champ doit être du texte',
      tooShort: (min: number) => min === 1
        ? 'Ce champ ne peut pas être vide'
        : `Minimum ${min} caractères (ex: ${'a'.repeat(Math.min(min, 5))}...)`,
      tooLong: (max: number) => `Maximum ${max} caractères autorisés`,
      invalidEmail: 'Format email invalide (ex: nom@entreprise.com)',
      invalidUrl: 'URL invalide (ex: https://exemple.com)',
      invalidUuid: 'Identifiant invalide (format UUID attendu)',
      invalidRegex: 'Format invalide',

      // Number validations
      invalidNumber: 'Nombre invalide (ex: 42 ou 3.14)',
      notInteger: 'Nombre entier requis (ex: 1, 2, 3)',
      tooSmall: (min: number) => `Minimum ${min} requis`,
      tooBig: (max: number) => `Maximum ${max} autorisé`,
      notPositive: 'La valeur doit être positive (> 0)',
      notNegative: 'La valeur doit être négative (< 0)',
      notNonNegative: 'La valeur doit être positive ou nulle (>= 0)',

      // Date validations
      invalidDate: 'Format invalide (ex: 15/01/2026)',

      // Array validations
      arrayTooShort: (min: number) => `Sélectionnez au moins ${min} élément${min > 1 ? 's' : ''}`,
      arrayTooLong: (max: number) => `Maximum ${max} élément${max > 1 ? 's' : ''} autorisé${max > 1 ? 's' : ''}`,

      // Enum validations
      invalidEnum: (options: string[]) => `Choisissez parmi : ${options.slice(0, 3).join(', ')}${options.length > 3 ? '...' : ''}`,

      // Custom messages
      custom: 'Valeur invalide',
    },
    dateFnsLocale: fr,
    intlLocale: 'fr-FR',
  },
  en: {
    dateFormat: 'MM/dd/yyyy',
    dateTimeFormat: 'MM/dd/yyyy HH:mm',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: '.',
      thousands: ',',
    },
    zodMessages: {
      // Basic validations
      required: 'This field is required',
      invalidType: 'Invalid value type',

      // String validations
      invalidString: 'This field must be text',
      tooShort: (min: number) => min === 1
        ? 'This field cannot be empty'
        : `Minimum ${min} characters (e.g., ${'a'.repeat(Math.min(min, 5))}...)`,
      tooLong: (max: number) => `Maximum ${max} characters allowed`,
      invalidEmail: 'Invalid email format (e.g., name@company.com)',
      invalidUrl: 'Invalid URL (e.g., https://example.com)',
      invalidUuid: 'Invalid identifier (UUID format expected)',
      invalidRegex: 'Invalid format',

      // Number validations
      invalidNumber: 'Invalid number (e.g., 42 or 3.14)',
      notInteger: 'Whole number required (e.g., 1, 2, 3)',
      tooSmall: (min: number) => `Minimum ${min} required`,
      tooBig: (max: number) => `Maximum ${max} allowed`,
      notPositive: 'Value must be positive (> 0)',
      notNegative: 'Value must be negative (< 0)',
      notNonNegative: 'Value must be zero or positive (>= 0)',

      // Date validations
      invalidDate: 'Invalid format (e.g., 01/15/2026)',

      // Array validations
      arrayTooShort: (min: number) => `Select at least ${min} item${min > 1 ? 's' : ''}`,
      arrayTooLong: (max: number) => `Maximum ${max} item${max > 1 ? 's' : ''} allowed`,

      // Enum validations
      invalidEnum: (options: string[]) => `Choose from: ${options.slice(0, 3).join(', ')}${options.length > 3 ? '...' : ''}`,

      // Custom messages
      custom: 'Invalid value',
    },
    dateFnsLocale: enUS,
    intlLocale: 'en-US',
  },
  de: {
    dateFormat: 'dd.MM.yyyy',
    dateTimeFormat: 'dd.MM.yyyy HH:mm',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: ',',
      thousands: '.',
    },
    zodMessages: {
      // Basic validations
      required: 'Dieses Feld ist erforderlich',
      invalidType: 'Ungültiger Werttyp',

      // String validations
      invalidString: 'Dieses Feld muss Text sein',
      tooShort: (min: number) => min === 1
        ? 'Dieses Feld darf nicht leer sein'
        : `Mindestens ${min} Zeichen (z.B. ${'a'.repeat(Math.min(min, 5))}...)`,
      tooLong: (max: number) => `Maximal ${max} Zeichen erlaubt`,
      invalidEmail: 'Ungültiges E-Mail-Format (z.B. name@firma.de)',
      invalidUrl: 'Ungültige URL (z.B. https://beispiel.de)',
      invalidUuid: 'Ungültige Kennung (UUID-Format erwartet)',
      invalidRegex: 'Ungültiges Format',

      // Number validations
      invalidNumber: 'Ungültige Zahl (z.B. 42 oder 3,14)',
      notInteger: 'Ganze Zahl erforderlich (z.B. 1, 2, 3)',
      tooSmall: (min: number) => `Mindestens ${min} erforderlich`,
      tooBig: (max: number) => `Maximal ${max} erlaubt`,
      notPositive: 'Der Wert muss positiv sein (> 0)',
      notNegative: 'Der Wert muss negativ sein (< 0)',
      notNonNegative: 'Der Wert muss null oder positiv sein (>= 0)',

      // Date validations
      invalidDate: 'Ungültiges Format (z.B. 15.01.2026)',

      // Array validations
      arrayTooShort: (min: number) => `Wählen Sie mindestens ${min} Element${min > 1 ? 'e' : ''}`,
      arrayTooLong: (max: number) => `Maximal ${max} Element${max > 1 ? 'e' : ''} erlaubt`,

      // Enum validations
      invalidEnum: (options: string[]) => `Wählen Sie aus: ${options.slice(0, 3).join(', ')}${options.length > 3 ? '...' : ''}`,

      // Custom messages
      custom: 'Ungültiger Wert',
    },
    dateFnsLocale: de,
    intlLocale: 'de-DE',
  },
} as const satisfies Record<SupportedLocale, LocaleConfig>;

/**
 * Get the complete locale configuration for a given locale
 *
 * @param locale - The locale to get configuration for ('fr' or 'en')
 * @returns The complete locale configuration
 *
 * @example
 * const config = getLocaleConfig('fr');
 * console.log(config.dateFormat); // 'dd/MM/yyyy'
 */
export function getLocaleConfig(locale: SupportedLocale): LocaleConfig {
  return localeConfig[locale];
}

/**
 * Get the date-fns locale object for a given locale
 *
 * @param locale - The locale to get date-fns locale for
 * @returns The date-fns Locale object
 *
 * @example
 * const dfLocale = getDateFnsLocale('fr');
 * format(new Date(), 'PPP', { locale: dfLocale });
 */
export function getDateFnsLocale(locale: SupportedLocale): Locale {
  return localeConfig[locale].dateFnsLocale;
}

/**
 * Format a date according to the specified locale
 *
 * @param date - The date to format
 * @param locale - The locale to use for formatting
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date(2026, 0, 15), 'fr'); // '15/01/2026'
 * formatDate(new Date(2026, 0, 15), 'en'); // '01/15/2026'
 * formatDate(new Date(2026, 0, 15, 14, 30), 'fr', true); // '15/01/2026 14:30'
 */
export function formatDate(
  date: Date,
  locale: SupportedLocale,
  includeTime = false
): string {
  const config = localeConfig[locale];
  const formatStr = includeTime ? config.dateTimeFormat : config.dateFormat;
  return format(date, formatStr, { locale: config.dateFnsLocale });
}

/**
 * Parse a localized date string into a Date object
 *
 * @param dateString - The date string to parse
 * @param locale - The locale of the date string
 * @returns Parsed Date object or null if invalid
 *
 * @example
 * parseLocalizedDate('15/01/2026', 'fr'); // Date object for Jan 15, 2026
 * parseLocalizedDate('01/15/2026', 'en'); // Date object for Jan 15, 2026
 * parseLocalizedDate('invalid', 'fr'); // null
 */
export function parseLocalizedDate(
  dateString: string,
  locale: SupportedLocale
): Date | null {
  const config = localeConfig[locale];
  try {
    const parsed = parse(dateString, config.dateFormat, new Date(), {
      locale: config.dateFnsLocale,
    });
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Format a localized date for display
 *
 * @param date - The date to format (Date object or ISO string)
 * @param locale - The locale to use for formatting
 * @param includeTime - Whether to include time
 * @returns Formatted date string, or empty string if invalid
 *
 * @example
 * formatLocalizedDate('2026-01-15T14:30:00Z', 'fr', true); // '15/01/2026 14:30'
 */
export function formatLocalizedDate(
  date: Date | string | null | undefined,
  locale: SupportedLocale,
  includeTime = false
): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!isValid(dateObj)) return '';

  return formatDate(dateObj, locale, includeTime);
}

/**
 * Format a number according to the specified locale
 *
 * @param value - The number to format
 * @param locale - The locale to use for formatting
 * @param options - Optional Intl.NumberFormat options
 * @returns Formatted number string
 *
 * @example
 * formatNumber(1234.56, 'fr'); // '1 234,56'
 * formatNumber(1234.56, 'en'); // '1,234.56'
 * formatNumber(1234.56, 'fr', { minimumFractionDigits: 2 }); // '1 234,56'
 */
export function formatNumber(
  value: number,
  locale: SupportedLocale,
  options?: Intl.NumberFormatOptions
): string {
  const config = localeConfig[locale];
  return new Intl.NumberFormat(config.intlLocale, options).format(value);
}

/**
 * Format a number as currency according to the specified locale
 *
 * @param value - The number to format
 * @param locale - The locale to use for formatting
 * @param currency - The currency code (default: EUR for FR, USD for EN)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56, 'fr'); // '1 234,56 €'
 * formatCurrency(1234.56, 'en'); // '$1,234.56'
 */
export function formatCurrency(
  value: number,
  locale: SupportedLocale,
  currency?: string
): string {
  const config = localeConfig[locale];
  const defaultCurrency = locale === 'en' ? 'USD' : 'EUR';
  return new Intl.NumberFormat(config.intlLocale, {
    style: 'currency',
    currency: currency ?? defaultCurrency,
  }).format(value);
}

/**
 * Format a percentage according to the specified locale
 *
 * @param value - The decimal value to format as percentage (0.5 = 50%)
 * @param locale - The locale to use for formatting
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentage(0.756, 'fr'); // '76 %'
 * formatPercentage(0.756, 'en', 1); // '75.6%'
 */
export function formatPercentage(
  value: number,
  locale: SupportedLocale,
  decimals = 0
): string {
  const config = localeConfig[locale];
  return new Intl.NumberFormat(config.intlLocale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Get Zod error messages for a given locale
 *
 * @param locale - The locale to get messages for
 * @returns ZodMessages object
 *
 * @example
 * const messages = getZodMessages('fr');
 * console.log(messages.required); // 'Ce champ est requis'
 */
export function getZodMessages(locale: SupportedLocale): ZodMessages {
  return localeConfig[locale].zodMessages;
}

// ============================================================================
// ZOD SCHEMA FACTORIES (Task 3: Locale-aware validation)
// ============================================================================

/**
 * Create a locale-aware date schema that validates and parses dates
 *
 * @param locale - The locale to use for parsing
 * @param options - Optional configuration
 * @returns Zod schema that validates localized date strings
 *
 * @example
 * const schema = createLocalizedDateSchema('fr');
 * schema.parse('15/01/2026'); // Valid
 * schema.parse('01/15/2026'); // Invalid for FR locale
 */
export function createLocalizedDateSchema(
  locale: SupportedLocale,
  options?: { required?: boolean; message?: string }
) {
  const config = localeConfig[locale];
  const isRequired = options?.required ?? true;
  const errorMessage = options?.message ?? config.zodMessages.invalidDate;

  const baseSchema = z.string().transform((val, ctx) => {
    if (!val || val.trim() === '') {
      if (isRequired) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: config.zodMessages.required,
        });
        return z.NEVER;
      }
      return null;
    }

    const parsed = parseLocalizedDate(val, locale);
    if (!parsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: errorMessage,
      });
      return z.NEVER;
    }

    return parsed;
  });

  return baseSchema;
}

/**
 * Create a locale-aware optional date schema
 *
 * @param locale - The locale to use for parsing
 * @returns Zod schema that validates optional localized date strings
 */
export function createOptionalLocalizedDateSchema(locale: SupportedLocale) {
  return createLocalizedDateSchema(locale, { required: false });
}

/**
 * Predefined locale-aware date schemas for common use cases
 * These are factory functions that return schemas for the specified locale
 */
export const zodDateSchemas = {
  /**
   * Required date schema for FR locale
   */
  requiredFr: () => createLocalizedDateSchema('fr'),

  /**
   * Required date schema for EN locale
   */
  requiredEn: () => createLocalizedDateSchema('en'),

  /**
   * Optional date schema for FR locale
   */
  optionalFr: () => createOptionalLocalizedDateSchema('fr'),

  /**
   * Optional date schema for EN locale
   */
  optionalEn: () => createOptionalLocalizedDateSchema('en'),

  /**
   * Create a date schema for any locale
   */
  forLocale: (locale: SupportedLocale, required = true) =>
    createLocalizedDateSchema(locale, { required }),
} as const;

/**
 * Create a locale-aware number schema that validates number inputs
 *
 * @param locale - The locale to use for parsing
 * @param options - Optional configuration
 * @returns Zod schema that validates numbers
 */
export function createLocalizedNumberSchema(
  _locale: SupportedLocale,
  options?: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  }
) {
  const { required = true, min, max, integer = false } = options ?? {};

   
  let schema = z.number();

  if (integer) {
    schema = schema.int();
  }

  if (min !== undefined) {
    schema = schema.min(min);
  }

  if (max !== undefined) {
    schema = schema.max(max);
  }

  if (!required) {
    return schema.optional();
  }

  return schema;
}
