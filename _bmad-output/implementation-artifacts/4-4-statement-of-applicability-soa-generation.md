# Story 4.4: Statement of Applicability (SoA) Generation

Status: done

## Story

As a **RSSI**,
I want **to generate a Statement of Applicability**,
So that **I have documentation for ISO 27001 certification**.

## Acceptance Criteria

1. **Given** the user has ISO 27001 framework enabled
   **When** they click "Generate SoA"
   **Then** a SoA document is generated with all Annex A controls

2. **Given** the SoA is displayed
   **When** viewing a control
   **Then** each control shows: Applicable (Yes/No), Justification, Status

3. **Given** the user views the SoA
   **When** they click "Export PDF"
   **Then** the document can be exported as PDF

4. **Given** the user generates a SoA
   **When** they view the SoA history
   **Then** the SoA tracks version history

## Tasks / Subtasks

- [x] **Task 1: SoA Table View** (AC: 1, 2) - ALREADY IMPLEMENTED
  - [x] 1.1 Create SoAView.tsx component with table layout
  - [x] 1.2 Display all controls with Code, Name, Applicability, Justification, Status
  - [x] 1.3 Add applicability toggle (Yes/No checkbox)
  - [x] 1.4 Add inline justification editing with validation (required when N/A)

- [x] **Task 2: PDF Export** (AC: 3) - ALREADY IMPLEMENTED
  - [x] 2.1 Implement jsPDF export with autoTable
  - [x] 2.2 Include all SoA columns in PDF
  - [x] 2.3 Add export button to UI

- [x] **Task 3: SoA Version History** (AC: 4)
  - [x] 3.1 Add "Save SoA Version" button to capture snapshot
  - [x] 3.2 Store SoA snapshots in Firestore (organizations/{orgId}/soaVersions)
  - [x] 3.3 Display version history panel with dates and stats
  - [x] 3.4 Allow viewing/exporting previous versions (with PDF export)

- [x] **Task 4: Integration with Compliance View** (AC: 1) - ALREADY IMPLEMENTED
  - [x] 4.1 Add SoA tab to Compliance navigation
  - [x] 4.2 Wire up SoAView component with handlers

## Dev Notes

### Existing Implementation

The SoAView component already exists at `src/components/compliance/SoAView.tsx` with:
- Full table view with Code, Name, Applicability, Risks, Evidence, Justification, Status, Maturity
- Applicability toggle (checkbox)
- Inline justification editing with red validation for missing N/A justifications
- PDF export via jsPDF + autoTable
- Integration with Compliance.tsx (SoA tab)

### Version History Approach

Since SoA snapshots need to be stored for audit purposes, we'll:
1. Create a `soaVersions` subcollection under organizations
2. Each version stores: date, generatedBy, controls snapshot, notes
3. Add a simple version list sidebar or modal

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/compliance/SoAView.tsx` | Add version save/history functionality |
| `src/types/index.ts` | Add SoAVersion type (if needed) |

## References

- [Source: epics.md#Story-4.4] - Story requirements
- [FR20: Génération SoA] - PRD requirement
- [Existing: src/components/compliance/SoAView.tsx] - Already implemented

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Added SoAVersion and SoAControlSnapshot types to controls.ts for versioning support
2. Significantly enhanced SoAView.tsx with version history:
   - "Sauvegarder version" button to snapshot current SoA state to Firestore
   - "Historique" button with badge showing version count
   - Expandable version history panel listing all saved versions
   - Each version shows: version number, date, generator name, stats (implemented/total controls)
   - Clicking a version displays it as read-only in the table
   - PDF export works for both current state and historical versions
   - Visual indicator when viewing a historical version (amber badge with "Version X - Date")
3. Added stats summary cards: Total, Applicables, Implémentés, Partiels
4. Version data stored in organizations/{orgId}/soaVersions subcollection
5. Passed framework prop from Compliance.tsx to enable framework-specific versioning
6. All 1434 tests pass

### File List

| File | Action |
|------|--------|
| `src/types/controls.ts` | Modified - Added SoAVersion and SoAControlSnapshot interfaces |
| `src/components/compliance/SoAView.tsx` | Modified - Added version history functionality |
| `src/views/Compliance.tsx` | Modified - Added framework prop to SoAView |
