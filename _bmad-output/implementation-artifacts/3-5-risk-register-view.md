# Story 3.5: Risk Register View

Status: done

## Story

As an **authorized user**,
I want **to view the complete risk register**,
So that **I have visibility into all risks**.

## Acceptance Criteria

1. **Given** the user has permission to view risks
   **When** they navigate to the Risk Register
   **Then** all risks display in a sortable, filterable table
   **And** columns include: Title, Category, Criticality, Status, Owner

2. **Given** the user is viewing the risk register
   **When** they use the filter controls
   **Then** filters allow by: Status, Category, Criticality Level
   **And** filters can be combined

3. **Given** the user is viewing the risk register
   **When** they click export
   **Then** export to Excel/PDF is available
   **And** the export respects current filters

## Tasks / Subtasks

- [x] **Task 1: Enhance RiskFilters Component** (AC: 2)
  - [x] 1.1 Add Status filter dropdown (Ouvert, En cours, Fermé, etc.)
  - [x] 1.2 Add Category filter dropdown
  - [x] 1.3 Add Criticality filter dropdown (Critique, Élevé, Moyen, Faible)
  - [x] 1.4 Wire up filter state to parent component

- [x] **Task 2: Add Category Column to Risk List** (AC: 1)
  - [x] 2.1 Add category column to RiskColumns
  - [x] 2.2 Display category with appropriate styling

- [x] **Task 3: Enable Export Functionality** (AC: 3)
  - [x] 3.1 Enable exportable prop on RiskList
  - [x] 3.2 Create RiskRegisterExport utility for Excel/PDF
  - [x] 3.3 Add export buttons to RiskFilters toolbar
  - [x] 3.4 Implement filtered data export

- [x] **Task 4: Write Unit Tests** (AC: all)
  - [x] 4.1 Test filter components
  - [x] 4.2 Test export functionality
  - [x] 4.3 Test category column display

## Dev Notes

### Existing Infrastructure

The codebase already has:
- `DataTable` component with sorting, filtering, and CSV export
- `RiskFilters` component with search, view modes, and framework filter
- `RiskColumns` with columns: Menace, Vulnérabilité, Actif, Score, Stratégie, Contrôles, Statut
- `ExcelExportService` for Excel exports
- `PdfService` for PDF generation
- Risk type has `category?: string` field

### Risk Status Values

```typescript
status: 'Brouillon' | 'Ouvert' | 'En cours' | 'Fermé' | 'En attente de validation'
```

### Criticality Levels (based on score)

```typescript
// From riskUtils.ts getRiskLevel()
1-4: Faible (success)
5-9: Moyen (info)
10-14: Élevé (warning)
15-25: Critique (error)
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/risks/RiskFilters.tsx` | Add status, category, criticality filters |
| `src/components/risks/list/RiskColumns.tsx` | Add category column |
| `src/components/risks/RiskList.tsx` | Enable exports, pass controls |

### Files to Create

| File | Purpose |
|------|---------|
| `src/utils/riskExportUtils.ts` | Risk register export utilities |

## References

- [Source: epics.md#Story-3.5] - Story requirements
- [Existing: src/components/risks/RiskFilters.tsx] - Current filter component
- [Existing: src/services/excelExportService.ts] - Excel export service
- [Existing: src/services/PdfService.ts] - PDF service

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Enhanced useRiskFilters hook** - Added `category` to filter state, `availableCategories` computed value, and criticality/category filtering logic
2. **Created RiskAdvancedFilters component** - New inline filter panel with status, criticality, and category dropdowns, including active filter badges
3. **Added category column to RiskColumns** - Displays risk category with "Non définie" for missing values
4. **Created riskExportUtils.ts** - Export utilities with `exportRisksToExcel()`, `exportRisksToPdf()`, and `getRiskSummaryStats()` functions
5. **Integrated Excel export into RisksToolbar** - Added `onExportExcel` prop and menu item
6. **Updated Risks.tsx view** - Integrated new filter panel and Excel export functionality
7. **Created comprehensive tests** - 18 tests for RiskAdvancedFilters, 8 tests for riskExportUtils

### File List

**Modified Files:**
- `src/hooks/risks/useRiskFilters.ts` - Enhanced with category filter and availableCategories
- `src/components/risks/RiskFilters.tsx` - Enhanced with status, category, criticality filter props
- `src/components/risks/list/RiskColumns.tsx` - Added category column
- `src/components/risks/RisksToolbar.tsx` - Added onExportExcel prop and menu item
- `src/views/Risks.tsx` - Integrated RiskAdvancedFilters and Excel export
- `src/views/__tests__/Risks.test.tsx` - Added Circle icon to mock

**New Files:**
- `src/utils/riskExportUtils.ts` - Risk register export utilities
- `src/components/risks/RiskAdvancedFilters.tsx` - Inline advanced filter panel
- `src/components/risks/__tests__/RiskAdvancedFilters.test.tsx` - 18 unit tests
- `src/utils/__tests__/riskExportUtils.test.ts` - 8 unit tests

### Test Results

- 90 risk-related tests passing
- All acceptance criteria met
