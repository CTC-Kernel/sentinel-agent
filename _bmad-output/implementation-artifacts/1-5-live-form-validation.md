# Story 1.5: Live Form Validation

Status: done

## Story

As a **user**,
I want **to see validation feedback as I type**,
So that **I can correct errors immediately**.

## Acceptance Criteria

1. **Given** the user is filling out a form field
   **When** the user finishes typing (on blur or after delay)
   **Then** validation runs immediately

2. **Given** a form field passes validation
   **When** validation completes
   **Then** a green checkmark appears next to the field

3. **Given** a form field fails validation
   **When** validation completes
   **Then** a red error indicator and message appear

4. **Given** the form has validation state
   **When** the user views the submit button
   **Then** the button state reflects overall form validity (enabled/disabled)

5. **Given** the user is typing in a field
   **When** they haven't finished (no blur, delay not elapsed)
   **Then** validation does not run (to avoid interruption)

## Tasks / Subtasks

- [x] **Task 1: Create useFieldValidation hook** (AC: 1, 5)
  - [x] 1.1 Create `src/hooks/useFieldValidation.ts` file
  - [x] 1.2 Implement validation on blur trigger
  - [x] 1.3 Implement validation on delay trigger (configurable, default 500ms)
  - [x] 1.4 Track validation state: 'idle' | 'valid' | 'invalid' (validating removed - sync validation)
  - [x] 1.5 Expose error message when invalid
  - [x] 1.6 Support Zod schema integration for field-level validation

- [x] **Task 2: Create ValidatedInput component** (AC: 2, 3, 5)
  - [x] 2.1 Create `src/components/ui/ValidatedInput.tsx`
  - [x] 2.2 Extend base Input component with validation state
  - [x] 2.3 Display green checkmark (Check icon) when valid
  - [x] 2.4 Display red error icon (AlertCircle) when invalid
  - [x] 2.5 Display error message below field when invalid
  - [x] 2.6 Support custom validation delay
  - [x] 2.7 Apply visual styles: green border for valid, red border for invalid

- [x] **Task 3: Create useFormValidationState hook** (AC: 4)
  - [x] 3.1 Extended `src/hooks/useFormValidation.ts` with new hook
  - [x] 3.2 Track overall form validity (all fields valid)
  - [x] 3.3 Expose isFormValid boolean
  - [x] 3.4 Expose touched fields tracking
  - [x] 3.5 Support registering multiple field validators
  - [x] 3.6 Provide validateAll() function for submit

- [x] **Task 4: Write unit tests** (AC: all)
  - [x] 4.1 Test useFieldValidation validation triggers (blur, delay)
  - [x] 4.2 Test useFieldValidation state transitions
  - [x] 4.3 Test ValidatedInput visual states (idle, valid, invalid)
  - [x] 4.4 Test ValidatedInput error message display
  - [x] 4.5 Test useFormValidationState overall validity tracking
  - [x] 4.6 Test integration with Zod schemas

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Test file description mismatch - Comment says "useFormValidation" but tests "useFormValidationState" `useFormValidation.test.ts:2-4`
- [ ] [AI-Review][LOW] Missing aria-live on validation icons - Add `aria-live="polite"` to icon container for accessibility `ValidatedInput.tsx:228`
- [ ] [AI-Review][LOW] No cleanup/unregister pattern - When ValidatedInput unmounts, consider unregistering from useFormValidationState

## Dev Notes

### Dependencies

**Story 1.1 Output Used:**
- `SupportedLocale` type from `src/config/localeConfig.ts`
- `useLocale()` hook for locale-aware error messages
- Zod error map for localized validation messages

**Story 1.2 Output Used:**
- Humanized error messages from `src/utils/zodErrorMap.ts`

### Technical Approach

**Architecture Reference (ADR-001, ADR-002):**
```typescript
// Live validation should use locale-aware Zod schemas
// Integration with existing form patterns
```

