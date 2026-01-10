# Story 1.2: Humanized Error Messages

Status: done

## Story

As a **user**,
I want **clear, humanized error messages in my language**,
So that **I understand what went wrong and how to fix it**.

## Acceptance Criteria

1. **Given** the user submits a form with validation errors
   **When** the validation fails
   **Then** error messages display in the user's language (FR/EN)

2. **Given** a validation error occurs
   **When** the error is displayed
   **Then** messages are human-readable (not technical jargon like "String must be at least 3 characters")

3. **Given** a validation error occurs
   **When** the error is displayed
   **Then** messages suggest how to fix the error (e.g., "Le nom doit contenir au moins 3 caractères")

4. **Given** a form field has an error
   **When** the error is shown
   **Then** the error message appears next to the relevant field

5. **Given** the user changes the language setting
   **When** validation errors are displayed
   **Then** the error messages update to the new language

## Tasks / Subtasks

- [x] **Task 1: Create zodErrorMap utility** (AC: 1, 2, 3)
  - [x] 1.1 Create `src/utils/zodErrorMap.ts` file
  - [x] 1.2 Implement schema factory functions (createLocalizedString, createLocalizedNumber, etc.)
  - [x] 1.3 Map Zod error codes to human-readable translations
  - [x] 1.4 Handle interpolation for min/max values
  - [x] 1.5 Create `createSchemaBuilder()` helper for dynamic locale

- [x] **Task 2: Enhance localeConfig zodMessages** (AC: 1, 2, 3)
  - [x] 2.1 Add comprehensive error message set (number, string, enum, array, etc.)
  - [x] 2.2 Ensure all messages are actionable and clear
  - [x] 2.3 Added 20+ message types for all common validation scenarios

- [x] **Task 3: Create useZodForm hook** (AC: 4, 5)
  - [x] 3.1 Create `src/hooks/useZodForm.ts`
  - [x] 3.2 Integrates with react-hook-form
  - [x] 3.3 Uses locale from useLocale() hook
  - Note: Existing UI components already handle error display (FloatingLabelInput, etc.)

- [x] **Task 4: Write unit tests** (AC: all)
  - [x] 4.1 Test error map generates FR messages
  - [x] 4.2 Test error map generates EN messages
  - [x] 4.3 Test interpolation works correctly
  - [x] 4.4 Test all Zod schema types are handled
  - [x] 40 tests, all passing

## Dev Notes

### Dependencies

**Story 1.1 Output Used:**
- `zodMessages` from `src/config/localeConfig.ts`
- `getZodMessages()` function
- `SupportedLocale` type

### Technical Approach

**Zod v4 Compatibility:**
Due to Zod v4.x API changes, we use schema factories instead of error maps:

```typescript
import { createSchemaBuilder } from '../utils/zodErrorMap';

function MyForm() {
  const { locale } = useLocale();
  const s = createSchemaBuilder(locale);

  const schema = z.object({
    name: s.string({ min: 3, max: 100 }),
    email: s.email(),
    age: s.number({ min: 18 }),
  });
}
```

### Integration with React Hook Form

```typescript
import { useZodForm } from '../hooks/useZodForm';

const form = useZodForm({
  schema: MySchema,
  defaultValues: { name: '', email: '' }
});
// Errors are already localized based on useLocale()
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- [x] zodErrorMap.ts créé et exporté (322 lines)
- [x] Messages d'erreur humanisés pour tous les types Zod (20+ types)
- [x] useZodForm hook créé pour intégration react-hook-form
- [x] Tests unitaires passent (40 tests, 100% pass rate)
- [x] Intégration avec localeConfig validée
- [x] Build successful

### Implementation Summary

**Messages ajoutés (localeConfig.ts):**
- Basic: required, invalidType
- String: invalidString, tooShort, tooLong, invalidEmail, invalidUrl, invalidUuid, invalidRegex
- Number: invalidNumber, notInteger, tooSmall, tooBig, notPositive, notNegative, notNonNegative
- Date: invalidDate
- Array: arrayTooShort, arrayTooLong
- Enum: invalidEnum
- Custom: custom

**Utilitaires créés (zodErrorMap.ts):**
- `getLocalizedMessages()` - Get raw message object
- `createLocalizedString()` - Localized string schema
- `createLocalizedEmail()` - Localized email schema
- `createLocalizedUrl()` - Localized URL schema
- `createLocalizedNumber()` - Localized number schema
- `createLocalizedArray()` - Localized array schema
- `validateData()` - Validate and get errors
- `getErrorMessages()` - Extract errors from ZodError
- `createSchemaBuilder()` - Factory for all schema types

### File List

**Files Created:**
- `src/utils/zodErrorMap.ts` (322 lines) - Localized Zod schema factories
- `src/hooks/useZodForm.ts` (83 lines) - React hook for localized forms
- `src/utils/__tests__/zodErrorMap.test.ts` (425 lines) - Comprehensive unit tests

**Files Modified:**
- `src/config/localeConfig.ts` - Enhanced zodMessages with 20+ message types

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: Error messages in user language | ✅ | Schema factories accept locale, messages in FR/EN |
| AC2: Human-readable messages | ✅ | "Minimum 3 caractères requis" not "String must be >= 3" |
| AC3: Actionable messages | ✅ | Messages explain expected format (e.g., "format attendu: JJ/MM/AAAA") |
| AC4: Error next to field | ✅ | Existing FloatingLabelInput handles this with `error` prop |
| AC5: Language change updates | ✅ | useZodForm uses useLocale(), re-renders on change |

### Integration Ready

This story provides utilities for:
- Story 1.3: Draft Mode (relaxed validation using optional schemas)
- Story 1.5: Live Validation (real-time localized feedback)
