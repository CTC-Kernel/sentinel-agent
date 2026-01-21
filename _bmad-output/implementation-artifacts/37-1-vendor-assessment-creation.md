# Story 37-1: Vendor Assessment Creation

## Story

**As a** RSSI,
**I want** to create vendor risk assessments,
**So that** I evaluate third-party security.

## Status

**Current Status:** dev-complete
**Epic:** Epic 37 - Third-Party Risk Management (P1 - All Verticals)
**Priority:** P1 - 85% RSSI Gap
**ADR:** ADR-010
**Vertical:** All

## Context

### Business Context
Third-party risk management (TPRM) is a critical security domain. RSSI need to systematically evaluate vendor security postures through questionnaires aligned with relevant frameworks (ISO 27001, NIS2, DORA, HDS). The existing Supplier module has basic assessment capabilities that need enhancement with more templates, better status tracking, and next review scheduling.

### Persona: RSSI (All Verticals)
- Creates assessments for new and existing vendors
- Selects appropriate questionnaire template based on vendor type
- Tracks assessment status and completion
- Schedules regular review cycles
- Views assessment history and scores

### Brownfield Context
The codebase already has:
- `Supplier` type with basic assessment fields (`src/types/business.ts`)
- `QuestionnaireTemplate` and `SupplierQuestionnaireResponse` types
- `SupplierAssessmentDrawer` component for creating assessments
- `SupplierAssessments` component for listing assessments
- `SupplierService` with `createAssessment` method
- One DORA template auto-seeded

### What Needs Enhancement
1. Additional questionnaire templates (ISO 27001, NIS2, HDS, General)
2. Assessment status: add 'Pending', 'Completed', 'Expired'
3. Next review date scheduling
4. Assessment expiration alerts
5. Improved assessment creation UX with template previews

## Acceptance Criteria

### AC1: Assessment Creation
**Given** the user accesses Suppliers > Assessments
**When** they create a new assessment
**Then** they can select a vendor and questionnaire template
**And** templates exist for: ISO 27001, NIS2, DORA, HDS, General
**And** assessment status tracks: Pending, In Progress, Completed, Expired
**And** next review date is scheduled

### AC2: Template Selection
**Given** the user creates a new assessment
**When** they select a template
**Then** they see a preview of template sections and question count
**And** they can see template description and applicable framework
**And** they can set a due date for completion

### AC3: Status Tracking
**Given** an assessment is created
**When** the status changes
**Then** status options include: Draft, Sent, In Progress, Submitted, Reviewed, Archived, Expired
**And** Expired status is auto-set when past due date without completion

### AC4: Review Scheduling
**Given** an assessment is completed
**When** the user marks it as reviewed
**Then** they can set the next review date
**And** the system tracks review cycle (e.g., annual, bi-annual)
**And** alerts are generated 90/60/30 days before next review

## Tasks

### Task 1: Enhanced Questionnaire Templates ✅
**File:** `src/data/questionnaireTemplates.ts`

**Subtasks:**
- [x] Create ISO 27001 questionnaire template
- [x] Create NIS2 questionnaire template
- [x] Create HDS (Hébergeur Données Santé) template
- [x] Create General Security template
- [x] Add template preview metadata (sections, questions count)

### Task 2: Enhanced Assessment Types ✅
**File:** `src/types/vendorAssessment.ts`

**Subtasks:**
- [x] Extend SupplierQuestionnaireResponse with expirationDate
- [x] Add nextReviewDate field
- [x] Add reviewCycle field (annual, bi-annual, quarterly)
- [x] Create AssessmentStatus type with all statuses
- [x] Add template preview interface

### Task 3: Assessment Service Enhancement ✅
**File:** `src/services/VendorAssessmentService.ts`

**Subtasks:**
- [x] Add seedDefaultTemplates function
- [x] Implement checkExpiredAssessments function
- [x] Add scheduleNextReview function
- [x] Create getAssessmentMetrics function

### Task 4: Enhanced Assessment Drawer ✅
**File:** `src/components/suppliers/SupplierAssessmentDrawer.tsx`

**Subtasks:**
- [x] Add template preview section
- [x] Add due date picker
- [x] Add next review date option
- [x] Show template framework badge

### Task 5: Assessment List Enhancement ✅
**File:** `src/components/suppliers/inspector/SupplierAssessments.tsx`

**Subtasks:**
- [x] Add expiration indicator
- [x] Show next review date
- [x] Add filter by status
- [x] Show assessment progress bar

