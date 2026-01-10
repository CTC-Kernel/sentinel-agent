/**
 * Draft Schema Utilities (Story 1.3)
 *
 * Provides utilities for creating relaxed validation schemas for draft mode.
 * When saving as draft, only specified fields are required (typically title/name).
 *
 * @module draftSchema
 */

import { z } from 'zod';
import {
  type SupportedLocale,
  getZodMessages,
} from '../config/localeConfig';

/**
 * Options for creating a draft schema
 */
export interface DraftSchemaOptions {
  /** Fields that remain required even in draft mode */
  requiredFields: string[];
  /** Locale for error messages */
  locale?: SupportedLocale;
}

/**
 * Creates a draft version of a Zod object schema where only specified fields are required.
 * All other fields become optional, allowing partial form saves.
 *
 * @param schema - The original full validation schema
 * @param options - Configuration for draft mode
 * @returns A new schema with relaxed validation
 *
 * @example
 * ```typescript
 * const fullRiskSchema = z.object({
 *   threat: z.string().min(3),
 *   vulnerability: z.string().min(3),
 *   probability: z.number().min(1).max(5),
 *   impact: z.number().min(1).max(5),
 * });
 *
 * // Only 'threat' is required in draft mode
 * const draftRiskSchema = createDraftSchema(fullRiskSchema, {
 *   requiredFields: ['threat'],
 *   locale: 'fr',
 * });
 * ```
 */
