/**
 * Unit tests for draftSchema.ts (Story 1.3)
 *
 * Tests for createDraftSchema and related utilities.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  createDraftSchema,
  validateDraftOrFull,
  createDraftableSchemas,
  canSaveAsDraft,
  DRAFT_REQUIRED_FIELDS,
  DRAFT_STATUS,
} from '../draftSchema';

describe('draftSchema', () => {
  describe('createDraftSchema', () => {
    const fullSchema = z.object({
      title: z.string().min(3),
      description: z.string().min(10),
      priority: z.number().min(1).max(5),
      status: z.string(),
    });

    it('makes non-required fields optional', () => {
      const draftSchema = createDraftSchema(fullSchema, {
        requiredFields: ['title'],
        locale: 'fr',
      });

      // Only title required - should pass with just title
      const result = draftSchema.safeParse({ title: 'Test' });
      expect(result.success).toBe(true);
    });

    it('keeps specified required fields as required', () => {
      const draftSchema = createDraftSchema(fullSchema, {
        requiredFields: ['title'],
        locale: 'fr',
      });

      // Missing title - should fail
      const result = draftSchema.safeParse({ description: 'test' });
      expect(result.success).toBe(false);
    });

    it('validates required fields with localized error messages (FR)', () => {
      // Use a schema without pre-existing min constraint for clean test
      const simpleSchema = z.object({
        name: z.string(),
        description: z.string(),
      });

      const draftSchema = createDraftSchema(simpleSchema, {
        requiredFields: ['name'],
        locale: 'fr',
      });

      const result = draftSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Ce champ est requis');
      }
    });

    it('validates required fields with localized error messages (EN)', () => {
      const simpleSchema = z.object({
        name: z.string(),
        description: z.string(),
      });

      const draftSchema = createDraftSchema(simpleSchema, {
        requiredFields: ['name'],
        locale: 'en',
      });

      const result = draftSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('This field is required');
      }
    });

    it('defaults to FR locale when not specified', () => {
      const simpleSchema = z.object({
        name: z.string(),
        description: z.string(),
      });

      const draftSchema = createDraftSchema(simpleSchema, {
        requiredFields: ['name'],
      });

      const result = draftSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Ce champ est requis');
      }
    });

    it('handles multiple required fields', () => {
      const simpleSchema = z.object({
        title: z.string(),
        status: z.string(),
        description: z.string(),
      });

      const draftSchema = createDraftSchema(simpleSchema, {
        requiredFields: ['title', 'status'],
        locale: 'fr',
      });

      // Missing both required fields
      const result1 = draftSchema.safeParse({});
      expect(result1.success).toBe(false);

      // Has title but missing status
      const result2 = draftSchema.safeParse({ title: 'Test' });
      expect(result2.success).toBe(false);

      // Has both required fields
      const result3 = draftSchema.safeParse({ title: 'Test', status: 'Draft' });
      expect(result3.success).toBe(true);
    });

    it('handles already optional fields', () => {
      const schemaWithOptional = z.object({
        name: z.string(),
        nickname: z.string().optional(),
      });

      const draftSchema = createDraftSchema(schemaWithOptional, {
        requiredFields: ['name'],
        locale: 'fr',
      });

      // Should work - nickname is already optional
      const result = draftSchema.safeParse({ name: 'John' });
      expect(result.success).toBe(true);
    });

    it('handles nullable fields', () => {
      const schemaWithNullable = z.object({
        name: z.string(),
        deletedAt: z.date().nullable(),
      });

      const draftSchema = createDraftSchema(schemaWithNullable, {
        requiredFields: ['name'],
        locale: 'fr',
      });

      const result = draftSchema.safeParse({ name: 'Test' });
      expect(result.success).toBe(true);
    });

    it('handles fields with default values', () => {
      const schemaWithDefault = z.object({
        name: z.string(),
        count: z.number().default(0),
      });

      const draftSchema = createDraftSchema(schemaWithDefault, {
        requiredFields: ['name'],
        locale: 'fr',
      });

      const result = draftSchema.safeParse({ name: 'Test' });
      expect(result.success).toBe(true);
    });
  });

  describe('validateDraftOrFull', () => {
    const fullSchema = z.object({
      name: z.string().min(3),
      email: z.string().email(),
    });

    const draftSchema = createDraftSchema(fullSchema, {
      requiredFields: ['name'],
      locale: 'fr',
    });

    it('returns both validations for complete data', () => {
      const data = { name: 'John', email: 'john@example.com' };
      const result = validateDraftOrFull(fullSchema, draftSchema, data);

      expect(result.isValidForPublish).toBe(true);
      expect(result.isValidForDraft).toBe(true);
      expect(result.fullErrors).toBeNull();
      expect(result.draftErrors).toBeNull();
    });

    it('returns valid for draft but not publish when only required fields present', () => {
      const data = { name: 'John' };
      const result = validateDraftOrFull(fullSchema, draftSchema, data);

      expect(result.isValidForPublish).toBe(false);
      expect(result.isValidForDraft).toBe(true);
      expect(result.fullErrors).not.toBeNull();
      expect(result.draftErrors).toBeNull();
    });

    it('returns both invalid when missing required draft fields', () => {
      const data = { email: 'test@example.com' };
      const result = validateDraftOrFull(fullSchema, draftSchema, data);

      expect(result.isValidForPublish).toBe(false);
      expect(result.isValidForDraft).toBe(false);
      expect(result.fullErrors).not.toBeNull();
      expect(result.draftErrors).not.toBeNull();
    });
  });

  describe('createDraftableSchemas', () => {
    it('creates paired full and draft schemas', () => {
      const { fullSchema, draftSchema } = createDraftableSchemas(
        {
          title: z.string().min(3),
          description: z.string().min(10),
        },
        ['title'],
        'fr'
      );

      // Full schema requires all fields
      expect(fullSchema.safeParse({ title: 'Test' }).success).toBe(false);
      expect(
        fullSchema.safeParse({ title: 'Test', description: 'Long description' }).success
      ).toBe(true);

      // Draft schema only requires title (min(3) still applies from original schema)
      expect(draftSchema.safeParse({ title: 'Test' }).success).toBe(true);
    });

    it('defaults to FR locale', () => {
      // Use simple string schema without min constraint for clean localized error test
      const { draftSchema } = createDraftableSchemas(
        { name: z.string() },
        ['name']
      );

      const result = draftSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Ce champ est requis');
      }
    });
  });

  describe('canSaveAsDraft', () => {
    it('returns canSave true when all required fields present', () => {
      const result = canSaveAsDraft(
        { title: 'My Title', description: '' },
        ['title'],
        'fr'
      );

      expect(result.canSave).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('returns canSave false when required field is empty string', () => {
      const result = canSaveAsDraft(
        { title: '', description: 'test' },
        ['title'],
        'fr'
      );

      expect(result.canSave).toBe(false);
      expect(result.errors.title).toBe('Ce champ est requis');
    });

    it('returns canSave false when required field is whitespace only', () => {
      const result = canSaveAsDraft(
        { title: '   ', description: 'test' },
        ['title'],
        'fr'
      );

      expect(result.canSave).toBe(false);
      expect(result.errors.title).toBe('Ce champ est requis');
    });

    it('returns canSave false when required field is undefined', () => {
      const result = canSaveAsDraft(
        { description: 'test' },
        ['title'],
        'fr'
      );

      expect(result.canSave).toBe(false);
      expect(result.errors.title).toBe('Ce champ est requis');
    });

    it('returns canSave false when required field is null', () => {
      const result = canSaveAsDraft(
        { title: null, description: 'test' },
        ['title'],
        'fr'
      );

      expect(result.canSave).toBe(false);
      expect(result.errors.title).toBe('Ce champ est requis');
    });

    it('returns errors for multiple missing required fields', () => {
      const result = canSaveAsDraft(
        {},
        ['title', 'name'],
        'en'
      );

      expect(result.canSave).toBe(false);
      expect(result.errors.title).toBe('This field is required');
      expect(result.errors.name).toBe('This field is required');
    });

    it('uses FR locale by default', () => {
      const result = canSaveAsDraft({ title: '' }, ['title']);

      expect(result.errors.title).toBe('Ce champ est requis');
    });
  });

  describe('DRAFT_REQUIRED_FIELDS', () => {
    it('defines required fields for all entity types', () => {
      expect(DRAFT_REQUIRED_FIELDS.risk).toEqual(['threat']);
      expect(DRAFT_REQUIRED_FIELDS.asset).toEqual(['name']);
      expect(DRAFT_REQUIRED_FIELDS.document).toEqual(['title']);
      expect(DRAFT_REQUIRED_FIELDS.audit).toEqual(['name']);
      expect(DRAFT_REQUIRED_FIELDS.control).toEqual(['name']);
      expect(DRAFT_REQUIRED_FIELDS.incident).toEqual(['title']);
      expect(DRAFT_REQUIRED_FIELDS.project).toEqual(['name']);
      expect(DRAFT_REQUIRED_FIELDS.supplier).toEqual(['name']);
      expect(DRAFT_REQUIRED_FIELDS.assessment).toEqual(['name']);
    });
  });

  describe('DRAFT_STATUS', () => {
    it('defines correct status values for entity types', () => {
      expect(DRAFT_STATUS.document).toBe('Brouillon');
      expect(DRAFT_STATUS.audit).toBe('Draft');
      expect(DRAFT_STATUS.assessment).toBe('Draft');
      expect(DRAFT_STATUS.business).toBe('Draft');
    });
  });

  describe('nested object handling', () => {
    it('handles schemas with nested objects', () => {
      const schemaWithNested = z.object({
        name: z.string(),
        address: z.object({
          street: z.string(),
          city: z.string(),
        }),
      });

      const draftSchema = createDraftSchema(schemaWithNested, {
        requiredFields: ['name'],
        locale: 'fr',
      });

      // Should pass with name (non-empty) - address becomes optional
      const result = draftSchema.safeParse({ name: 'Test' });
      expect(result.success).toBe(true);
    });

    it('handles schemas with arrays', () => {
      const schemaWithArray = z.object({
        name: z.string(),
        tags: z.array(z.string()),
      });

      const draftSchema = createDraftSchema(schemaWithArray, {
        requiredFields: ['name'],
        locale: 'fr',
      });

      const result = draftSchema.safeParse({ name: 'Test' });
      expect(result.success).toBe(true);
    });
  });
});
