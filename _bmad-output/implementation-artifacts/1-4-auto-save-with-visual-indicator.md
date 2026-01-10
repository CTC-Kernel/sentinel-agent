# Story 1.4: Auto-save with Visual Indicator

Status: ready-for-dev

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

- [ ] **Task 1: Create useAutoSave hook** (AC: 1, 2, 3, 4)
  - [ ] 1.1 Create `src/hooks/useAutoSave.ts` file
  - [ ] 1.2 Implement debounced save with 30-second default delay
  - [ ] 1.3 Track save status: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  - [ ] 1.4 Expose lastSavedAt timestamp
  - [ ] 1.5 Support configurable debounce delay
  - [ ] 1.6 Handle save errors with retry capability

- [ ] **Task 2: Create AutoSaveIndicator component** (AC: 2, 3, 4)
  - [ ] 2.1 Create `src/components/ui/AutoSaveIndicator.tsx`
  - [ ] 2.2 Implement status-based visual states (idle, pending, saving, saved, error)
  - [ ] 2.3 Support FR/EN labels using localeConfig
  - [ ] 2.4 Add animated spinner for saving state
  - [ ] 2.5 Display relative timestamp for saved state ("Saved 2 min ago")
  - [ ] 2.6 Add retry button for error state

- [ ] **Task 3: Create useUnsavedChangesWarning hook** (AC: 5)
  - [ ] 3.1 Create `src/hooks/useUnsavedChangesWarning.ts`
  - [ ] 3.2 Implement beforeunload event listener
  - [ ] 3.3 Integrate with React Router navigation blocking
  - [ ] 3.4 Expose hasUnsavedChanges state
  - [ ] 3.5 Support programmatic bypass for save-then-navigate flows

- [ ] **Task 4: Write unit tests** (AC: all)
  - [ ] 4.1 Test useAutoSave debounce behavior
  - [ ] 4.2 Test useAutoSave status transitions
  - [ ] 4.3 Test useAutoSave error handling and retry
  - [ ] 4.4 Test AutoSaveIndicator renders for each status
  - [ ] 4.5 Test AutoSaveIndicator locale support (FR/EN)
  - [ ] 4.6 Test useUnsavedChangesWarning blocks navigation

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
