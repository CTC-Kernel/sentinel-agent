import { describe, it, expect } from 'vitest';
import { sanitizeData } from '../dataSanitizer';

describe('dataSanitizer', () => {
 describe('sanitizeData', () => {
 it('should return null for null input', () => {
 expect(sanitizeData(null)).toBeNull();
 });

 it('should return null for undefined input', () => {
 expect(sanitizeData(undefined)).toBeNull();
 });

 it('should return null for NaN', () => {
 expect(sanitizeData(NaN)).toBeNull();
 });

 it('should return primitive values unchanged', () => {
 expect(sanitizeData('test string')).toBe('test string');
 expect(sanitizeData(42)).toBe(42);
 expect(sanitizeData(true)).toBe(true);
 expect(sanitizeData(false)).toBe(false);
 expect(sanitizeData(0)).toBe(0);
 expect(sanitizeData('')).toBe('');
 });

 it('should handle Date objects', () => {
 const date = new Date('2024-01-15T10:00:00Z');
 expect(sanitizeData(date)).toBe(date);
 expect(sanitizeData(date) instanceof Date).toBe(true);
 });

 it('should convert undefined values to null in objects', () => {
 const input = {
 name: 'Test',
 value: undefined,
 active: true
 };

 const result = sanitizeData(input);
 expect(result).toEqual({
 name: 'Test',
 value: null,
 active: true
 });
 });

 it('should handle nested objects', () => {
 const input = {
 level1: {
  level2: {
  value: undefined,
  name: 'nested'
  }
 }
 };

 const result = sanitizeData(input);
 expect(result).toEqual({
 level1: {
  level2: {
  value: null,
  name: 'nested'
  }
 }
 });
 });

 it('should handle arrays', () => {
 const input = [1, undefined, 3, null, 5];
 const result = sanitizeData(input);
 expect(result).toEqual([1, null, 3, null, 5]);
 });

 it('should handle arrays of objects', () => {
 const input = [
 { name: 'Item 1', value: undefined },
 { name: 'Item 2', value: 10 }
 ];

 const result = sanitizeData(input);
 expect(result).toEqual([
 { name: 'Item 1', value: null },
 { name: 'Item 2', value: 10 }
 ]);
 });

 it('should handle objects with arrays', () => {
 const input = {
 items: [1, undefined, 3],
 name: 'Container',
 metadata: undefined
 };

 const result = sanitizeData(input);
 expect(result).toEqual({
 items: [1, null, 3],
 name: 'Container',
 metadata: null
 });
 });

 it('should handle deeply nested structures', () => {
 const input = {
 a: {
  b: {
  c: {
  d: {
  value: undefined,
  items: [undefined, { nested: undefined }]
  }
  }
  }
 }
 };

 const result = sanitizeData(input);
 expect(result.a.b.c.d.value).toBeNull();
 expect(result.a.b.c.d.items[0]).toBeNull();
 expect((result.a.b.c.d.items[1] as { nested: unknown }).nested).toBeNull();
 });

 it('should handle empty objects', () => {
 expect(sanitizeData({})).toEqual({});
 });

 it('should handle empty arrays', () => {
 expect(sanitizeData([])).toEqual([]);
 });

 it('should preserve object keys with null values', () => {
 const input = {
 name: 'Test',
 nullValue: null,
 undefinedValue: undefined
 };

 const result = sanitizeData(input);
 expect(result).toHaveProperty('name', 'Test');
 expect(result).toHaveProperty('nullValue', null);
 expect(result).toHaveProperty('undefinedValue', null);
 });

 it('should handle mixed nested structures', () => {
 const input = {
 string: 'hello',
 number: 42,
 boolean: true,
 null: null,
 undefined: undefined,
 array: [1, 'two', undefined, { nested: undefined }],
 object: {
  deep: {
  value: undefined
  }
 },
 date: new Date('2024-01-01')
 };

 const result = sanitizeData(input);

 expect(result.string).toBe('hello');
 expect(result.number).toBe(42);
 expect(result.boolean).toBe(true);
 expect(result.null).toBeNull();
 expect(result.undefined).toBeNull();
 expect(result.array).toEqual([1, 'two', null, { nested: null }]);
 expect(result.object.deep.value).toBeNull();
 expect(result.date instanceof Date).toBe(true);
 });

 it('should handle objects with inherited properties', () => {
 const parent = { inherited: 'value' };
 const child = Object.create(parent);
 child.own = 'property';
 child.undefinedOwn = undefined;

 const result = sanitizeData(child);

 // Only own properties should be included
 expect(result).toHaveProperty('own', 'property');
 expect(result).toHaveProperty('undefinedOwn', null);
 expect(result).not.toHaveProperty('inherited');
 });

 it('should handle special number values', () => {
 expect(sanitizeData(Infinity)).toBe(Infinity);
 expect(sanitizeData(-Infinity)).toBe(-Infinity);
 expect(sanitizeData(Number.MAX_VALUE)).toBe(Number.MAX_VALUE);
 expect(sanitizeData(Number.MIN_VALUE)).toBe(Number.MIN_VALUE);
 });

 it('should preserve function references in object', () => {
 const fn = () => 'test';
 const input = { callback: fn };
 const result = sanitizeData(input);
 expect(result.callback).toBe(fn);
 });
 });
});
