/**
 * URL Validation Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { isSafeUrl, isSafeBlobUrl, validateUrl } from '../urlValidation';

describe('URL Validation', () => {
 describe('isSafeUrl', () => {
 it('should return false for empty string', () => {
 expect(isSafeUrl('')).toBe(false);
 });

 it('should return false for null/undefined', () => {
 expect(isSafeUrl(null as unknown as string)).toBe(false);
 expect(isSafeUrl(undefined as unknown as string)).toBe(false);
 });

 it('should allow relative paths', () => {
 expect(isSafeUrl('/dashboard')).toBe(true);
 expect(isSafeUrl('/users/123')).toBe(true);
 expect(isSafeUrl('/api/v1/data')).toBe(true);
 });

 it('should allow hash fragments', () => {
 expect(isSafeUrl('#section')).toBe(true);
 expect(isSafeUrl('#top')).toBe(true);
 });

 it('should block javascript: URLs', () => {
 expect(isSafeUrl('javascript:alert(1)')).toBe(false);
 expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
 expect(isSafeUrl(' javascript:void(0)')).toBe(false);
 });

 it('should block data: URLs', () => {
 expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
 expect(isSafeUrl('DATA:text/html,test')).toBe(false);
 });

 it('should allow http URLs', () => {
 expect(isSafeUrl('http://example.com')).toBe(true);
 expect(isSafeUrl('HTTP://EXAMPLE.COM')).toBe(true);
 });

 it('should allow https URLs', () => {
 expect(isSafeUrl('https://example.com')).toBe(true);
 expect(isSafeUrl('https://api.example.com/v1')).toBe(true);
 });

 it('should allow mailto: URLs', () => {
 expect(isSafeUrl('mailto:test@example.com')).toBe(true);
 expect(isSafeUrl('MAILTO:user@domain.com')).toBe(true);
 });

 it('should allow tel: URLs', () => {
 expect(isSafeUrl('tel:+33123456789')).toBe(true);
 expect(isSafeUrl('TEL:0123456789')).toBe(true);
 });

 it('should block blob: URLs (use isSafeBlobUrl instead)', () => {
 expect(isSafeUrl('blob:https://example.com/uuid')).toBe(false);
 });

 it('should block unknown schemes', () => {
 expect(isSafeUrl('ftp://example.com')).toBe(false);
 expect(isSafeUrl('file:///etc/passwd')).toBe(false);
 expect(isSafeUrl('custom://something')).toBe(false);
 });
 });

 describe('isSafeBlobUrl', () => {
 it('should allow blob: URLs with https origin', () => {
 expect(isSafeBlobUrl('blob:https://example.com/uuid')).toBe(true);
 });

 it('should allow blob: URLs with http origin', () => {
 expect(isSafeBlobUrl('blob:http://example.com/uuid')).toBe(true);
 });

 it('should reject non-blob URLs', () => {
 expect(isSafeBlobUrl('https://example.com')).toBe(false);
 });

 it('should reject empty string', () => {
 expect(isSafeBlobUrl('')).toBe(false);
 });
 });

 describe('validateUrl', () => {
 it('should return URL if safe', () => {
 expect(validateUrl('https://example.com')).toBe('https://example.com');
 expect(validateUrl('/dashboard')).toBe('/dashboard');
 });

 it('should return null if unsafe', () => {
 expect(validateUrl('javascript:alert(1)')).toBeNull();
 expect(validateUrl('data:text/html,test')).toBeNull();
 });

 it('should return null for empty string', () => {
 expect(validateUrl('')).toBeNull();
 });
 });
});