**useFieldValidation Hook:**
```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { z } from 'zod';

export type FieldValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

interface UseFieldValidationOptions<T> {
  /** Zod schema for field validation */
  schema: z.ZodType<T>;
  /** Validation trigger mode */
  trigger?: 'blur' | 'delay' | 'both';
  /** Delay in ms for delay trigger (default: 500) */
  delayMs?: number;
  /** Initial value */
  initialValue?: T;
}

interface UseFieldValidationReturn<T> {
  /** Current validation state */
  state: FieldValidationState;
  /** Current field value */
  value: T | undefined;
  /** Error message if invalid */
  error: string | null;
  /** Set field value */
  setValue: (value: T) => void;
  /** Trigger validation manually */
  validate: () => Promise<boolean>;
  /** Handle blur event */
  onBlur: () => void;
  /** Reset to initial state */
  reset: () => void;
}

export function useFieldValidation<T>(options: UseFieldValidationOptions<T>): UseFieldValidationReturn<T> {
  // Implementation with debounced validation
}
```

**ValidatedInput Component:**
```tsx
interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Zod schema for validation */
  schema?: z.ZodType<string>;
  /** Validation trigger mode */
  trigger?: 'blur' | 'delay' | 'both';
  /** Delay in ms for delay trigger */
  delayMs?: number;
  /** Label for the input */
  label?: string;
  /** Whether field is required */
  required?: boolean;
  /** External error message (for server-side errors) */
  externalError?: string;
}

// Visual states:
// idle: Normal input, no indicator
// validating: Subtle spinner (optional)
// valid: Green border + Check icon
// invalid: Red border + AlertCircle icon + error message below
```

**useFormValidation Hook:**
```typescript
interface UseFormValidationOptions {
  /** Form-level Zod schema (optional) */
  schema?: z.ZodObject<any>;
  /** Validation mode */
  mode?: 'onChange' | 'onBlur' | 'onSubmit';
}

interface UseFormValidationReturn {
  /** Whether all fields are valid */
  isFormValid: boolean;
  /** Register a field for validation tracking */
  registerField: (name: string, validate: () => Promise<boolean>) => void;
  /** Unregister a field */
  unregisterField: (name: string) => void;
  /** Validate all registered fields */
  validateAll: () => Promise<boolean>;
  /** Get validation state for a specific field */
  getFieldState: (name: string) => FieldValidationState;
  /** Reset all field states */
  reset: () => void;
}
```

### Localization Labels

```typescript
const labels = {
  fr: {
    required: 'Ce champ est requis',
    invalid: 'Valeur invalide',
    validating: 'Validation en cours...',
  },
  en: {
    required: 'This field is required',
    invalid: 'Invalid value',
    validating: 'Validating...',
  },
};
```

### Visual Design

**Valid State:**
- Border: `border-emerald-500`
- Icon: Check (lucide-react) in emerald-500
- Position: Icon inside input on the right

**Invalid State:**
- Border: `border-rose-500`
- Icon: AlertCircle (lucide-react) in rose-500
- Error message: Below input in `text-rose-600 text-sm`

**Idle State:**
- Border: Default input border
- No icon

### Integration Pattern

```tsx
// Example usage in a form
function RiskForm() {
  const { isFormValid, registerField, validateAll } = useFormValidation();

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (await validateAll()) {
        // Submit form
      }
    }}>
      <ValidatedInput
        name="title"
        label="Title"
        schema={z.string().min(3)}
        trigger="blur"
        required
      />

      <ValidatedInput
        name="description"
        label="Description"
        schema={z.string().max(500)}
        trigger="delay"
        delayMs={300}
      />

      <button
        type="submit"
        disabled={!isFormValid}
        className={isFormValid ? 'btn-primary' : 'btn-disabled'}
      >
        Submit
      </button>
    </form>
  );
}
```

### Performance Considerations

1. **Debounce for Delay Mode**: Prevent validation spam during typing
2. **Abort Previous Validation**: Cancel pending async validations on new input
3. **Memoize Schema**: Avoid recreating Zod schemas on each render
4. **Lazy Icon Loading**: Icons should be tree-shakeable

