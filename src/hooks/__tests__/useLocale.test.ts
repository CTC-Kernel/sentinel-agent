/**
 * useLocale Hook Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLocale } from '../useLocale';

// Mock the store
vi.mock('../../store', () => ({
 useStore: vi.fn((selector) => {
 const state = { language: 'fr' as const };
 return selector(state);
 })
}));

// Mock localeConfig functions
vi.mock('../../config/localeConfig', () => ({
 getLocaleConfig: vi.fn((locale: string) => ({
 code: locale,
 dateFormat: 'dd/MM/yyyy',
 timeFormat: 'HH:mm',
 currency: 'EUR',
 currencySymbol: '€'
 })),
 getDateFnsLocale: vi.fn(() => ({})),
 formatDate: vi.fn((_locale: string, _date: Date, _includeTime?: boolean) => '15/01/2024'),
 formatLocalizedDate: vi.fn((date: Date | string | null, _locale: string, _includeTime?: boolean) =>
 date ? '15/01/2024' : '-'
 ),
 parseLocalizedDate: vi.fn((dateString: string) => new Date(dateString)),
 formatNumber: vi.fn((value: number) => value.toLocaleString('fr-FR')),
 formatCurrency: vi.fn((value: number) => `${value.toLocaleString('fr-FR')} €`),
 formatPercentage: vi.fn((value: number) => `${value * 100}%`),
 getZodMessages: vi.fn(() => ({
 required: 'Ce champ est requis',
 invalid: 'Valeur invalide'
 })),
 createLocalizedDateSchema: vi.fn(() => ({})),
 createLocalizedNumberSchema: vi.fn(() => ({}))
}));

describe('useLocale', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should return the current locale', () => {
 const { result } = renderHook(() => useLocale());
 expect(result.current.locale).toBe('fr');
 });

 it('should return locale config', () => {
 const { result } = renderHook(() => useLocale());
 expect(result.current.config).toBeDefined();
 expect(result.current.config).toBeDefined();
 });

 it('should return dateFnsLocale', () => {
 const { result } = renderHook(() => useLocale());
 expect(result.current.dateFnsLocale).toBeDefined();
 });

 it('should provide formatDate function', () => {
 const { result } = renderHook(() => useLocale());
 const formatted = result.current.formatDate(new Date('2024-01-15'));
 expect(typeof formatted).toBe('string');
 });

 it('should provide formatLocalizedDate function', () => {
 const { result } = renderHook(() => useLocale());
 const formatted = result.current.formatLocalizedDate('2024-01-15');
 expect(typeof formatted).toBe('string');
 });

 it('should provide parseDate function', () => {
 const { result } = renderHook(() => useLocale());
 const date = result.current.parseDate('15/01/2024');
 expect(date).toBeDefined();
 });

 it('should provide formatNumber function', () => {
 const { result } = renderHook(() => useLocale());
 const formatted = result.current.formatNumber(1234.56);
 expect(typeof formatted).toBe('string');
 });

 it('should provide formatCurrency function', () => {
 const { result } = renderHook(() => useLocale());
 const formatted = result.current.formatCurrency(1234.56);
 expect(typeof formatted).toBe('string');
 });

 it('should provide formatPercentage function', () => {
 const { result } = renderHook(() => useLocale());
 const formatted = result.current.formatPercentage(0.75);
 expect(typeof formatted).toBe('string');
 });

 it('should provide zodMessages', () => {
 const { result } = renderHook(() => useLocale());
 expect(result.current.zodMessages).toBeDefined();
 });

 it('should provide createDateSchema function', () => {
 const { result } = renderHook(() => useLocale());
 expect(typeof result.current.createDateSchema).toBe('function');
 });

 it('should provide createNumberSchema function', () => {
 const { result } = renderHook(() => useLocale());
 expect(typeof result.current.createNumberSchema).toBe('function');
 });

 it('should return all expected properties', () => {
 const { result } = renderHook(() => useLocale());

 const expectedKeys = [
 'locale',
 'config',
 'dateFnsLocale',
 'formatDate',
 'formatLocalizedDate',
 'parseDate',
 'formatNumber',
 'formatCurrency',
 'formatPercentage',
 'zodMessages',
 'createDateSchema',
 'createNumberSchema'
 ];

 expectedKeys.forEach(key => {
 expect(result.current).toHaveProperty(key);
 });
 });
});
