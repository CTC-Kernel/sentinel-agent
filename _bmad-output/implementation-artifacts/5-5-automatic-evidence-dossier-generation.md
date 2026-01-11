# Story 5.5: Automatic Evidence Dossier Generation

Status: done

## Story

As a **user**,
I want **to generate an evidence dossier automatically**,
So that **I have organized proof for auditors**.

## Acceptance Criteria

1. **Given** the user has linked evidence to controls
   **When** they click "Generate Evidence Dossier"
   **Then** a PDF is generated with all evidence organized by domain

2. **Given** the dossier is generated
   **When** viewing the content
   **Then** the dossier includes: Control name, Evidence list, Status

3. **Given** the dossier has multiple controls
   **When** viewing the PDF
   **Then** table of contents provides easy navigation

4. **Given** the dossier is complete
   **When** the user wants to use it
   **Then** the file can be downloaded or shared

## Tasks / Subtasks

- [x] **Task 1: Create EvidenceDossierService** (AC: 1, 2, 3)
  - [x] 1.1 Create service for generating evidence dossier PDF
  - [x] 1.2 Group controls by ISO 27001 domain (A.5-A.8)
  - [x] 1.3 Include control details (code, name, status, evidence list)
  - [x] 1.4 Generate table of contents with page references

- [x] **Task 2: Add Generate Dossier Button** (AC: 1, 4)
  - [x] 2.1 Add "Dossier Preuves" button to Compliance controls tab
  - [x] 2.2 Add loading state during generation (disabled button + "Génération...")
  - [x] 2.3 Auto-download PDF on completion

- [x] **Task 3: Format Evidence Information** (AC: 2)
  - [x] 3.1 Display document name, type, upload date
  - [x] 3.2 Show linked evidence count per control
  - [x] 3.3 Indicate missing evidence with red warning (⚠ Aucune preuve liée)

## Dev Notes

### Existing Infrastructure

- `jsPDF` and `jspdf-autotable` already used in SoAView
- Controls have `evidenceIds` linking to documents
- Documents collection has name, type, url fields
- Compliance view has all controls loaded

### PDF Structure

```
Evidence Dossier - [Framework] - [Date]
===========================================

Table of Contents
- Domain A.5: Organizational Controls... p.1
- Domain A.6: People Controls... p.5
...

---

Domain A.5: Organizational Controls
-----------------------------------

Control A.5.1.1 - Policies for Information Security
Status: Implémenté
Evidence:
  - Policy_InfoSec_v2.pdf (uploaded 2025-01-15)
  - ISO27001_Policy_Review.docx (uploaded 2025-01-10)

Control A.5.1.2 - Review of Policies
Status: Partiel
Evidence:
  - No evidence linked (⚠️)
...
```

### Files to Create

| File | Purpose |
|------|---------|
| `src/services/EvidenceDossierService.ts` | PDF generation logic |

### Files to Modify

| File | Changes |
|------|---------|
| `src/views/Compliance.tsx` | Add generate dossier button |

## References

- [Source: epics.md#Story-5.5] - Story requirements
- [FR25: Dossiers preuves auto] - PRD requirement
- [Existing: SoAView.tsx] - jsPDF usage pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created EvidenceDossierService.ts with comprehensive PDF generation:
   - Title page with organization name, framework, date, generator
   - Summary box with statistics (total controls, implemented, with evidence)
   - Table of contents with domain sections and page numbers
   - Domain sections (A.5-A.8) with colored headers
   - Control cards showing code, name, status, and evidence list
   - Missing evidence highlighted in red (⚠)
   - Summary table at end with all controls and evidence status
   - Footer on all pages with page numbers
2. Added "Dossier Preuves" button to Compliance controls tab actions
3. Added loading state (generatingDossier) with disabled button during generation
4. Uses jsPDF + autoTable (same stack as SoAView)
5. All 1434 tests pass

### File List

| File | Action |
|------|--------|
| `src/services/EvidenceDossierService.ts` | Created - PDF dossier generation service |
| `src/views/Compliance.tsx` | Modified - Added generate dossier button and handler |
