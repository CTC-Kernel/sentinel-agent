import { useMemo, useCallback } from 'react';
import { type Locale } from 'date-fns';
import { useStore } from '../store';
import {
 type SupportedLocale,
 type LocaleConfig,
 getLocaleConfig,
 getDateFnsLocale,
 formatDate,
 formatLocalizedDate,
 parseLocalizedDate,
 formatNumber,
 formatCurrency,
 formatPercentage,
 getZodMessages,
 createLocalizedDateSchema,
 createLocalizedNumberSchema,
} from '../config/localeConfig';

/**
 * Return type for the useLocale hook
 */
export interface UseLocaleReturn {
 /** Current locale ('fr' or 'en') */
 locale: SupportedLocale;
 /** Complete locale configuration */
 config: LocaleConfig;
 /** date-fns locale object for the current locale */
 dateFnsLocale: Locale;
 /** Format a Date object to localized string */
 formatDate: (date: Date, includeTime?: boolean) => string;
 /** Format a Date or ISO string to localized string */
 formatLocalizedDate: (
 date: Date | string | null | undefined,
 includeTime?: boolean
 ) => string;
 /** Parse a localized date string to Date object */
 parseDate: (dateString: string) => Date | null;
 /** Format a number with locale-specific separators */
 formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
 /** Format a number as currency */
 formatCurrency: (value: number, currency?: string) => string;
 /** Format a decimal as percentage */
 formatPercentage: (value: number, decimals?: number) => string;
 /** Get Zod validation messages for current locale */
 zodMessages: ReturnType<typeof getZodMessages>;
 /** Create a locale-aware date validation schema */
 createDateSchema: (options?: { required?: boolean }) => ReturnType<typeof createLocalizedDateSchema>;
 /** Create a locale-aware number validation schema */
 createNumberSchema: (options?: {
 required?: boolean;
 min?: number;
 max?: number;
 integer?: boolean;
 }) => ReturnType<typeof createLocalizedNumberSchema>;
 /** Translate a key */
 t: (key: string, defaultValueOrOptions?: string | Record<string, unknown>) => string;
}

/**
 * Hook to access locale-aware formatting and validation utilities
 *
 * Reads the current language from the global store and provides
 * memoized formatting functions that automatically use the correct locale.
 *
 * @returns Locale configuration and formatting utilities
 *
 * @example
 * ```tsx
 * function MyComponent() {
 * const { formatDate, formatNumber, locale } = useLocale();
 *
 * return (
 * <div>
 * <p>Date: {formatDate(new Date())}</p>
 * <p>Number: {formatNumber(1234.56)}</p>
 * <p>Current locale: {locale}</p>
 * </div>
 * );
 * }
 * ```
 */
export function useLocale(): UseLocaleReturn {
 const language = useStore((state) => state.language);
 const t = useStore((state) => state.t) as UseLocaleReturn['t'];

 // Memoize the locale config
 const config = useMemo(() => getLocaleConfig(language), [language]);

 // Memoize the date-fns locale
 const dateFnsLocale = useMemo(() => getDateFnsLocale(language), [language]);

 // Memoize the Zod messages
 const zodMessages = useMemo(() => getZodMessages(language), [language]);

 // Memoized formatting functions
 const formatDateFn = useCallback(
 (date: Date, includeTime = false) => formatDate(date, language, includeTime),
 [language]
 );

 const formatLocalizedDateFn = useCallback(
 (date: Date | string | null | undefined, includeTime = false) =>
 formatLocalizedDate(date, language, includeTime),
 [language]
 );

 const parseDateFn = useCallback(
 (dateString: string) => parseLocalizedDate(dateString, language),
 [language]
 );

 const formatNumberFn = useCallback(
 (value: number, options?: Intl.NumberFormatOptions) =>
 formatNumber(value, language, options),
 [language]
 );

 const formatCurrencyFn = useCallback(
 (value: number, currency?: string) => formatCurrency(value, language, currency),
 [language]
 );

 const formatPercentageFn = useCallback(
 (value: number, decimals = 0) => formatPercentage(value, language, decimals),
 [language]
 );

 // Schema factory functions
 const createDateSchema = useCallback(
 (options?: { required?: boolean }) =>
 createLocalizedDateSchema(language, options),
 [language]
 );

 const createNumberSchema = useCallback(
 (options?: {
 required?: boolean;
 min?: number;
 max?: number;
 integer?: boolean;
 }) => createLocalizedNumberSchema(language, options),
 [language]
 );

 return {
 locale: language,
 config,
 dateFnsLocale,
 formatDate: formatDateFn,
 formatLocalizedDate: formatLocalizedDateFn,
 parseDate: parseDateFn,
 formatNumber: formatNumberFn,
 formatCurrency: formatCurrencyFn,
 formatPercentage: formatPercentageFn,
 zodMessages,
 createDateSchema,
 createNumberSchema,
 t,
 };
}
