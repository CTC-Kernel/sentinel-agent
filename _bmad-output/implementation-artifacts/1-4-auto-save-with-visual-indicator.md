# Story 1.4: Auto-save with Visual Indicator

Status: done

## Story

As a **user**,
I want **my work to be automatically saved**,
So that **I never lose data unexpectedly**.

## Acceptance Criteria

1. **Given** the user is editing a form
   **When** the user types and pauses for 30 seconds
   **Then** the form auto-saves with debouncing

2. **Given** the form is auto-saving
   **When** the save operation is in progress
   **Then** a visual indicator shows "Saving..." / "Enregistrement..."

3. **Given** the auto-save completes successfully
   **When** the operation finishes
   **Then** the indicator shows "Saved ✓" / "Enregistré ✓" with timestamp

4. **Given** auto-save fails
   **When** an error occurs during save
   **Then** an error indicator appears with retry option

5. **Given** the user has unsaved changes
   **When** they attempt to leave the page
   **Then** a confirmation dialog warns about losing changes

## Tasks / Subtasks

- [x] **Task 1: Create useAutoSave hook** (AC: 1, 2, 3, 4)
  - [x] 1.1 Create `src/hooks/useAutoSave.ts` file
  - [x] 1.2 Implement debounced save with 30-second default delay
  - [x] 1.3 Track save status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  - [x] 1.4 Expose lastSavedAt timestamp
  - [x] 1.5 Support configurable debounce delay
  - [x] 1.6 Handle save errors with retry capability

- [x] **Task 2: Create AutoSaveIndicator component** (AC: 2, 3, 4)
  - [x] 2.1 Create `src/components/ui/AutoSaveIndicator.tsx`
  - [x] 2.2 Implement status-based visual states (idle, pending, saving, saved, error)
  - [x] 2.3 Support FR/EN labels using localeConfig
  - [x] 2.4 Add animated spinner for saving state
  - [x] 2.5 Display relative timestamp for saved state ("Saved 2 min ago")
  - [x] 2.6 Add retry button for error state

- [x] **Task 3: Create useUnsavedChangesWarning hook** (AC: 5)
  - [x] 3.1 Create `src/hooks/useUnsavedChangesWarning.ts`
  - [x] 3.2 Implement beforeunload event listener
  - [x] 3.3 Integrate with React Router navigation blocking
  - [x] 3.4 Expose hasUnsavedChanges state
  - [x] 3.5 Support programmatic bypass for save-then-navigate flows

- [x] **Task 4: Write unit tests** (AC: all)
  - [x] 4.1 Test useAutoSave debounce behavior
  - [x] 4.2 Test useAutoSave status transitions
  - [x] 4.3 Test useAutoSave error handling and retry
  - [x] 4.4 Test AutoSaveIndicator renders for each status
  - [x] 4.5 Test AutoSaveIndicator locale support (FR/EN)
  - [x] 4.6 Test useUnsavedChangesWarning blocks navigation

### Review Follow-ups (AI)

- [ ] [LOW] Remove redundant aria-label on retry button in AutoSaveIndicator.tsx:187-188 (already has visible text)
- [ ] [LOW] Add memoization to formatRelativeTime function in AutoSaveIndicator.tsx for performance
- [ ] [LOW] Add JSDoc documentation to formatRelativeTime helper function

## Dev Notes

### Dependencies

**Story 1.1 Output Used:**
- `SupportedLocale` type from `src/config/localeConfig.ts`
- `useLocale()` hook for locale detection

**Story 1.2 Output Used:**
- Localized error messages for save failures

**Story 1.3 Output Used:**
- `useDraftMode` hook for draft/publish state integration
- `DRAFT_STATUS` constants for status values

### Technical Approach

**Architecture Reference (ADR-002):**
```typescript
// From architecture.md - ADR-002: Système Draft/Auto-save
// Auto-save every 30 seconds (debounced)
// Visual indicator "Saving..." / "Saved ✓"
// Confirmation before leaving with unsaved changes
```

**useAutoSave Hook:**
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from './useLocale';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseAutoSaveReturn {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  error: Error | null;
  save: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useAutoSave<T>(options: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  // Implementation with debounce and status tracking
}
```

**AutoSaveIndicator Component:**
```tsx
interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  error: Error | null;
  onRetry?: () => void;
  className?: string;
}

// Status → Visual mapping:
// idle: Hidden or very subtle
// pending: "Changes pending..." (grey text)
// saving: Spinner + "Saving..." / "Enregistrement..."
// saved: Checkmark + "Saved" + relative timestamp
// error: Error icon + "Save failed" + Retry button
```

**useUnsavedChangesWarning Hook:**
```typescript
import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

interface UseUnsavedChangesWarningOptions {
  hasUnsavedChanges: boolean;
  message?: string;
}

