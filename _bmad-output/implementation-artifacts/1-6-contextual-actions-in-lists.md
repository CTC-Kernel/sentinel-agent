# Story 1.6: Contextual Actions in Lists

Status: ready-for-dev

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

- [ ] **Task 2: Implement Duplicate functionality** (AC: 4)
  - [ ] 2.1 Create `useDuplicate` hook in `src/hooks/useDuplicate.ts`
  - [ ] 2.2 Implement generic duplicate logic that works with any entity
  - [ ] 2.3 Add "(Copie)" suffix to duplicated name/title field (locale-aware)
  - [ ] 2.4 Generate new ID for duplicated entity
  - [ ] 2.5 Reset status fields (e.g., draft status for new copies)
  - [ ] 2.6 Handle Firestore creation with proper tenant context
  - [ ] 2.7 Return loading state and error handling

- [ ] **Task 3: Integrate RowActionsMenu into RiskColumns** (AC: 1, 2, 3, 4, 5)
  - [ ] 3.1 Replace individual Edit/Delete buttons with RowActionsMenu
  - [ ] 3.2 Add Edit action (uses existing onEdit callback)
  - [ ] 3.3 Add Delete action (uses existing onDelete callback with ConfirmModal)
  - [ ] 3.4 Add Duplicate action using useDuplicate hook
  - [ ] 3.5 Show toast notification on successful duplication
  - [ ] 3.6 Pass canEdit prop to conditionally show menu

- [ ] **Task 4: Update other list components** (AC: 1, 2, 3, 4, 5)
  - [ ] 4.1 Update `AssetList` columns to use RowActionsMenu
  - [ ] 4.2 Update `VulnerabilityList` columns to use RowActionsMenu
  - [ ] 4.3 Update `AuditsList` columns to use RowActionsMenu
  - [ ] 4.4 Update `ProjectList` columns to use RowActionsMenu
  - [ ] 4.5 Ensure consistent action ordering: Edit, Duplicate, Delete

- [ ] **Task 5: Write unit tests** (AC: all)
  - [ ] 5.1 Test RowActionsMenu rendering with multiple items
  - [ ] 5.2 Test RowActionsMenu keyboard navigation
  - [ ] 5.3 Test useDuplicate hook creates copy with "(Copie)" suffix
  - [ ] 5.4 Test useDuplicate generates new ID
  - [ ] 5.5 Test Edit action triggers callback
  - [ ] 5.6 Test Delete action shows confirmation modal
  - [ ] 5.7 Test Duplicate action creates entity and refreshes list
  - [ ] 5.8 Test menu hidden when canEdit is false

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

(To be filled after implementation)

### Completion Notes List

(To be filled after implementation)

### File List

(To be filled after implementation)

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: Contextual actions on hover/row | ⏳ Pending | |
| AC2: Edit opens form | ⏳ Pending | |
| AC3: Delete shows confirmation | ⏳ Pending | |
| AC4: Duplicate creates copy with "(Copie)" | ⏳ Pending | |
| AC5: Actions respect permissions | ⏳ Pending | |

### Test Summary

(To be filled after implementation)

### Change Log

- 2026-01-10: Story created for implementation