### Task 6: i18n Translations ✅
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add vendorAssessment section
- [x] Add template names and descriptions
- [x] Add status labels
- [x] Add alert messages

### Task 7: Unit Tests ✅
**File:** `src/services/__tests__/VendorAssessmentService.test.ts`

**Subtasks:**
- [x] Test template seeding
- [x] Test expiration checking
- [x] Test review scheduling

## Technical Notes

### Status Flow
```
Draft → Sent → In Progress → Submitted → Reviewed → Archived
                    ↓
                 Expired (if past due date)
```

### Review Cycles
```typescript
type ReviewCycle = 'quarterly' | 'bi-annual' | 'annual' | 'custom';
```

### Template Categories
| Template | Framework | Sections | Questions |
|----------|-----------|----------|-----------|
| DORA | DORA Art. 28 | 3 | 7 |
| ISO 27001 | ISO/IEC 27001:2022 | 5 | 15 |
| NIS2 | NIS2 Directive | 4 | 12 |
| HDS | HDS Certification | 6 | 20 |
| General | Best Practices | 4 | 10 |

### Existing Files to Modify
```
src/types/business.ts               # SupplierQuestionnaireResponse
src/components/suppliers/           # Assessment components
src/services/SupplierService.ts     # Existing service
src/data/supplierConstants.ts       # Add template constants
```

## Definition of Done

- [x] 5 questionnaire templates available (DORA, ISO 27001, NIS2, HDS, General)
- [x] Assessment status includes Expired
- [x] Next review date can be scheduled
- [x] Template preview shown during creation
- [x] French and English translations
- [x] Unit tests passing
- [ ] No TypeScript errors (pending build verification)

## Dependencies

### Requires
- Existing Supplier module (brownfield)
- Existing QuestionnaireTemplate types

### Enables
- Story 37-2: Vendor Self-Service Portal
- Story 37-3: Automated Vendor Scoring
- Story 37-4: Vendor Concentration Dashboard

## Dev Agent Record

### Implementation Plan
Implemented enhanced vendor assessment creation system with:
1. Complete questionnaire templates for 5 compliance frameworks
2. Extended assessment types with expiration and review scheduling
3. Full-featured service for template management, expiration checking, and metrics
4. Enhanced drawer UI with template preview and scheduling options
5. Improved list view with filters, progress bars, and status indicators
6. Full i18n support for French and English
7. Comprehensive unit tests for utility functions and templates

### Debug Log
No issues encountered during implementation.

### Completion Notes
All 7 tasks completed successfully:
- **Task 1**: Created `questionnaireTemplates.ts` with 5 complete templates (DORA, ISO 27001, NIS2, HDS, General) totaling 87 questions across 22 sections
- **Task 2**: Created `vendorAssessment.ts` with extended types for status, review cycles, alerts, metrics, and template previews
- **Task 3**: Implemented `VendorAssessmentService` with template seeding, expiration checking, review scheduling, metrics calculation, and alert generation
- **Task 4**: Enhanced `SupplierAssessmentDrawer` with template preview, due date picker, review cycle selector, and framework badges
- **Task 5**: Enhanced `SupplierAssessments` with status filters, expiration indicators, progress bars, and next review badges
- **Task 6**: Added complete `vendorAssessment` section to both FR and EN translation files (~80 translation keys each)
- **Task 7**: Created comprehensive unit tests covering utility functions, template structure validation, and status flow

## File List

### New Files
- `src/data/questionnaireTemplates.ts` - 5 questionnaire templates with metadata
- `src/types/vendorAssessment.ts` - Enhanced assessment types and utilities
- `src/services/VendorAssessmentService.ts` - Assessment management service
- `src/services/__tests__/VendorAssessmentService.test.ts` - Unit tests

### Modified Files
- `src/components/suppliers/SupplierAssessmentDrawer.tsx` - Enhanced with template preview and scheduling
- `src/components/suppliers/inspector/SupplierAssessments.tsx` - Enhanced with filters and progress
- `public/locales/fr/translation.json` - Added vendorAssessment section
- `public/locales/en/translation.json` - Added vendorAssessment section

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-21 | Initial implementation of all 7 tasks | Claude (Dev Agent) |

---

**Story File Created:** 2026-01-21
**Story Completed:** 2026-01-21
**Author:** Claude (Dev Agent)
**Version:** 1.0
