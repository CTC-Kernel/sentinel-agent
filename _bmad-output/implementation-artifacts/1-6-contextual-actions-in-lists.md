# Story 1.6: Contextual Actions in Lists

Status: done

## Story

As a **user**,
I want **to perform actions directly from list views**,
So that **I can work more efficiently without navigating to detail pages**.

## Acceptance Criteria

1. **Given** the user views a list of entities (Risks, Assets, Actions, etc.)
   **When** the user hovers or clicks on a row
   **Then** contextual action buttons appear (Edit, Delete, Duplicate, etc.)

2. **Given** the user views a row with contextual actions
   **When** clicking Edit
   **Then** the edit form opens with the entity's data

3. **Given** the user views a row with contextual actions
   **When** clicking Delete
   **Then** a confirmation dialog appears with the entity name
   **And** confirming deletes the entity

4. **Given** the user views a row with contextual actions
   **When** clicking Duplicate
   **Then** a copy of the entity is created with "(Copie)" suffix in French
   **And** user is notified of successful duplication
   **And** the new item appears in the list

5. **Given** the user does not have edit permissions
   **When** viewing a list row
   **Then** only view-related actions are shown (not Edit, Delete, Duplicate)

## Tasks / Subtasks

- [x] **Task 1: Create RowActionsMenu component** (AC: 1, 5)
  - [x] 1.1 Create `src/components/ui/RowActionsMenu.tsx` using Headless UI Menu
  - [x] 1.2 Implement three-dot (MoreVertical) trigger button
  - [x] 1.3 Define menu items type: { label, icon, onClick, variant, disabled }
  - [x] 1.4 Style dropdown with glass-premium aesthetic matching existing components
  - [x] 1.5 Support variant colors (default, danger for delete)
  - [x] 1.6 Add keyboard navigation (Escape to close, arrow keys)
  - [x] 1.7 Handle click-outside-to-close

- [x] **Task 2: Implement Duplicate functionality** (AC: 4)
  - [x] 2.1 Create `useDuplicate` hook in `src/hooks/useDuplicate.ts`
  - [x] 2.2 Implement generic duplicate logic that works with any entity
  - [x] 2.3 Add "(Copie)" suffix to duplicated name/title field (locale-aware)
  - [x] 2.4 Generate new ID for duplicated entity
  - [x] 2.5 Reset status fields (e.g., draft status for new copies)
  - [x] 2.6 Handle Firestore creation with proper tenant context
  - [x] 2.7 Return loading state and error handling

- [x] **Task 3: Integrate RowActionsMenu into RiskColumns** (AC: 1, 2, 3, 4, 5)
  - [x] 3.1 Replace individual Edit/Delete buttons with RowActionsMenu
  - [x] 3.2 Add Edit action (uses existing onEdit callback)
  - [x] 3.3 Add Delete action (uses existing onDelete callback with ConfirmModal)
  - [x] 3.4 Add Duplicate action using useDuplicate hook
  - [x] 3.5 Show toast notification on successful duplication
  - [x] 3.6 Pass canEdit prop to conditionally show menu

- [x] **Task 4: Update other list components** (AC: 1, 2, 3, 4, 5)
  - [x] 4.1 Update `AssetList` columns to use RowActionsMenu
  - [x] 4.2 Update `VulnerabilityList` columns to use RowActionsMenu
  - [x] 4.3 Update `AuditsList` columns to use RowActionsMenu
  - [x] 4.4 Update `ProjectList` columns to use RowActionsMenu
  - [x] 4.5 Ensure consistent action ordering: Edit, Duplicate, Delete

- [x] **Task 5: Write unit tests** (AC: all)
  - [x] 5.1 Test RowActionsMenu rendering with multiple items
  - [x] 5.2 Test RowActionsMenu keyboard navigation
  - [x] 5.3 Test useDuplicate hook creates copy with "(Copie)" suffix
  - [x] 5.4 Test useDuplicate generates new ID
  - [x] 5.5 Test Edit action triggers callback
  - [x] 5.6 Test Delete action shows confirmation modal
  - [x] 5.7 Test Duplicate action creates entity and refreshes list
  - [x] 5.8 Test menu hidden when canEdit is false

## Dev Notes

### Dependencies

**Story 1.1 Output Used:**
- `useLocale()` hook for locale-aware duplicate suffix ("Copie" vs "Copy")
- `SupportedLocale` type from `src/config/localeConfig.ts`

