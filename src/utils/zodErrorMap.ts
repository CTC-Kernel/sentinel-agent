/**
 * Localized Zod Validation Utilities (Story 1.2)
 *
 * Provides locale-aware error messages for Zod schemas.
 * Compatible with Zod v4.x where schemas define their own messages.
 *
 * @module zodErrorMap
 */

import { z } from 'zod';
import {
  type SupportedLocale,
  type ZodMessages,
  getZodMessages,
} from '../config/localeConfig';

/**
 * Get the localized error messages object for a given locale.
 * Use these messages when defining Zod schemas.
 *
 * @param locale - The locale for messages ('fr' or 'en')
 * @returns Object containing all localized error messages
 *
 * @example
 * ```typescript
 * const msg = getLocalizedMessages('fr');
 * const schema = z.object({
 *   name: z.string().min(3, msg.tooShort(3)),
 *   email: z.string().email(msg.invalidEmail),
 * });
 * ```
 */
export function getLocalizedMessages(locale: SupportedLocale): ZodMessages {
  return getZodMessages(locale);
}

/**
 * Creates a Zod error map for use with @hookform/resolvers/zod.
 * This provides fallback messages for schemas that don't define their own.
 *
 * @param locale - The locale for error messages
 * @returns A Zod error map function
 *
 * @example
 * ```typescript
 * const errorMap = createLocalizedErrorMap('fr');
 * const form = useForm({
 *   resolver: zodResolver(schema, { errorMap }),
 * });
 * ```
 */
export function createLocalizedErrorMap(locale: SupportedLocale): z.ZodErrorMap {
  const messages = getZodMessages(locale);

  return (issue, ctx) => {
    // Handle specific error codes with localized messages
    switch (issue.code) {
      case z.ZodIssueCode.invalid_type:
        if (issue.received === 'undefined' || issue.received === 'null') {
          return { message: messages.required };
        }
        if (issue.expected === 'string') {
          return { message: messages.invalidString };
        }
        if (issue.expected === 'number') {
          return { message: messages.invalidNumber };
        }
        return { message: messages.invalidType };

      case z.ZodIssueCode.too_small:
        if (issue.type === 'string') {
          if (issue.minimum === 1) {
            return { message: messages.required };
          }
          return { message: messages.tooShort(Number(issue.minimum)) };
        }
        if (issue.type === 'number') {
          return { message: messages.tooSmall(Number(issue.minimum)) };
        }
        if (issue.type === 'array') {
          return { message: messages.arrayTooShort(Number(issue.minimum)) };
        }
        break;

      case z.ZodIssueCode.too_big:
        if (issue.type === 'string') {
          return { message: messages.tooLong(Number(issue.maximum)) };
        }
        if (issue.type === 'number') {
          return { message: messages.tooBig(Number(issue.maximum)) };
        }
        if (issue.type === 'array') {
          return { message: messages.arrayTooLong(Number(issue.maximum)) };
        }
        break;

      case z.ZodIssueCode.invalid_string:
        if (issue.validation === 'email') {
          return { message: messages.invalidEmail };
        }
        if (issue.validation === 'url') {
          return { message: messages.invalidUrl };
        }
        if (issue.validation === 'uuid') {
          return { message: messages.invalidUuid };
        }
        if (issue.validation === 'regex') {
          return { message: messages.invalidRegex };
        }
        return { message: messages.invalidString };

      case z.ZodIssueCode.invalid_date:
        return { message: messages.invalidDate };

      case z.ZodIssueCode.invalid_enum_value:
        return { message: messages.invalidEnum(issue.options as string[]) };

      case z.ZodIssueCode.custom:
        return { message: issue.message || messages.custom };
    }

    // Fall back to default message
    return { message: ctx.defaultError };
  };
}

/**
 * Creates a locale-aware string schema with common validations
 */
export function createLocalizedString(
  locale: SupportedLocale,
  options?: {
    min?: number;
    max?: number;
    required?: boolean;
  }
): z.ZodString | z.ZodOptional<z.ZodString> {
  const messages = getZodMessages(locale);
  const { min, max, required = true } = options ?? {};

  let schema = z.string({
    required_error: messages.required,
    invalid_type_error: messages.invalidString,
  });

  if (min !== undefined) {
    schema = schema.min(min, min === 1 ? messages.required : messages.tooShort(min));
  }

  if (max !== undefined) {
    schema = schema.max(max, messages.tooLong(max));
  }

  if (!required) {
    return schema.optional();
  }

  return schema;
}

/**
 * Creates a locale-aware email schema
 */
export function createLocalizedEmail(
  locale: SupportedLocale,
  required = true
): z.ZodString | z.ZodOptional<z.ZodString> {
  const messages = getZodMessages(locale);

  const schema = z.string({
    required_error: messages.required,
  }).email(messages.invalidEmail);

  if (!required) {
    return schema.optional();
  }

  return schema;
}

