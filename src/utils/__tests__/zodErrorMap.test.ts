import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
 getLocalizedMessages,
 createLocalizedString,
 createLocalizedEmail,
 createLocalizedUrl,
 createLocalizedNumber,
 createLocalizedArray,
 validateData,
 getErrorMessages,
 hasValidationErrors,
 createSchemaBuilder,
} from '../zodErrorMap';

describe('zodErrorMap', () => {
 describe('getLocalizedMessages', () => {
 it('returns FR messages', () => {
 const messages = getLocalizedMessages('fr');
 expect(messages.required).toBe('Ce champ est requis');
 expect(messages.invalidEmail).toBe('Format email invalide (ex: nom@entreprise.com)');
 expect(messages.tooShort(3)).toBe('Minimum 3 caractères (ex: aaa...)');
 });

 it('returns EN messages', () => {
 const messages = getLocalizedMessages('en');
 expect(messages.required).toBe('This field is required');
 expect(messages.invalidEmail).toBe('Invalid email format (e.g., name@company.com)');
 expect(messages.tooShort(3)).toBe('Minimum 3 characters (e.g., aaa...)');
 });
 });

 describe('createLocalizedString', () => {
 describe('FR locale', () => {
 it('returns required error for empty string', () => {
 const schema = z.object({ name: createLocalizedString('fr', { min: 1 }) });
 const result = schema.safeParse({ name: '' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Ce champ est requis');
 }
 });

 it('returns tooShort error for string below minimum', () => {
 const schema = z.object({ name: createLocalizedString('fr', { min: 5 }) });
 const result = schema.safeParse({ name: 'ab' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Minimum 5 caractères (ex: aaaaa...)');
 }
 });

 it('returns tooLong error for string above maximum', () => {
 const schema = z.object({ name: createLocalizedString('fr', { max: 3 }) });
 const result = schema.safeParse({ name: 'toolong' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Maximum 3 caractères autorisés');
 }
 });

 it('creates optional schema when required is false', () => {
 const schema = z.object({ name: createLocalizedString('fr', { required: false }) });
 const result = schema.safeParse({});
 expect(result.success).toBe(true);
 });
 });

 describe('EN locale', () => {
 it('returns required error for empty string', () => {
 const schema = z.object({ name: createLocalizedString('en', { min: 1 }) });
 const result = schema.safeParse({ name: '' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('This field is required');
 }
 });

 it('returns tooShort error for string below minimum', () => {
 const schema = z.object({ name: createLocalizedString('en', { min: 5 }) });
 const result = schema.safeParse({ name: 'ab' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Minimum 5 characters (e.g., aaaaa...)');
 }
 });

 it('returns tooLong error for string above maximum', () => {
 const schema = z.object({ name: createLocalizedString('en', { max: 3 }) });
 const result = schema.safeParse({ name: 'toolong' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Maximum 3 characters allowed');
 }
 });
 });
 });

 describe('createLocalizedEmail', () => {
 it('returns FR error for invalid email', () => {
 const schema = z.object({ email: createLocalizedEmail('fr') });
 const result = schema.safeParse({ email: 'notanemail' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Format email invalide (ex: nom@entreprise.com)');
 }
 });

 it('returns EN error for invalid email', () => {
 const schema = z.object({ email: createLocalizedEmail('en') });
 const result = schema.safeParse({ email: 'notanemail' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Invalid email format (e.g., name@company.com)');
 }
 });

 it('creates optional schema when required is false', () => {
 const schema = z.object({ email: createLocalizedEmail('fr', false) });
 const result = schema.safeParse({});
 expect(result.success).toBe(true);
 });

 it('accepts valid email', () => {
 const schema = z.object({ email: createLocalizedEmail('fr') });
 const result = schema.safeParse({ email: 'test@example.com' });
 expect(result.success).toBe(true);
 });
 });

 describe('createLocalizedUrl', () => {
 it('returns FR error for invalid URL', () => {
 const schema = z.object({ website: createLocalizedUrl('fr') });
 const result = schema.safeParse({ website: 'notaurl' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('URL invalide (ex: https://exemple.com)');
 }
 });

 it('returns EN error for invalid URL', () => {
 const schema = z.object({ website: createLocalizedUrl('en') });
 const result = schema.safeParse({ website: 'notaurl' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Invalid URL (e.g., https://example.com)');
 }
 });

 it('accepts valid URL', () => {
 const schema = z.object({ website: createLocalizedUrl('en') });
 const result = schema.safeParse({ website: 'https://example.com' });
 expect(result.success).toBe(true);
 });
 });

 describe('createLocalizedNumber', () => {
 it('returns FR error for number below minimum', () => {
 const schema = z.object({ age: createLocalizedNumber('fr', { min: 18 }) });
 const result = schema.safeParse({ age: 10 });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Minimum 18 requis');
 }
 });

 it('returns EN error for number above maximum', () => {
 const schema = z.object({ quantity: createLocalizedNumber('en', { max: 100 }) });
 const result = schema.safeParse({ quantity: 150 });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Maximum 100 allowed');
 }
 });

 it('returns FR error for non-integer when integer required', () => {
 const schema = z.object({ count: createLocalizedNumber('fr', { integer: true }) });
 const result = schema.safeParse({ count: 10.5 });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Nombre entier requis (ex: 1, 2, 3)');
 }
 });

 it('returns FR error for non-positive when positive required', () => {
 const schema = z.object({ amount: createLocalizedNumber('fr', { positive: true }) });
 const result = schema.safeParse({ amount: -5 });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('La valeur doit être positive (> 0)');
 }
 });

 it('creates optional schema when required is false', () => {
 const schema = z.object({ age: createLocalizedNumber('fr', { required: false }) });
 const result = schema.safeParse({});
 expect(result.success).toBe(true);
 });
 });

 describe('createLocalizedArray', () => {
 it('returns FR error for array below minimum', () => {
 const schema = z.object({ tags: createLocalizedArray('fr', z.string(), { min: 2 }) });
 const result = schema.safeParse({ tags: ['one'] });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Sélectionnez au moins 2 éléments');
 }
 });

 it('returns EN error for array above maximum', () => {
 const schema = z.object({ tags: createLocalizedArray('en', z.string(), { max: 2 }) });
 const result = schema.safeParse({ tags: ['a', 'b', 'c', 'd'] });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Maximum 2 items allowed');
 }
 });

 it('handles singular form (1 item)', () => {
 const schema = z.object({ tags: createLocalizedArray('fr', z.string(), { min: 1 }) });
 const result = schema.safeParse({ tags: [] });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Sélectionnez au moins 1 élément');
 }
 });

 it('creates optional schema when required is false', () => {
 const schema = z.object({ tags: createLocalizedArray('fr', z.string(), { required: false }) });
 const result = schema.safeParse({});
 expect(result.success).toBe(true);
 });
 });

 describe('validateData', () => {
 const TestSchema = z.object({
 name: createLocalizedString('fr', { min: 3 }),
 email: createLocalizedEmail('fr'),
 });

 it('returns success with validated data for valid input', () => {
 const result = validateData(TestSchema, {
 name: 'John Doe',
 email: 'john@example.com',
 });

 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.data.name).toBe('John Doe');
 expect(result.data.email).toBe('john@example.com');
 }
 });

 it('returns errors for invalid input', () => {
 const result = validateData(TestSchema, {
 name: 'ab',
 email: 'invalid',
 });

 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.errors.length).toBe(2);

 const nameError = result.errors.find(e => e.path === 'name');
 expect(nameError?.message).toBe('Minimum 3 caractères (ex: aaa...)');

 const emailError = result.errors.find(e => e.path === 'email');
 expect(emailError?.message).toBe('Format email invalide (ex: nom@entreprise.com)');
 }
 });
 });

 describe('getErrorMessages', () => {
 const TestSchema = z.object({
 name: createLocalizedString('en', { min: 3 }),
 email: createLocalizedEmail('en'),
 });

 it('returns record of field paths to error messages', () => {
 const result = TestSchema.safeParse({ name: 'ab', email: 'invalid' });
 expect(result.success).toBe(false);
 if (!result.success) {
 const errors = getErrorMessages(result.error);
 expect(errors.name).toBe('Minimum 3 characters (e.g., aaa...)');
 expect(errors.email).toBe('Invalid email format (e.g., name@company.com)');
 }
 });

 it('handles nested paths', () => {
 const NestedSchema = z.object({
 user: z.object({
 profile: z.object({
 name: createLocalizedString('en', { min: 3 }),
 }),
 }),
 });

 const result = NestedSchema.safeParse({ user: { profile: { name: 'ab' } } });
 expect(result.success).toBe(false);
 if (!result.success) {
 const errors = getErrorMessages(result.error);
 expect(errors['user.profile.name']).toBe('Minimum 3 characters (e.g., aaa...)');
 }
 });
 });

 describe('hasValidationErrors', () => {
 const TestSchema = z.object({
 name: createLocalizedString('fr', { min: 3 }),
 });

 it('returns true for failed validation', () => {
 const result = validateData(TestSchema, { name: 'ab' });
 expect(hasValidationErrors(result)).toBe(true);
 });

 it('returns false for successful validation', () => {
 const result = validateData(TestSchema, { name: 'John' });
 expect(hasValidationErrors(result)).toBe(false);
 });
 });

 describe('createSchemaBuilder', () => {
 describe('FR locale', () => {
 const s = createSchemaBuilder('fr');

 it('exposes messages object', () => {
 expect(s.messages.required).toBe('Ce champ est requis');
 });

 it('creates localized string schema', () => {
 const schema = z.object({ name: s.string({ min: 3 }) });
 const result = schema.safeParse({ name: 'ab' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Minimum 3 caractères (ex: aaa...)');
 }
 });

 it('creates localized email schema', () => {
 const schema = z.object({ email: s.email() });
 const result = schema.safeParse({ email: 'invalid' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Format email invalide (ex: nom@entreprise.com)');
 }
 });

 it('creates localized number schema', () => {
 const schema = z.object({ age: s.number({ min: 18 }) });
 const result = schema.safeParse({ age: 10 });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Minimum 18 requis');
 }
 });

 it('creates localized array schema', () => {
 const schema = z.object({ tags: s.array(z.string(), { min: 2 }) });
 const result = schema.safeParse({ tags: ['one'] });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Sélectionnez au moins 2 éléments');
 }
 });
 });

 describe('EN locale', () => {
 const s = createSchemaBuilder('en');

 it('exposes messages object', () => {
 expect(s.messages.required).toBe('This field is required');
 });

 it('creates localized string schema', () => {
 const schema = z.object({ name: s.string({ min: 3 }) });
 const result = schema.safeParse({ name: 'ab' });
 expect(result.success).toBe(false);
 if (!result.success) {
 expect(result.error.issues[0].message).toBe('Minimum 3 characters (e.g., aaa...)');
 }
 });
 });
 });

 describe('edge cases', () => {
 it('handles min and max together', () => {
 const schema = z.object({ name: createLocalizedString('fr', { min: 3, max: 10 }) });

 const tooShort = schema.safeParse({ name: 'ab' });
 expect(tooShort.success).toBe(false);
 if (!tooShort.success) {
 expect(tooShort.error.issues[0].message).toBe('Minimum 3 caractères (ex: aaa...)');
 }

 const tooLong = schema.safeParse({ name: 'this is way too long' });
 expect(tooLong.success).toBe(false);
 if (!tooLong.success) {
 expect(tooLong.error.issues[0].message).toBe('Maximum 10 caractères autorisés');
 }

 const valid = schema.safeParse({ name: 'valid' });
 expect(valid.success).toBe(true);
 });

 it('handles number with multiple constraints', () => {
 const schema = z.object({
 value: createLocalizedNumber('en', { min: 1, max: 100, integer: true }),
 });

 const tooSmall = schema.safeParse({ value: 0 });
 expect(tooSmall.success).toBe(false);

 const tooBig = schema.safeParse({ value: 101 });
 expect(tooBig.success).toBe(false);

 const notInteger = schema.safeParse({ value: 50.5 });
 expect(notInteger.success).toBe(false);

 const valid = schema.safeParse({ value: 50 });
 expect(valid.success).toBe(true);
 });
 });
});