**Story 1.2 Output Used:**
- Toast notifications for feedback (already implemented via existing toast system)

**Existing Components Used:**
- `ConfirmModal` for delete confirmation (src/components/ui/ConfirmModal.tsx)
- `Button` component (src/components/ui/button.tsx)
- Icons from lucide-react (Edit, Trash2, Copy, MoreVertical)
- Headless UI Menu for dropdown

### Technical Approach

**RowActionsMenu Component:**
```typescript
import { Menu, Transition } from '@headlessui/react';
import { MoreVertical } from 'lucide-react';

interface RowActionItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface RowActionsMenuProps {
  items: RowActionItem[];
  'aria-label'?: string;
}

export function RowActionsMenu({ items, 'aria-label': ariaLabel }: RowActionsMenuProps) {
  return (
    <Menu as="div" className="relative">
      <Menu.Button
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={ariaLabel || "Actions"}
      >
        <MoreVertical className="h-4 w-4 text-slate-500" />
      </Menu.Button>

      <Transition
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-in"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black/5 focus:outline-none z-50">
          {/* Menu items */}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
```

**useDuplicate Hook:**
```typescript
interface UseDuplicateOptions<T> {
  /** Collection path for Firestore */
  collectionPath: string;
  /** Field name to add "(Copie)" suffix */
  nameField: keyof T;
  /** Fields to reset on duplicate (e.g., status, dates) */
  resetFields?: Partial<T>;
  /** Callback after successful duplication */
  onSuccess?: (newEntity: T) => void;
}

interface UseDuplicateReturn {
  duplicate: (entity: T) => Promise<void>;
  isDuplicating: boolean;
  error: Error | null;
}

export function useDuplicate<T extends { id: string }>(
  options: UseDuplicateOptions<T>
): UseDuplicateReturn {
  // Implementation with Firestore
}
```

**Duplicate Suffix Localization:**
```typescript
const duplicateSuffix = {
  fr: '(Copie)',
  en: '(Copy)',
};

// Usage
const newName = `${originalName} ${duplicateSuffix[locale]}`;
```

### Visual Design

**RowActionsMenu Dropdown:**
- Trigger: 24x24px MoreVertical icon button
- Background: `bg-white dark:bg-slate-900`
- Border: `ring-1 ring-black/5 dark:ring-white/10`
- Border radius: `rounded-xl`
- Shadow: `shadow-lg`
- Item padding: `px-4 py-2`
- Item hover: `bg-slate-50 dark:bg-slate-800`
- Danger variant: `text-rose-600 hover:bg-rose-50`

**Menu Items Order:**
1. Edit (Modifier) - Edit icon
2. Duplicate (Dupliquer) - Copy icon
3. Delete (Supprimer) - Trash2 icon, danger variant

### Accessibility

- Menu button has descriptive `aria-label`
- Menu items are keyboard-navigable (Enter/Space to select)
- Escape key closes the menu
- Focus trapped within open menu
- `aria-haspopup="menu"` on trigger button

### Integration Pattern

```tsx
// In RiskColumns.tsx actions column
{
  id: 'actions',
  header: '',
  cell: ({ row }) => {
    const { duplicate, isDuplicating } = useDuplicate({
      collectionPath: `organizations/${orgId}/risks`,
      nameField: 'threat',
      resetFields: { status: 'Ouvert', createdAt: serverTimestamp() },
      onSuccess: () => toast.success('Risque dupliqué avec succès'),
    });

    if (!canEdit) return null;

    return (
      <RowActionsMenu
        aria-label={`Actions pour ${row.original.threat}`}
        items={[
          {
            label: 'Modifier',
            icon: Edit,
            onClick: () => onEdit(row.original),
          },
          {
            label: 'Dupliquer',
            icon: Copy,
            onClick: () => duplicate(row.original),
            disabled: isDuplicating,
          },
          {
            label: 'Supprimer',
            icon: Trash2,
            onClick: () => onDelete(row.original.id, row.original.threat),
            variant: 'danger',
          },
        ]}
      />
    );
  },
}
```

### File Structure

```
src/
├── components/
│   └── ui/
│       ├── RowActionsMenu.tsx        # NEW
│       └── __tests__/
│           └── RowActionsMenu.test.tsx # NEW
├── hooks/
│   ├── useDuplicate.ts               # NEW
│   └── __tests__/
│       └── useDuplicate.test.ts      # NEW
└── components/
    └── risks/
        └── list/
            └── RiskColumns.tsx        # MODIFIED
```