export function createDraftSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  options: DraftSchemaOptions
): z.ZodObject<{
  [K in keyof T]: K extends (typeof options.requiredFields)[number]
    ? T[K]
    : z.ZodOptional<T[K]>;
}> {
  const { requiredFields, locale = 'fr' } = options;
  const messages = getZodMessages(locale);
  const shape = schema.shape;
  const newShape: Record<string, z.ZodTypeAny> = {};

  for (const key of Object.keys(shape) as (keyof T)[]) {
    const fieldSchema = shape[key];
    const keyStr = String(key);

    if (requiredFields.includes(keyStr)) {
      // Keep required fields as-is, but ensure they have localized error message
      newShape[keyStr] = wrapWithLocalizedRequired(fieldSchema, messages.required);
    } else {
      // Make non-required fields optional
      newShape[keyStr] = makeOptional(fieldSchema);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return z.object(newShape) as any;
}

/**
 * Makes a Zod schema optional, handling already-optional schemas.
 */
function makeOptional<T extends z.ZodTypeAny>(schema: T): z.ZodOptional<T> | T {
  // Check if already optional
  if (schema instanceof z.ZodOptional) {
    return schema;
  }

  // Handle nullable schemas
  if (schema instanceof z.ZodNullable) {
    return schema.optional();
  }

  // Handle default schemas - make the inner type optional
  if (schema instanceof z.ZodDefault) {
    return schema._def.innerType.optional();
  }

  return schema.optional();
}

/**
 * Wraps a schema to ensure it has a localized required error message.
 */
function wrapWithLocalizedRequired<T extends z.ZodTypeAny>(
  schema: T,
  requiredMessage: string
): T {
  // For string schemas, ensure min(1) validation for "required"
  if (schema instanceof z.ZodString) {
    // Check if there's already a min constraint
    const checks = schema._def.checks;
    const hasMinCheck = checks.some(
      (check: { kind: string }) => check.kind === 'min'
    );

    if (!hasMinCheck) {
      // Add min(1) with localized message
      return schema.min(1, requiredMessage) as T;
    }
  }

  return schema;
}

/**
 * Validates data against both draft and full schemas.
 * Returns which validation mode should be used.
 *
 * @param fullSchema - The complete validation schema
 * @param draftSchema - The relaxed draft schema
 * @param data - The data to validate
 * @returns Object indicating validity for each mode
 */
export function validateDraftOrFull<TFull, TDraft>(
  fullSchema: z.ZodSchema<TFull>,
  draftSchema: z.ZodSchema<TDraft>,
  data: unknown
): {
  isValidForPublish: boolean;
  isValidForDraft: boolean;
  fullErrors: z.ZodError | null;
  draftErrors: z.ZodError | null;
} {
  const fullResult = fullSchema.safeParse(data);
  const draftResult = draftSchema.safeParse(data);

  return {
    isValidForPublish: fullResult.success,
    isValidForDraft: draftResult.success,
    fullErrors: fullResult.success ? null : fullResult.error,
    draftErrors: draftResult.success ? null : draftResult.error,
  };
}

/**
 * Creates paired full and draft schemas from a base schema definition.
 * This is a convenience function for forms that support draft mode.
 *
 * @param baseShape - The Zod object shape
 * @param draftRequiredFields - Fields that remain required in draft mode
 * @param locale - Locale for error messages
 * @returns Object with fullSchema and draftSchema
 *
 * @example
 * ```typescript
 * const { fullSchema, draftSchema } = createDraftableSchemas(
 *   {
 *     title: z.string().min(3),
 *     description: z.string().min(10),
 *     priority: z.number(),
 *   },
 *   ['title'],
 *   'fr'
 * );
 * ```
 */
export function createDraftableSchemas<T extends z.ZodRawShape>(
  baseShape: T,
  draftRequiredFields: (keyof T)[],
  locale: SupportedLocale = 'fr'
): {
  fullSchema: z.ZodObject<T>;
  draftSchema: z.ZodObject<{
    [K in keyof T]: K extends (typeof draftRequiredFields)[number]
      ? T[K]
      : z.ZodOptional<T[K]>;
  }>;
} {
  const fullSchema = z.object(baseShape);
  const draftSchema = createDraftSchema(fullSchema, {
    requiredFields: draftRequiredFields as string[],
    locale,
  });

  return { fullSchema, draftSchema };
}

/**
 * Type helper to infer draft schema type from a full schema.
 * Makes all fields optional except those specified.
 */
export type DraftSchemaType<
  T extends z.ZodRawShape,
  RequiredKeys extends keyof T
> = z.ZodObject<{
  [K in keyof T]: K extends RequiredKeys ? T[K] : z.ZodOptional<T[K]>;
}>;

/**
 * Type helper to infer the data type from a draft schema.
 */
export type DraftDataType<
  T extends z.ZodRawShape,
  RequiredKeys extends keyof T
> = z.infer<DraftSchemaType<T, RequiredKeys>>;

/**
 * Determines if data can be saved as draft based on required fields.
 *
 * @param data - The form data to check
 * @param requiredFields - Fields that must be present for draft save
 * @param locale - Locale for error messages
 * @returns Object with canSave boolean and any error messages
 */
export function canSaveAsDraft(
  data: Record<string, unknown>,
  requiredFields: string[],
  locale: SupportedLocale = 'fr'
): {
  canSave: boolean;
  errors: Record<string, string>;
} {
  const messages = getZodMessages(locale);
  const errors: Record<string, string> = {};

  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      errors[field] = messages.required;
    } else if (typeof value === 'string' && value.trim().length === 0) {
      errors[field] = messages.required;
    }
  }

  return {
    canSave: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Default required fields for common entity types in draft mode.
 * These represent the minimum fields needed to identify a draft.
 */
export const DRAFT_REQUIRED_FIELDS = {
  risk: ['threat'],
  asset: ['name'],
  document: ['title'],
  audit: ['name'],
  control: ['name'],
  incident: ['title'],
  project: ['name'],
  supplier: ['name'],
  assessment: ['name'],
} as const;

/**
 * Status values used for draft entities in the codebase.
 * Different entity types use different status conventions.
 */
export const DRAFT_STATUS = {
  /** French draft status for documents */
  document: 'Brouillon',
  /** English draft status for audits/questionnaires */
  audit: 'Draft',
  /** English draft status for assessments */
  assessment: 'Draft',
  /** English draft status for business entities */
  business: 'Draft',
} as const;