### File Structure

```
src/
├── hooks/
│   ├── useFieldValidation.ts        # NEW
│   ├── useFormValidation.ts         # NEW
│   └── __tests__/
│       ├── useFieldValidation.test.ts   # NEW
│       └── useFormValidation.test.ts    # NEW
├── components/
│   └── ui/
│       ├── ValidatedInput.tsx       # NEW
│       └── __tests__/
│           └── ValidatedInput.test.tsx  # NEW
```

## Estimation

**Complexity**: Medium
**Estimated Tasks**: 4 tasks, ~22 subtasks
**Testing Focus**: Validation triggers, state transitions, visual states, form-level validity

## Dev Agent Record

### Agent Model Used

claude-opus-4-5-20251101

### Completion Notes List

1. **useFieldValidation hook**: Implemented with blur and delay triggers, synchronous Zod validation using `safeParse`, debounced validation for delay mode, and full TypeScript generics support.

2. **ValidatedInput component**: Created using `forwardRef` pattern, integrates with useFieldValidation, displays Check/AlertCircle icons from existing Icons.tsx, supports external error messages for server-side validation.

3. **useFormValidationState hook**: Added to existing `useFormValidation.ts` file to preserve backward compatibility. Original hook handles form data + rules, new hook tracks validation states from ValidatedInput components.

4. **Technical decisions**:
   - Used synchronous `safeParse` instead of `parseAsync` for better compatibility with fake timers in tests
   - Used Zod v4 syntax (`result.error.issues` instead of `err.errors`)
   - Stored form validity as React state (not computed during render) to satisfy `react-hooks/refs` lint rule

5. **Code Review Fixes (2026-01-10)**:
   - Removed unused 'validating' state from FieldValidationState type (sync validation doesn't need it)
   - Removed unused `useLocale()` call from ValidatedInput
   - Added controlled mode support to ValidatedInput (value prop now works)
   - Added integration tests for ValidatedInput + form validation pattern
   - Added useMemo for schema to prevent unnecessary re-renders

### File List

**Files Created:**
- `src/hooks/useFieldValidation.ts` - Field-level validation hook with blur/delay triggers
- `src/hooks/__tests__/useFieldValidation.test.ts` - 16 unit tests for useFieldValidation
- `src/components/ui/ValidatedInput.tsx` - Validated input component with visual feedback
- `src/components/ui/__tests__/ValidatedInput.test.tsx` - 22 unit tests for ValidatedInput

**Files Modified:**
- `src/hooks/useFormValidation.ts` - Extended with useFormValidationState hook
- `src/hooks/__tests__/useFormValidation.test.ts` - 18 unit tests for useFormValidationState

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: Validation on blur/delay | ✅ Passed | useFieldValidation supports 'blur', 'delay', and 'both' triggers. Tests verify validation fires on blur and after delay. |
| AC2: Green checkmark for valid | ✅ Passed | ValidatedInput displays Check icon in emerald-500 and applies border-emerald-500 when valid. |
| AC3: Red error for invalid | ✅ Passed | ValidatedInput displays AlertCircle icon in rose-500, border-rose-500, and error message with role="alert". |
| AC4: Submit button reflects validity | ✅ Passed | useFormValidationState provides isFormValid boolean that updates when field states change. |
| AC5: No validation while typing | ✅ Passed | Validation only runs on blur or after delay (configurable via delayMs), not on every keystroke. |

### Test Summary

- **useFieldValidation**: 16 tests passed
- **ValidatedInput**: 26 tests passed (4 new integration tests added)
- **useFormValidationState**: 18 tests passed
- **Total**: 60 tests passed

### Change Log

- 2026-01-10: Story created for implementation
- 2026-01-10: Implementation completed - all 4 tasks done, 56 tests passing, build successful
- 2026-01-10: Code review completed - 2 HIGH, 4 MEDIUM issues fixed, 3 LOW action items created, 60 tests passing