export function useUnsavedChangesWarning(options: UseUnsavedChangesWarningOptions) {
  // beforeunload for browser close/refresh
  // useBlocker for React Router navigation
}
```

### Localization Labels

```typescript
const labels = {
  fr: {
    saving: 'Enregistrement...',
    saved: 'Enregistré',
    error: 'Échec de l\'enregistrement',
    retry: 'Réessayer',
    pending: 'Modifications en attente...',
    unsavedWarning: 'Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir quitter?',
    justNow: 'À l\'instant',
    minutesAgo: 'il y a {n} min',
    hoursAgo: 'il y a {n}h',
  },
  en: {
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Save failed',
    retry: 'Retry',
    pending: 'Changes pending...',
    unsavedWarning: 'You have unsaved changes. Are you sure you want to leave?',
    justNow: 'Just now',
    minutesAgo: '{n} min ago',
    hoursAgo: '{n}h ago',
  },
};
```

### Integration with Story 1.3 (Draft Mode)

The auto-save hook should work with draft mode:
```typescript
// Usage in a form component
const { isDraft, saveAsDraft } = useDraftMode({ ... });
const { status, lastSavedAt } = useAutoSave({
  data: formData,
  onSave: isDraft ? saveAsDraft : publish,
  enabled: true,
  debounceMs: 30000,
});
```

### Status Transitions

```
Initial: idle
User types → pending (after first change)
30s debounce → saving
Save success → saved
Save error → error
User types again → pending (resets debounce)
```

### Performance Considerations

1. **Debounce Implementation**: Use a ref to track the latest data to avoid stale closures
2. **Cleanup**: Clear timeout on unmount to prevent memory leaks
3. **Skip Saves**: Don't save if data hasn't actually changed (deep equality check optional)
4. **Error Recovery**: Exponential backoff for retries (optional enhancement)

### File Structure

```
src/
├── hooks/
│   ├── useAutoSave.ts           # NEW
│   ├── useUnsavedChangesWarning.ts  # NEW
│   └── __tests__/
│       ├── useAutoSave.test.ts     # NEW
│       └── useUnsavedChangesWarning.test.ts  # NEW
├── components/
│   └── ui/
│       ├── AutoSaveIndicator.tsx    # NEW
│       └── __tests__/
│           └── AutoSaveIndicator.test.tsx  # NEW
```

## Estimation

**Complexity**: Medium
**Estimated Tasks**: 4 tasks, ~16 subtasks
**Testing Focus**: Status transitions, debounce timing, locale rendering, navigation blocking

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- **Task 1**: Implemented `useAutoSave` hook with debounced save (30s default), status tracking (idle/pending/saving/saved/error), lastSavedAt timestamp, configurable delay, and retry capability. 17 unit tests.
- **Task 2**: Created `AutoSaveIndicator` component with status-based visual states, FR/EN localization, animated spinner (Loader2), relative timestamps ("il y a 5 min"), and retry button. 28 unit tests.
- **Task 3**: Built `useUnsavedChangesWarning` hook integrating beforeunload event and React Router useBlocker, with bypass capability for save-then-navigate flows. 19 unit tests.
- **Task 4**: Comprehensive test coverage - 64 new tests total (17 + 28 + 19) covering debounce behavior, status transitions, error handling, locale support, and navigation blocking.

### File List

**Files Created:**
- `src/hooks/useAutoSave.ts` - Auto-save hook with debouncing
- `src/hooks/useUnsavedChangesWarning.ts` - Navigation warning hook
- `src/components/ui/AutoSaveIndicator.tsx` - Visual status indicator
- `src/hooks/__tests__/useUnsavedChangesWarning.test.ts` - Unit tests (19)
- `src/components/ui/__tests__/AutoSaveIndicator.test.tsx` - Unit tests (28)

**Files Modified:**
- `src/hooks/__tests__/useAutoSave.test.ts` - Unit tests (17) - updated existing test file

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: Auto-save with debouncing | Done | `useAutoSave` implements 30s debounce, triggers save on data change |
| AC2: Saving indicator | Done | `AutoSaveIndicator` shows "Enregistrement..."/"Saving..." with Loader2 spinner |
| AC3: Saved indicator with timestamp | Done | Shows "Enregistré"/"Saved" with relative time ("il y a 5 min"/"5 min ago") |
| AC4: Error indicator with retry | Done | Shows error state with RefreshCw icon and "Réessayer"/"Retry" button |
| AC5: Navigation warning | Done | `useUnsavedChangesWarning` uses beforeunload + useBlocker to warn on unsaved changes |

### Change Log

- 2026-01-10: Story implementation complete - all 4 tasks done, 64 new tests, 0 regressions in Story 1.4 tests
- 2026-01-10: Code Review fixes applied:
  - [HIGH-2] Added optional `isEqual` parameter to useAutoSave for custom equality checking
  - [MEDIUM-2] Removed redundant cleanup effect in useAutoSave
  - [MEDIUM-3] Added effect to reset status to 'idle' when enabled becomes false
  - [MEDIUM-4] Removed unnecessary React import from AutoSaveIndicator, converted to function syntax
  - [HIGH-1] Fixed File List documentation (useAutoSave.test.ts was modified, not created)
  - Added 3 LOW priority action items for future improvement
