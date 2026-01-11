# Story 4.3: Shared Requirements View

Status: done

## Story

As a **RSSI**,
I want **to see requirements shared between frameworks**,
So that **I avoid duplicate work**.

## Acceptance Criteria

1. **Given** the user has multiple frameworks enabled
   **When** they view the Shared Requirements page
   **Then** requirements that overlap are grouped together

2. **Given** a control satisfies multiple frameworks
   **When** it is displayed in shared requirements
   **Then** all satisfied frameworks are shown

3. **Given** controls are mapped to multiple frameworks
   **When** the user views effort savings
   **Then** savings are calculated and displayed

## Tasks / Subtasks

- [x] **Task 1: Define Shared Requirements Data** (AC: 1, 2)
  - [x] 1.1 Leverage mappedFrameworks field from Story 4-2 (no new data structure needed)
  - [x] 1.2 Group by primary framework (controls with mappedFrameworks.length > 0)

- [x] **Task 2: Create SharedRequirementsView Component** (AC: 1, 2)
  - [x] 2.1 Create SharedRequirementsView.tsx component
  - [x] 2.2 Group controls by primary framework
  - [x] 2.3 Show which frameworks each control satisfies (primary + mapped)
  - [x] 2.4 Display implementation status across frameworks (badges)

- [x] **Task 3: Calculate Effort Savings** (AC: 3)
  - [x] 3.1 Calculate controls that satisfy multiple frameworks
  - [x] 3.2 Display effort savings metrics (4 KPI cards)
  - [x] 3.3 Show "work once, comply many" summary footer

- [x] **Task 4: Integrate into Compliance View** (AC: 1)
  - [x] 4.1 Add "Shared" tab with Link icon to navigation
  - [x] 4.2 Wire up SharedRequirementsView component with props

## Dev Notes

### Design Approach

Since we don't have predefined requirement mappings in the database, we'll leverage the `mappedFrameworks` field from Story 4-2 to identify controls that satisfy multiple frameworks. Controls with `mappedFrameworks.length > 0` represent shared requirements.

### Effort Savings Calculation

```typescript
// Example calculation
const totalControls = controls.length;
const sharedControls = controls.filter(c => c.mappedFrameworks?.length > 0);
const effortSaved = sharedControls.reduce((sum, c) => sum + (c.mappedFrameworks?.length || 0), 0);
// If 10 controls each satisfy 2 additional frameworks = 20 fewer controls to implement
```

### Grouping Strategy

Group controls by:
1. Primary framework
2. Common requirement themes (based on control names/descriptions)
3. Implementation status

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/compliance/SharedRequirementsView.tsx` | Main shared requirements view |

### Files to Modify

| File | Changes |
|------|---------|
| `src/views/Compliance.tsx` | Add Shared tab |

## References

- [Source: epics.md#Story-4.3] - Story requirements
- [Story 4-2: Cross-Framework Control Mapping] - Prerequisite (mappedFrameworks)
- [Existing: src/types/controls.ts] - Control with mappedFrameworks

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created SharedRequirementsView.tsx component with full functionality:
   - Leverages `mappedFrameworks` field from Story 4-2 to identify shared controls
   - Calculates effort savings: total controls, shared controls, additional mappings, savings percentage
   - Groups controls by primary framework with expandable sections
   - Shows all frameworks each control satisfies (primary badge + mapped badges)
   - Color-coded status badges (success for Implémenté, warning for Partiel, neutral otherwise)
   - KPI cards for effort savings metrics (green), shared controls (brand), additional mappings (purple), implemented (amber)
   - Empty states for no controls and no shared requirements
   - Summary footer highlighting "work once, comply many" savings
2. Added "Shared" tab to Compliance.tsx navigation with Link icon
3. Wired SharedRequirementsView with controls, enabledFrameworks, and onControlClick props
4. All 1434 tests pass

### File List

| File | Action |
|------|--------|
| `src/components/compliance/SharedRequirementsView.tsx` | Created - Main shared requirements view component |
| `src/views/Compliance.tsx` | Modified - Added Shared tab and SharedRequirementsView rendering |
