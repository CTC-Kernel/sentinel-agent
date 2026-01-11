# Story 4.2: Cross-Framework Control Mapping

Status: done

## Story

As a **RSSI**,
I want **to see how controls map across frameworks**,
So that **I can efficiently manage compliance**.

## Acceptance Criteria

1. **Given** the user views a control
   **When** multiple frameworks are enabled
   **Then** the control shows which frameworks it satisfies

2. **Given** the user views the mapping matrix
   **When** controls are displayed
   **Then** a mapping matrix displays control → framework relationships

3. **Given** the user views framework coverage
   **When** controls are mapped
   **Then** coverage percentage is calculated per framework

4. **Given** the user views gaps
   **When** controls are missing for a framework
   **Then** gaps are highlighted

## Tasks / Subtasks

- [x] **Task 1: Update Control Type** (AC: 1)
  - [x] 1.1 Add `mappedFrameworks?: Framework[]` field to Control interface
  - [x] 1.2 Keep `framework` as primary, `mappedFrameworks` for additional

- [x] **Task 2: Display Mapped Frameworks in Control Details** (AC: 1)
  - [x] 2.1 Add framework badges section to ComplianceDetails
  - [x] 2.2 Show primary framework with distinct styling (brand color, "(principal)" label)
  - [x] 2.3 Allow editing mapped frameworks (add/remove with CustomSelect dropdown)

- [x] **Task 3: Create Framework Mapping Matrix View** (AC: 2, 3, 4)
  - [x] 3.1 Create FrameworkMappingMatrix.tsx component
  - [x] 3.2 Display controls as rows, frameworks as columns
  - [x] 3.3 Show checkmarks for mapped frameworks (brand for primary, green for additional)
  - [x] 3.4 Calculate and display coverage percentage per framework (color-coded badges)
  - [x] 3.5 Highlight gaps with "Show gaps only" filter and amber styling

- [x] **Task 4: Add Mapping Tab to Compliance View** (AC: 2)
  - [x] 4.1 Add "Mapping" tab with Layers icon to navigation tabs
  - [x] 4.2 Render FrameworkMappingMatrix component with organization's enabled frameworks

- [x] **Task 5: Integrate Actions Hook** (AC: 1)
  - [x] 5.1 Add handleMapFramework/handleUnmapFramework to useComplianceActions
  - [x] 5.2 Wire up handlers through ComplianceInspector and ComplianceDrawer

## Dev Notes

### Existing Infrastructure

The codebase already has:
- `Control` interface with `framework?: Framework` field
- `Framework` type with 14 frameworks
- `FRAMEWORKS` array in `src/data/frameworks.ts`
- `ComplianceDetails` component for control details
- `ComplianceInspector` with tabs for details/evidence/linked items
- Framework filtering in Compliance view (Story 4-1)

### Control Type Changes

```typescript
export interface Control {
    // ... existing fields
    framework?: Framework;           // Primary framework (existing)
    mappedFrameworks?: Framework[];  // Additional frameworks this satisfies
}
```

### Coverage Calculation

```typescript
// Per framework coverage = (controls mapped to framework / total controls for framework) * 100
const frameworkCoverage = {
    ISO27001: { mapped: 45, total: 93, percentage: 48.4 },
    NIS2: { mapped: 12, total: 23, percentage: 52.2 },
    // ...
};
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/controls.ts` | Add mappedFrameworks field |
| `src/components/compliance/inspector/ComplianceDetails.tsx` | Show mapped frameworks |
| `src/views/Compliance.tsx` | Add Mapping tab |

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/compliance/FrameworkMappingMatrix.tsx` | Mapping matrix view |
| `src/components/compliance/__tests__/FrameworkMappingMatrix.test.tsx` | Unit tests |

## References

- [Source: epics.md#Story-4.2] - Story requirements
- [Story 4-1: Framework Activation] - Prerequisite story
- [Existing: src/types/controls.ts] - Control interface
- [Existing: src/data/frameworks.ts] - Framework metadata

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Added `mappedFrameworks?: Framework[]` field to Control interface in controls.ts
2. Added handleMapFramework/handleUnmapFramework handlers to useComplianceActions hook
3. Updated ComplianceDetails component with "Référentiels Satisfaits" section:
   - Primary framework badge with brand color and "(principal)" label
   - Mapped framework badges with remove button
   - CustomSelect dropdown to add new framework mappings
4. Created FrameworkMappingMatrix.tsx component featuring:
   - Coverage summary cards with color-coded percentages (green ≥80%, amber ≥50%, red <50%)
   - Expandable framework details with mapped/total/potential stats
   - Matrix table showing controls (rows) × frameworks (columns)
   - Checkmarks differentiate primary (brand) vs additional (green) mappings
   - "Show gaps only" filter to highlight unmapped controls
   - Legend explaining the visual indicators
5. Added "Mapping" tab to Compliance view with Layers icon
6. Wired enabledFrameworks from organization through ComplianceDrawer and ComplianceInspector
7. All 1434 tests pass

### File List

| File | Action |
|------|--------|
| `src/types/controls.ts` | Modified - Added mappedFrameworks field |
| `src/hooks/useComplianceActions.ts` | Modified - Added framework mapping handlers |
| `src/components/compliance/inspector/ComplianceDetails.tsx` | Modified - Added framework mapping section |
| `src/components/compliance/ComplianceInspector.tsx` | Modified - Added enabledFrameworks prop |
| `src/components/compliance/ComplianceDrawer.tsx` | Modified - Added enabledFrameworks prop and handler types |
| `src/components/compliance/FrameworkMappingMatrix.tsx` | Created - Matrix view component |
| `src/views/Compliance.tsx` | Modified - Added Mapping tab |