### Performance Considerations

1. **Lazy Load Menu Items**: Don't create action handlers until menu opens
2. **Memoize Menu Items**: Use useMemo for items array
3. **Optimistic UI**: Show duplicated item immediately, rollback on error
4. **Batch Updates**: When duplicating, minimize Firestore writes

### Edge Cases

1. **Duplicate Naming Collision**: If "Risk (Copie)" already exists, append number: "Risk (Copie 2)"
2. **Duplicate While Another in Progress**: Disable duplicate button during operation
3. **Permission Changes During Session**: Re-check canEdit on each render
4. **Entity Deleted Elsewhere**: Handle "not found" errors gracefully

## Estimation

**Complexity**: Medium
**Estimated Tasks**: 5 tasks, ~25 subtasks
**Testing Focus**: Menu interaction, duplicate logic, permission gating

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **RowActionsMenu Component**: Created reusable dropdown menu component using Headless UI Menu with glass-premium styling, keyboard navigation, and accessibility support.

2. **useDuplicate Hook**: Implemented generic hook for entity duplication with:
   - Locale-aware suffix ("Copie" for French, "Copy" for English)
   - Ref-based double-click prevention for synchronous guard
   - Proper Firestore integration with tenant context
   - Toast notifications for success/error feedback

3. **List Component Integrations**: Updated 5 list components to use RowActionsMenu:
   - RiskColumns: Edit, Duplicate, Delete actions
   - AssetList: Print Label, Edit, Duplicate, Delete actions
   - VulnerabilityList: Edit, Duplicate, Delete actions
   - AuditsList: Open, Edit, Duplicate, Delete actions
   - ProjectList: Edit, Duplicate, Delete actions

4. **Testing**: 44 new tests added (20 for RowActionsMenu, 24 for useDuplicate), all passing.

### File List

**New Files:**
- `src/components/ui/RowActionsMenu.tsx` - Contextual actions dropdown component
- `src/components/ui/__tests__/RowActionsMenu.test.tsx` - 20 unit tests
- `src/hooks/useDuplicate.ts` - Generic entity duplication hook
- `src/hooks/__tests__/useDuplicate.test.ts` - 24 unit tests

**Modified Files:**
- `src/components/risks/list/RiskColumns.tsx` - Integrated RowActionsMenu
- `src/components/risks/RiskList.tsx` - Added onDuplicate and duplicatingIds props
- `src/views/Risks.tsx` - Added duplicate functionality with state tracking
- `src/components/assets/AssetList.tsx` - Integrated RowActionsMenu
- `src/components/vulnerabilities/VulnerabilityList.tsx` - Integrated RowActionsMenu
- `src/components/audits/AuditsList.tsx` - Integrated RowActionsMenu
- `src/components/projects/ProjectList.tsx` - Integrated RowActionsMenu

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: Contextual actions on hover/row | ✅ Pass | RowActionsMenu with MoreVertical trigger appears in actions column |
| AC2: Edit opens form | ✅ Pass | Edit action calls onEdit callback with entity data |
| AC3: Delete shows confirmation | ✅ Pass | Delete action triggers existing ConfirmModal flow |
| AC4: Duplicate creates copy with "(Copie)" | ✅ Pass | useDuplicate hook adds locale-aware suffix, creates new Firestore document |
| AC5: Actions respect permissions | ✅ Pass | Menu items conditionally rendered based on canEdit/canDelete props |

### Test Summary

- **Total New Tests**: 44
- **RowActionsMenu Tests**: 20 tests covering rendering, styling, interactions, keyboard navigation, accessibility
- **useDuplicate Tests**: 24 tests covering duplicate logic, loading states, error handling, locale handling
- **All Tests Pass**: 715 total tests in suite

### Change Log

- 2026-01-10: Story created for implementation
- 2026-01-10: Task 1 completed - RowActionsMenu component with 20 tests
- 2026-01-10: Task 2 completed - useDuplicate hook with 24 tests
- 2026-01-10: Task 3 completed - RiskColumns integration
- 2026-01-10: Task 4 completed - All list components updated (AssetList, VulnerabilityList, AuditsList, ProjectList)
- 2026-01-10: Task 5 completed - All unit tests passing (715 total)
- 2026-01-10: Story completed - All acceptance criteria verified