/**
 * Creates a locale-aware URL schema
 */
export function createLocalizedUrl(
  locale: SupportedLocale,
  required = true
): z.ZodString | z.ZodOptional<z.ZodString> {
  const messages = getZodMessages(locale);

  const schema = z.string({
    required_error: messages.required,
  }).url(messages.invalidUrl);

  if (!required) {
    return schema.optional();
  }

  return schema;
}

/**
 * Creates a locale-aware number schema
 */
export function createLocalizedNumber(
  locale: SupportedLocale,
  options?: {
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
    required?: boolean;
  }
): z.ZodNumber | z.ZodOptional<z.ZodNumber> {
  const messages = getZodMessages(locale);
  const { min, max, integer, positive, required = true } = options ?? {};

  let schema = z.number({
    required_error: messages.required,
    invalid_type_error: messages.invalidNumber,
  });

  if (integer) {
    schema = schema.int(messages.notInteger);
  }

  if (positive) {
    schema = schema.positive(messages.notPositive);
  }

  if (min !== undefined) {
    schema = schema.min(min, messages.tooSmall(min));
  }

  if (max !== undefined) {
    schema = schema.max(max, messages.tooBig(max));
  }

  if (!required) {
    return schema.optional();
  }

  return schema;
}

/**
 * Creates a locale-aware array schema
 */
export function createLocalizedArray<T extends z.ZodTypeAny>(
  locale: SupportedLocale,
  itemSchema: T,
  options?: {
    min?: number;
    max?: number;
    required?: boolean;
  }
): z.ZodArray<T> | z.ZodOptional<z.ZodArray<T>> {
  const messages = getZodMessages(locale);
  const { min, max, required = true } = options ?? {};

  let schema = z.array(itemSchema);

  if (min !== undefined) {
    schema = schema.min(min, messages.arrayTooShort(min));
  }

  if (max !== undefined) {
    schema = schema.max(max, messages.arrayTooLong(max));
  }

  if (!required) {
    return schema.optional();
  }

  return schema;
}

/**
 * Validates data with a Zod schema and returns localized error messages.
 *
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Object with success status and either data or errors
 *
 * @example
 * ```typescript
 * const result = validateData(UserSchema, formData);
 * if (result.success) {
 *   // result.data is the validated data
 * } else {
 *   // result.errors is an array of { path, message }
 * }
 * ```
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): {
  success: true;
  data: T;
} | {
  success: false;
  errors: Array<{ path: string; message: string }>;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Extracts error messages from a Zod error as a record.
 *
 * @param error - The Zod error object
 * @returns Record of field paths to error messages
 *
 * @example
 * ```typescript
 * try {
 *   schema.parse(data);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     const errors = getErrorMessages(error);
 *     // { "name": "Ce champ est requis", "email": "Adresse email invalide" }
 *   }
 * }
 * ```
 */
export function getErrorMessages(
  error: z.ZodError
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    errors[path] = issue.message;
  }

  return errors;
}

/**
 * Type guard for checking if a result has errors
 */
export function hasValidationErrors<T>(
  result: { success: true; data: T } | { success: false; errors: Array<{ path: string; message: string }> }
): result is { success: false; errors: Array<{ path: string; message: string }> } {
  return !result.success;
}

/**
 * Schema builder that provides localized schema factories.
 * Use this in components with dynamic locale.
 *
 * @param locale - The locale for error messages
 * @returns Object with factory functions for creating localized schemas
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const { locale } = useLocale();
 *   const s = createSchemaBuilder(locale);
 *
 *   const schema = z.object({
 *     name: s.string({ min: 3, max: 100 }),
 *     email: s.email(),
 *     age: s.number({ min: 18 }),
 *   });
 * }
 * ```
 */
export function createSchemaBuilder(locale: SupportedLocale) {
  const messages = getZodMessages(locale);

  return {
    /** Get raw messages object */
    messages,

    /** Create a localized string schema */
    string: (options?: { min?: number; max?: number; required?: boolean }) =>
      createLocalizedString(locale, options),

    /** Create a localized email schema */
    email: (required = true) => createLocalizedEmail(locale, required),

    /** Create a localized URL schema */
    url: (required = true) => createLocalizedUrl(locale, required),

    /** Create a localized number schema */
    number: (options?: {
      min?: number;
      max?: number;
      integer?: boolean;
      positive?: boolean;
      required?: boolean;
    }) => createLocalizedNumber(locale, options),

    /** Create a localized array schema */
    array: <T extends z.ZodTypeAny>(
      itemSchema: T,
      options?: { min?: number; max?: number; required?: boolean }
    ) => createLocalizedArray(locale, itemSchema, options),
  };
}
