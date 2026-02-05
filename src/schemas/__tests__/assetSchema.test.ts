/**
 * Unit tests for assetSchema.ts
 * Tests validation of asset forms
 */

import { describe, it, expect, vi } from 'vitest';
import { assetSchema } from '../assetSchema';
import { Criticality } from '../../types';

// Mock i18n
vi.mock('../../i18n', () => ({
 default: {
 t: (key: string, params?: Record<string, unknown>) => {
 const translations: Record<string, string> = {
 'validation.required': 'Ce champ est requis',
 'validation.maxLength': `Maximum ${params?.max} caractères`,
 'validation.ip': 'Adresse IP invalide',
 'validation.email': 'Email invalide',
 'validation.url': 'URL invalide'
 };
 return translations[key] || key;
 }
 }
}));

describe('assetSchema', () => {
 const validAsset = {
 name: 'Server Principal',
 type: 'Matériel' as const,
 owner: 'IT Department',
 confidentiality: Criticality.HIGH,
 integrity: Criticality.HIGH,
 availability: Criticality.CRITICAL,
 location: 'Datacenter Paris'
 };

 describe('required fields', () => {
 it('accepts valid asset data', () => {
 const result = assetSchema.safeParse(validAsset);
 expect(result.success).toBe(true);
 });

 it('rejects missing name', () => {
 const { name: _name, ...data } = validAsset;
 const result = assetSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects empty name', () => {
 const result = assetSchema.safeParse({ ...validAsset, name: '' });
 expect(result.success).toBe(false);
 });

 it('rejects missing type', () => {
 const { type: _type, ...data } = validAsset;
 const result = assetSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing owner', () => {
 const { owner: _owner, ...data } = validAsset;
 const result = assetSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing criticality fields', () => {
 const { confidentiality: _confidentiality, ...data } = validAsset;
 const result = assetSchema.safeParse(data);
 expect(result.success).toBe(false);
 });

 it('rejects missing location', () => {
 const { location: _location, ...data } = validAsset;
 const result = assetSchema.safeParse(data);
 expect(result.success).toBe(false);
 });
 });

 describe('type validation', () => {
 it.each(['Matériel', 'Logiciel', 'Données', 'Service', 'Humain'] as const)(
 'accepts valid type: %s',
 (type) => {
 const result = assetSchema.safeParse({ ...validAsset, type });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid type', () => {
 const result = assetSchema.safeParse({ ...validAsset, type: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('criticality validation', () => {
 it.each(Object.values(Criticality))(
 'accepts valid criticality: %s',
 (criticality) => {
 const result = assetSchema.safeParse({
  ...validAsset,
  confidentiality: criticality,
  integrity: criticality,
  availability: criticality
 });
 expect(result.success).toBe(true);
 }
 );

 it('rejects invalid criticality', () => {
 const result = assetSchema.safeParse({ ...validAsset, confidentiality: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('field length constraints', () => {
 it('rejects name longer than 200 characters', () => {
 const result = assetSchema.safeParse({ ...validAsset, name: 'a'.repeat(201) });
 expect(result.success).toBe(false);
 });

 it('accepts name at max length (200)', () => {
 const result = assetSchema.safeParse({ ...validAsset, name: 'a'.repeat(200) });
 expect(result.success).toBe(true);
 });
 });

 describe('IP address validation', () => {
 it('accepts valid IPv4 address', () => {
 const result = assetSchema.safeParse({ ...validAsset, ipAddress: '192.168.1.1' });
 expect(result.success).toBe(true);
 });

 it('accepts empty IP address', () => {
 const result = assetSchema.safeParse({ ...validAsset, ipAddress: '' });
 expect(result.success).toBe(true);
 });

 it('accepts undefined IP address', () => {
 const result = assetSchema.safeParse(validAsset);
 expect(result.success).toBe(true);
 });

 it('rejects invalid IP address format', () => {
 const result = assetSchema.safeParse({ ...validAsset, ipAddress: '999.999.999.999' });
 expect(result.success).toBe(false);
 });

 it('rejects malformed IP address', () => {
 const result = assetSchema.safeParse({ ...validAsset, ipAddress: '192.168.1' });
 expect(result.success).toBe(false);
 });

 it('accepts boundary IP values', () => {
 const result1 = assetSchema.safeParse({ ...validAsset, ipAddress: '0.0.0.0' });
 expect(result1.success).toBe(true);

 const result2 = assetSchema.safeParse({ ...validAsset, ipAddress: '255.255.255.255' });
 expect(result2.success).toBe(true);
 });
 });

 describe('email validation', () => {
 it('accepts valid email', () => {
 const result = assetSchema.safeParse({ ...validAsset, email: 'test@example.com' });
 expect(result.success).toBe(true);
 });

 it('accepts empty email', () => {
 const result = assetSchema.safeParse({ ...validAsset, email: '' });
 expect(result.success).toBe(true);
 });

 it('rejects invalid email', () => {
 const result = assetSchema.safeParse({ ...validAsset, email: 'invalid-email' });
 expect(result.success).toBe(false);
 });
 });

 describe('lifecycle status validation', () => {
 it.each(['Neuf', 'En service', 'En réparation', 'Fin de vie', 'Rebut'] as const)(
 'accepts valid lifecycle status: %s',
 (status) => {
 const result = assetSchema.safeParse({ ...validAsset, lifecycleStatus: status });
 expect(result.success).toBe(true);
 }
 );

 it('accepts undefined lifecycle status', () => {
 const result = assetSchema.safeParse(validAsset);
 expect(result.success).toBe(true);
 });

 it('rejects invalid lifecycle status', () => {
 const result = assetSchema.safeParse({ ...validAsset, lifecycleStatus: 'Invalid' });
 expect(result.success).toBe(false);
 });
 });

 describe('scope validation', () => {
 it('accepts valid scope array', () => {
 const result = assetSchema.safeParse({
 ...validAsset,
 scope: ['NIS2', 'DORA', 'ISO27001']
 });
 expect(result.success).toBe(true);
 });

 it('accepts empty scope array', () => {
 const result = assetSchema.safeParse({ ...validAsset, scope: [] });
 expect(result.success).toBe(true);
 });

 it('rejects invalid scope values', () => {
 const result = assetSchema.safeParse({ ...validAsset, scope: ['INVALID'] });
 expect(result.success).toBe(false);
 });
 });

 describe('numeric fields', () => {
 it('accepts valid purchase price', () => {
 const result = assetSchema.safeParse({ ...validAsset, purchasePrice: 1000 });
 expect(result.success).toBe(true);
 });

 it('coerces string to number for purchase price', () => {
 const result = assetSchema.safeParse({ ...validAsset, purchasePrice: '1000' });
 expect(result.success).toBe(true);
 });

 it('rejects negative purchase price', () => {
 const result = assetSchema.safeParse({ ...validAsset, purchasePrice: -100 });
 expect(result.success).toBe(false);
 });

 it('accepts zero purchase price', () => {
 const result = assetSchema.safeParse({ ...validAsset, purchasePrice: 0 });
 expect(result.success).toBe(true);
 });

 it('accepts valid current value', () => {
 const result = assetSchema.safeParse({ ...validAsset, currentValue: 500 });
 expect(result.success).toBe(true);
 });

 it('rejects negative current value', () => {
 const result = assetSchema.safeParse({ ...validAsset, currentValue: -500 });
 expect(result.success).toBe(false);
 });
 });

 describe('data details validation', () => {
 it('accepts valid data details', () => {
 const result = assetSchema.safeParse({
 ...validAsset,
 dataDetails: {
  format: 'Numérique',
  retentionPeriod: '5 years',
  hasWorm: true,
  isEncrypted: true,
  dataCategory: 'Client'
 }
 });
 expect(result.success).toBe(true);
 });

 it('validates data format enum', () => {
 const validResult = assetSchema.safeParse({
 ...validAsset,
 dataDetails: { format: 'Hybride' }
 });
 expect(validResult.success).toBe(true);

 const invalidResult = assetSchema.safeParse({
 ...validAsset,
 dataDetails: { format: 'Invalid' }
 });
 expect(invalidResult.success).toBe(false);
 });

 it('validates data category enum', () => {
 const result = assetSchema.safeParse({
 ...validAsset,
 dataDetails: {
  format: 'Numérique',
  dataCategory: 'Financier'
 }
 });
 expect(result.success).toBe(true);
 });
 });

 describe('service details validation', () => {
 it('accepts valid service details', () => {
 const result = assetSchema.safeParse({
 ...validAsset,
 serviceDetails: {
  providerUrl: 'https://provider.com',
  sla: '99.9% uptime',
  supportContact: 'support@provider.com',
  hostingLocation: 'EU'
 }
 });
 expect(result.success).toBe(true);
 });

 it('accepts empty provider URL', () => {
 const result = assetSchema.safeParse({
 ...validAsset,
 serviceDetails: { providerUrl: '' }
 });
 expect(result.success).toBe(true);
 });

 it('rejects invalid provider URL', () => {
 const result = assetSchema.safeParse({
 ...validAsset,
 serviceDetails: { providerUrl: 'not-a-url' }
 });
 expect(result.success).toBe(false);
 });
 });

 describe('AI analysis field', () => {
 it('accepts valid AI analysis', () => {
 const result = assetSchema.safeParse({
 ...validAsset,
 aiAnalysis: {
  type: 'classification',
  response: { recommendation: 'Test' },
  timestamp: '2024-01-15T10:00:00Z'
 }
 });
 expect(result.success).toBe(true);
 });

 it('accepts null AI analysis', () => {
 const result = assetSchema.safeParse({ ...validAsset, aiAnalysis: null });
 expect(result.success).toBe(true);
 });
 });

 describe('optional string fields', () => {
 it('trims whitespace from name', () => {
 const result = assetSchema.safeParse({ ...validAsset, name: ' Server ' });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.name).toBe('Server');
 }
 });

 it('trims whitespace from location', () => {
 const result = assetSchema.safeParse({ ...validAsset, location: ' Paris ' });
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.location).toBe('Paris');
 }
 });
 });
});
