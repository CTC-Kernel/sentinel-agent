# Story 1.3: Draft Mode for Forms

Status: in-progress

## Story

As a **user**,
I want **to save my work as a draft before completing all fields**,
So that **I don't lose my progress if I need to leave**.

## Acceptance Criteria

1. **Given** the user is filling out a complex form (Risk, Asset, Audit, etc.)
   **When** the user clicks "Save as Draft"
   **Then** the form is saved with status "draft"

2. **Given** the user saves a form as draft
   **When** validation runs
   **Then** only the title/name field is required (relaxed validation)

3. **Given** an entity was saved as draft
   **When** viewing the entity in list view
   **Then** a "Draft" badge appears next to the item

4. **Given** the user previously saved a draft
   **When** they return to edit it
   **Then** they can continue editing and either save as draft again or publish

5. **Given** a form is in draft mode
   **When** the user wants to publish/finalize
   **Then** full validation is applied before saving

## Tasks / Subtasks

- [ ] **Task 1: Create createDraftSchema utility** (AC: 1, 2, 5)
  - [ ] 1.1 Create `src/utils/draftSchema.ts` file
  - [ ] 1.2 Implement `createDraftSchema(schema, requiredFields)` function
  - [ ] 1.3 Make all fields optional except specified required fields
  - [ ] 1.4 Handle nested objects properly
  - [ ] 1.5 Support localized error messages from Story 1.2

- [ ] **Task 2: Create useDraftMode hook** (AC: 1, 4, 5)
  - [ ] 2.1 Create `src/hooks/useDraftMode.ts` file
  - [ ] 2.2 Manage draft/publish state toggle
  - [ ] 2.3 Switch between draft schema (relaxed) and full schema
  - [ ] 2.4 Integrate with react-hook-form resolver switching
  - [ ] 2.5 Expose isDraft, setDraftMode, handleSaveAsDraft, handlePublish

- [ ] **Task 3: Create DraftBadge component** (AC: 3)
  - [ ] 3.1 Create `src/components/ui/DraftBadge.tsx`
  - [ ] 3.2 Support FR/EN labels ("Brouillon" / "Draft")
  - [ ] 3.3 Style consistent with existing badges

- [ ] **Task 4: Write unit tests** (AC: all)
  - [ ] 4.1 Test createDraftSchema relaxes validation correctly
  - [ ] 4.2 Test useDraftMode state transitions
  - [ ] 4.3 Test DraftBadge renders correctly in both locales
  - [ ] 4.4 Test schema builder integration with draft mode

## Dev Notes

### Dependencies

**Story 1.1 Output Used:**
- `SupportedLocale` type from `src/config/localeConfig.ts`
- `useLocale()` hook for locale detection

**Story 1.2 Output Used:**
- `createSchemaBuilder()` from `src/utils/zodErrorMap.ts`
- Localized error messages for required fields in draft mode

### Technical Approach

**Draft Schema Factory:**
```typescript
import { z } from 'zod';

// Convert a Zod schema to a draft version where only specified fields are required
export function createDraftSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  requiredFields: (keyof T)[]
): z.ZodObject<...> {
  // Make all fields optional, then override specified fields as required
}
```

**useDraftMode Hook:**
```tsx
function RiskForm() {
  const { isDraft, setDraftMode, getResolver } = useDraftMode({
    fullSchema: riskSchema,
    draftSchema: draftRiskSchema,
  });

  const form = useForm({
    resolver: getResolver(isDraft),
  });

  return (
    <form>
      {/* Form fields */}
      <Button onClick={() => handleSaveAsDraft(form.getValues())}>
        Save as Draft
      </Button>
      <Button onClick={form.handleSubmit(handlePublish)}>
        Publish
      </Button>
    </form>
  );
}
```

### Status Field Conventions

Based on codebase analysis:
- **Documents**: `status: 'Brouillon'` (French)
- **Audits/Questionnaires**: `status: 'Draft'` (English)
- **Assessments**: `status: 'Draft'` (English)
- **Business entities**: `status: 'Draft'` (English)

The DraftBadge component will handle localization automatically.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

(To be filled during implementation)

### File List

**Files Created:**
- (To be filled)

**Files Modified:**
- (To be filled)

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: Save as draft with status | Pending | |
| AC2: Relaxed validation | Pending | |
| AC3: Draft badge in list | Pending | |
| AC4: Continue editing | Pending | |
| AC5: Full validation on publish | Pending | |
