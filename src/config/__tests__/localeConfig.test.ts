import { describe, it, expect } from 'vitest';
import {
 localeConfig,
 getLocaleConfig,
 getDateFnsLocale,
 formatDate,
 parseLocalizedDate,
 formatLocalizedDate,
 formatNumber,
 formatCurrency,
 formatPercentage,
 getZodMessages,
 createLocalizedDateSchema,
 createOptionalLocalizedDateSchema,
 createLocalizedNumberSchema,
 zodDateSchemas,
} from '../localeConfig';
import { fr, enUS } from 'date-fns/locale';

describe('localeConfig', () => {
 describe('localeConfig object', () => {
 it('should have FR locale configuration', () => {
 expect(localeConfig.fr).toBeDefined();
 expect(localeConfig.fr.dateFormat).toBe('dd/MM/yyyy');
 expect(localeConfig.fr.dateTimeFormat).toBe('dd/MM/yyyy HH:mm');
 expect(localeConfig.fr.numberFormat.decimal).toBe(',');
 expect(localeConfig.fr.numberFormat.thousands).toBe(' ');
 expect(localeConfig.fr.intlLocale).toBe('fr-FR');
 });

 it('should have EN locale configuration', () => {
 expect(localeConfig.en).toBeDefined();
 expect(localeConfig.en.dateFormat).toBe('MM/dd/yyyy');
 expect(localeConfig.en.dateTimeFormat).toBe('MM/dd/yyyy HH:mm');
 expect(localeConfig.en.numberFormat.decimal).toBe('.');
 expect(localeConfig.en.numberFormat.thousands).toBe(',');
 expect(localeConfig.en.intlLocale).toBe('en-US');
 });

 it('should have zod messages for both locales', () => {
 expect(localeConfig.fr.zodMessages.required).toBe('Ce champ est requis');
 expect(localeConfig.en.zodMessages.required).toBe('This field is required');
 });
 });

 describe('getLocaleConfig', () => {
 it('should return FR config for fr locale', () => {
 const config = getLocaleConfig('fr');
 expect(config.dateFormat).toBe('dd/MM/yyyy');
 expect(config.intlLocale).toBe('fr-FR');
 });

 it('should return EN config for en locale', () => {
 const config = getLocaleConfig('en');
 expect(config.dateFormat).toBe('MM/dd/yyyy');
 expect(config.intlLocale).toBe('en-US');
 });
 });

 describe('getDateFnsLocale', () => {
 it('should return FR date-fns locale for fr', () => {
 const locale = getDateFnsLocale('fr');
 expect(locale).toBe(fr);
 });

 it('should return EN date-fns locale for en', () => {
 const locale = getDateFnsLocale('en');
 expect(locale).toBe(enUS);
 });
 });

 describe('formatDate', () => {
 it('formats FR dates as dd/MM/yyyy', () => {
 const date = new Date(2026, 0, 15); // 15 Jan 2026
 expect(formatDate(date, 'fr')).toBe('15/01/2026');
 });

 it('formats EN dates as MM/dd/yyyy', () => {
 const date = new Date(2026, 0, 15); // 15 Jan 2026
 expect(formatDate(date, 'en')).toBe('01/15/2026');
 });

 it('formats FR dates with time when includeTime is true', () => {
 const date = new Date(2026, 0, 15, 14, 30);
 expect(formatDate(date, 'fr', true)).toBe('15/01/2026 14:30');
 });

 it('formats EN dates with time when includeTime is true', () => {
 const date = new Date(2026, 0, 15, 14, 30);
 expect(formatDate(date, 'en', true)).toBe('01/15/2026 14:30');
 });

 it('handles end of year dates correctly', () => {
 const date = new Date(2026, 11, 31); // 31 Dec 2026
 expect(formatDate(date, 'fr')).toBe('31/12/2026');
 expect(formatDate(date, 'en')).toBe('12/31/2026');
 });

 it('handles leap year date (Feb 29)', () => {
 const date = new Date(2028, 1, 29); // 29 Feb 2028 (leap year)
 expect(formatDate(date, 'fr')).toBe('29/02/2028');
 expect(formatDate(date, 'en')).toBe('02/29/2028');
 });
 });

 describe('parseLocalizedDate', () => {
 it('parses FR date format correctly', () => {
 const parsed = parseLocalizedDate('15/01/2026', 'fr');
 expect(parsed).not.toBeNull();
 expect(parsed?.getFullYear()).toBe(2026);
 expect(parsed?.getMonth()).toBe(0); // January is 0
 expect(parsed?.getDate()).toBe(15);
 });

 it('parses EN date format correctly', () => {
 const parsed = parseLocalizedDate('01/15/2026', 'en');
 expect(parsed).not.toBeNull();
 expect(parsed?.getFullYear()).toBe(2026);
 expect(parsed?.getMonth()).toBe(0);
 expect(parsed?.getDate()).toBe(15);
 });

 it('returns null for invalid FR date', () => {
 expect(parseLocalizedDate('invalid', 'fr')).toBeNull();
 expect(parseLocalizedDate('2026/01/15', 'fr')).toBeNull();
 expect(parseLocalizedDate('01-15-2026', 'fr')).toBeNull();
 });

 it('returns null for invalid EN date', () => {
 expect(parseLocalizedDate('invalid', 'en')).toBeNull();
 expect(parseLocalizedDate('2026/01/15', 'en')).toBeNull();
 });

 it('returns null for empty string', () => {
 expect(parseLocalizedDate('', 'fr')).toBeNull();
 expect(parseLocalizedDate('', 'en')).toBeNull();
 });

 it('handles edge cases like Feb 30 (invalid date)', () => {
 // Feb 30 doesn't exist
 const parsed = parseLocalizedDate('30/02/2026', 'fr');
 // date-fns parse may adjust or return invalid
 expect(parsed === null || (parsed && parsed.getMonth() !== 1)).toBe(true);
 });
 });

 describe('formatLocalizedDate', () => {
 it('formats Date object', () => {
 const date = new Date(2026, 0, 15);
 expect(formatLocalizedDate(date, 'fr')).toBe('15/01/2026');
 expect(formatLocalizedDate(date, 'en')).toBe('01/15/2026');
 });

 it('formats ISO string', () => {
 const isoString = '2026-01-15T10:30:00Z';
 expect(formatLocalizedDate(isoString, 'fr')).toBe('15/01/2026');
 expect(formatLocalizedDate(isoString, 'en')).toBe('01/15/2026');
 });

 it('formats ISO string with time when includeTime is true', () => {
 const isoString = '2026-01-15T10:30:00Z';
 const result = formatLocalizedDate(isoString, 'fr', true);
 expect(result).toContain('15/01/2026');
 });

 it('returns empty string for null', () => {
 expect(formatLocalizedDate(null, 'fr')).toBe('');
 expect(formatLocalizedDate(null, 'en')).toBe('');
 });

 it('returns empty string for undefined', () => {
 expect(formatLocalizedDate(undefined, 'fr')).toBe('');
 expect(formatLocalizedDate(undefined, 'en')).toBe('');
 });

 it('returns empty string for invalid date string', () => {
 expect(formatLocalizedDate('invalid-date', 'fr')).toBe('');
 });
 });

 describe('formatNumber', () => {
 it('formats FR numbers with comma as decimal and space as thousands', () => {
 const result = formatNumber(1234.56, 'fr');
 // French locale uses non-breaking space (U+00A0) for thousands
 expect(result.replace(/\s/g, ' ')).toMatch(/1\s*234,56/);
 });

 it('formats EN numbers with period as decimal and comma as thousands', () => {
 const result = formatNumber(1234.56, 'en');
 expect(result).toBe('1,234.56');
 });

 it('handles large numbers correctly', () => {
 const result = formatNumber(1234567.89, 'en');
 expect(result).toBe('1,234,567.89');
 });

 it('handles zero correctly', () => {
 expect(formatNumber(0, 'fr')).toBe('0');
 expect(formatNumber(0, 'en')).toBe('0');
 });

 it('handles negative numbers correctly', () => {
 const resultFr = formatNumber(-1234.56, 'fr');
 const resultEn = formatNumber(-1234.56, 'en');
 expect(resultFr).toContain('-');
 expect(resultEn).toContain('-');
 });

 it('respects Intl options for minimum fraction digits', () => {
 const result = formatNumber(1234, 'en', { minimumFractionDigits: 2 });
 expect(result).toBe('1,234.00');
 });
 });

 describe('formatCurrency', () => {
 it('formats FR currency with EUR by default', () => {
 const result = formatCurrency(1234.56, 'fr');
 expect(result).toContain('1');
 expect(result).toContain('234');
 expect(result).toContain('€');
 });

 it('formats EN currency with USD by default', () => {
 const result = formatCurrency(1234.56, 'en');
 expect(result).toContain('$');
 expect(result).toBe('$1,234.56');
 });

 it('allows custom currency', () => {
 const result = formatCurrency(1234.56, 'en', 'GBP');
 expect(result).toContain('£');
 });
 });

 describe('formatPercentage', () => {
 it('formats FR percentage correctly', () => {
 const result = formatPercentage(0.756, 'fr');
 // FR percentage includes space before %
 expect(result.replace(/\s/g, '')).toContain('76');
 expect(result).toContain('%');
 });

 it('formats EN percentage correctly', () => {
 const result = formatPercentage(0.756, 'en');
 expect(result).toBe('76%');
 });

 it('respects decimal places', () => {
 const result = formatPercentage(0.7567, 'en', 1);
 expect(result).toBe('75.7%');
 });

 it('handles 100% correctly', () => {
 expect(formatPercentage(1, 'en')).toBe('100%');
 });

 it('handles 0% correctly', () => {
 expect(formatPercentage(0, 'en')).toBe('0%');
 });
 });

 describe('getZodMessages', () => {
 it('returns FR zod messages', () => {
 const messages = getZodMessages('fr');
 expect(messages.required).toBe('Ce champ est requis');
 expect(messages.invalidDate).toContain('15/01/2026');
 expect(messages.invalidEmail).toContain('email');
 });

 it('returns EN zod messages', () => {
 const messages = getZodMessages('en');
 expect(messages.required).toBe('This field is required');
 expect(messages.invalidDate).toContain('01/15/2026');
 expect(messages.invalidEmail).toContain('email');
 });

 it('tooShort returns correct message with interpolation', () => {
 const messagesFr = getZodMessages('fr');
 const messagesEn = getZodMessages('en');
 expect(messagesFr.tooShort(5)).toContain('5');
 expect(messagesEn.tooShort(5)).toContain('5');
 });

 it('tooLong returns correct message with interpolation', () => {
 const messagesFr = getZodMessages('fr');
 const messagesEn = getZodMessages('en');
 expect(messagesFr.tooLong(100)).toContain('100');
 expect(messagesEn.tooLong(100)).toContain('100');
 });
 });

 describe('createLocalizedDateSchema', () => {
 describe('FR locale', () => {
 it('validates valid FR date format', () => {
 const schema = createLocalizedDateSchema('fr');
 const result = schema.safeParse('15/01/2026');
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data).toBeInstanceOf(Date);
 expect(result.data?.getFullYear()).toBe(2026);
 }
 });

 it('rejects invalid FR date format', () => {
 const schema = createLocalizedDateSchema('fr');
 const result = schema.safeParse('01/15/2026'); // EN format
 expect(result.success).toBe(false);
 });

 it('rejects empty string when required', () => {
 const schema = createLocalizedDateSchema('fr');
 const result = schema.safeParse('');
 expect(result.success).toBe(false);
 });

 it('returns correct error message for invalid date', () => {
 const schema = createLocalizedDateSchema('fr');
 const result = schema.safeParse('invalid');
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toContain('15/01/2026');
 }
 });
 });

 describe('EN locale', () => {
 it('validates valid EN date format', () => {
 const schema = createLocalizedDateSchema('en');
 const result = schema.safeParse('01/15/2026');
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data).toBeInstanceOf(Date);
 expect(result.data?.getMonth()).toBe(0); // January
 }
 });

 it('rejects invalid EN date format', () => {
 const schema = createLocalizedDateSchema('en');
 const result = schema.safeParse('15/01/2026'); // FR format
 expect(result.success).toBe(false);
 });
 });
 });

 describe('createOptionalLocalizedDateSchema', () => {
 it('allows empty string', () => {
 const schema = createOptionalLocalizedDateSchema('fr');
 const result = schema.safeParse('');
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data).toBeNull();
 }
 });

 it('still validates non-empty strings', () => {
 const schema = createOptionalLocalizedDateSchema('fr');
 const validResult = schema.safeParse('15/01/2026');
 const invalidResult = schema.safeParse('invalid');

 expect(validResult.success).toBe(true);
 expect(invalidResult.success).toBe(false);
 });
 });

 describe('zodDateSchemas', () => {
 it('requiredFr creates FR required schema', () => {
 const schema = zodDateSchemas.requiredFr();
 expect(schema.safeParse('15/01/2026').success).toBe(true);
 expect(schema.safeParse('').success).toBe(false);
 });

 it('requiredEn creates EN required schema', () => {
 const schema = zodDateSchemas.requiredEn();
 expect(schema.safeParse('01/15/2026').success).toBe(true);
 expect(schema.safeParse('').success).toBe(false);
 });

 it('optionalFr creates FR optional schema', () => {
 const schema = zodDateSchemas.optionalFr();
 expect(schema.safeParse('').success).toBe(true);
 });

 it('optionalEn creates EN optional schema', () => {
 const schema = zodDateSchemas.optionalEn();
 expect(schema.safeParse('').success).toBe(true);
 });

 it('forLocale creates schema for specified locale', () => {
 const schemaFr = zodDateSchemas.forLocale('fr', true);
 const schemaEn = zodDateSchemas.forLocale('en', false);

 expect(schemaFr.safeParse('15/01/2026').success).toBe(true);
 expect(schemaEn.safeParse('').success).toBe(true);
 });
 });

 describe('createLocalizedNumberSchema', () => {
 it('creates required number schema by default', () => {
 const schema = createLocalizedNumberSchema('fr');
 expect(schema.safeParse(123).success).toBe(true);
 });

 it('validates min constraint', () => {
 const schema = createLocalizedNumberSchema('en', { min: 10 });
 expect(schema.safeParse(5).success).toBe(false);
 expect(schema.safeParse(10).success).toBe(true);
 expect(schema.safeParse(15).success).toBe(true);
 });

 it('validates max constraint', () => {
 const schema = createLocalizedNumberSchema('en', { max: 100 });
 expect(schema.safeParse(50).success).toBe(true);
 expect(schema.safeParse(100).success).toBe(true);
 expect(schema.safeParse(101).success).toBe(false);
 });

 it('validates integer constraint', () => {
 const schema = createLocalizedNumberSchema('en', { integer: true });
 expect(schema.safeParse(10).success).toBe(true);
 expect(schema.safeParse(10.5).success).toBe(false);
 });
 });

 describe('edge cases', () => {
 it('handles time zone differences in ISO strings', () => {
 // UTC midnight - could be different day in some timezones
 const isoString = '2026-01-15T00:00:00Z';
 const result = formatLocalizedDate(isoString, 'fr');
 expect(result).toMatch(/\d{2}\/01\/2026/);
 });

 it('handles very large numbers', () => {
 const largeNumber = 999999999999.99;
 const result = formatNumber(largeNumber, 'en');
 expect(result).toContain('999');
 });

 it('handles very small decimal numbers', () => {
 const smallNumber = 0.001;
 const result = formatNumber(smallNumber, 'en', { minimumFractionDigits: 3 });
 expect(result).toBe('0.001');
 });
 });
});
