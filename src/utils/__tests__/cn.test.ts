/**
 * CN Utility Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn utility', () => {
 it('should merge class names', () => {
 expect(cn('foo', 'bar')).toBe('foo bar');
 });

 it('should handle conditional classes', () => {
 const condition = false;
 expect(cn('foo', condition && 'bar', 'baz')).toBe('foo baz');
 });

 it('should handle undefined values', () => {
 expect(cn('foo', undefined, 'bar')).toBe('foo bar');
 });

 it('should handle null values', () => {
 expect(cn('foo', null, 'bar')).toBe('foo bar');
 });

 it('should merge tailwind classes correctly', () => {
 expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
 });

 it('should handle array of classes', () => {
 expect(cn(['foo', 'bar'])).toBe('foo bar');
 });

 it('should handle object notation', () => {
 expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
 });

 it('should return empty string for no inputs', () => {
 expect(cn()).toBe('');
 });

 it('should merge conflicting tailwind utilities', () => {
 expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
 });

 it('should handle mixed inputs', () => {
 expect(cn('foo', ['bar', 'baz'], { qux: true })).toBe('foo bar baz qux');
 });
});
