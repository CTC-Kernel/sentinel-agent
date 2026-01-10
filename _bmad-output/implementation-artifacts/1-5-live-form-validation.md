# Story 1.5: Live Form Validation

Status: ready-for-dev

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

- [ ] **Task 1: Create useFieldValidation hook** (AC: 1, 5)
  - [ ] 1.1 Create `src/hooks/useFieldValidation.ts` file
  - [ ] 1.2 Implement validation on blur trigger
  - [ ] 1.3 Implement validation on delay trigger (configurable, default 500ms)
  - [ ] 1.4 Track validation state: 'idle' | 'validating' | 'valid' | 'invalid'
  - [ ] 1.5 Expose error message when invalid
  - [ ] 1.6 Support Zod schema integration for field-level validation

- [ ] **Task 2: Create ValidatedInput component** (AC: 2, 3, 5)
  - [ ] 2.1 Create `src/components/ui/ValidatedInput.tsx`
  - [ ] 2.2 Extend base Input component with validation state
  - [ ] 2.3 Display green checkmark (Check icon) when valid
  - [ ] 2.4 Display red error icon (AlertCircle) when invalid
  - [ ] 2.5 Display error message below field when invalid
  - [ ] 2.6 Support custom validation delay
  - [ ] 2.7 Apply visual styles: green border for valid, red border for invalid

- [ ] **Task 3: Create useFormValidation hook** (AC: 4)
  - [ ] 3.1 Create `src/hooks/useFormValidation.ts`
  - [ ] 3.2 Track overall form validity (all fields valid)
  - [ ] 3.3 Expose isFormValid boolean
  - [ ] 3.4 Expose touched fields tracking
  - [ ] 3.5 Support registering multiple field validators
  - [ ] 3.6 Provide validateAll() function for submit

- [ ] **Task 4: Write unit tests** (AC: all)
  - [ ] 4.1 Test useFieldValidation validation triggers (blur, delay)
  - [ ] 4.2 Test useFieldValidation state transitions
  - [ ] 4.3 Test ValidatedInput visual states (idle, valid, invalid)
  - [ ] 4.4 Test ValidatedInput error message display
  - [ ] 4.5 Test useFormValidation overall validity tracking
  - [ ] 4.6 Test integration with Zod schemas

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

(To be filled during implementation)

### Completion Notes List

(To be filled during implementation)

### File List

**Files Created:**
(To be filled during implementation)

**Files Modified:**
(To be filled during implementation)

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: Validation on blur/delay | Pending | |
| AC2: Green checkmark for valid | Pending | |
| AC3: Red error for invalid | Pending | |
| AC4: Submit button reflects validity | Pending | |
| AC5: No validation while typing | Pending | |

### Change Log

- 2026-01-10: Story created for implementation
