# Story 37-2: Vendor Self-Service Portal

## Story

**As a** vendor contact,
**I want** to complete security questionnaires online,
**So that** I provide assessment information efficiently.

## Status

**Current Status:** completed
**Epic:** Epic 37 - Third-Party Risk Management (P1 - All Verticals)
**Priority:** P1 - 85% RSSI Gap
**ADR:** ADR-010
**Vertical:** All

## Context

### Business Context
When organizations send vendor assessments, vendors need a simple way to complete questionnaires without requiring full platform access. A self-service portal allows vendor contacts to login with limited credentials, view only their assigned questionnaire, save progress, and submit responses. This reduces friction in the third-party risk management process and improves response rates.

### Persona: Vendor Contact
- Receives email with portal access link
- Logs in with limited/temporary credentials
- Views only the assigned questionnaire
- Saves progress incrementally
- Submits completed questionnaire
- Access expires after submission or deadline

### Brownfield Context
The codebase already has:
- `EnhancedAssessmentResponse` type from Story 37-1
- `VendorAssessmentService` for assessment management
- `QuestionnaireTemplate` and section/question types
- Email infrastructure for notifications
- Firebase Auth for authentication

### What Needs to Be Built
1. Vendor portal authentication (magic link or token-based)
2. Isolated questionnaire view for vendors
3. Progress save/submit functionality
4. Portal access token management
5. Access expiration handling
6. Email notifications for portal access

## Acceptance Criteria

### AC1: Portal Access Generation
**Given** an assessment is assigned to a vendor with a contact email
**When** the RSSI sends the assessment
**Then** a secure portal access token is generated
**And** the vendor receives an email with a unique access link
**And** the token has an expiration matching the assessment due date

### AC2: Vendor Portal Login
**Given** a vendor clicks the portal access link
**When** they access the portal
**Then** they land on a minimal login page
**And** they can verify their email to access
**And** no other platform features are visible
**And** branding shows the requesting organization name

### AC3: Questionnaire Display
**Given** a vendor successfully authenticates
**When** they access the portal
**Then** they see only their assigned questionnaire
**And** the questionnaire shows all sections and questions
**And** progress is tracked per section
**And** they can navigate between sections
**And** required questions are clearly marked

### AC4: Save Progress
**Given** a vendor is completing the questionnaire
**When** they answer questions
**Then** answers are auto-saved (debounced)
**And** a visual indicator shows save status
**And** they can close and resume later
**And** saved answers are restored on return

### AC5: Submit Questionnaire
**Given** a vendor has completed all required questions
**When** they click submit
**Then** they see a confirmation modal
**And** the assessment status changes to "Submitted"
**And** the RSSI receives a notification
**And** the vendor receives a confirmation email
**And** portal access becomes read-only (can view but not edit)

### AC6: Access Expiration
**Given** a portal access token exists
**When** the deadline passes or questionnaire is submitted
**Then** the token is invalidated
**And** access attempts show an appropriate message
**And** the vendor cannot make further edits

## Tasks

### Task 1: Portal Access Types and Service ✓
**File:** `src/types/vendorPortal.ts`, `src/services/VendorPortalService.ts`

**Subtasks:**
- [x] Create VendorPortalAccess interface
- [x] Create PortalAccessToken type
- [x] Implement generatePortalAccess function
- [x] Implement validatePortalToken function
- [x] Implement expirePortalAccess function
- [x] Add sendPortalAccessEmail function

### Task 2: Vendor Portal Route and Auth ✓
**File:** `src/views/portal/VendorPortal.tsx`, `src/components/vendor-portal/PortalAuth.tsx`

**Subtasks:**
- [x] Create vendor portal route (/portal/vendor/:token)
- [x] Build minimal portal authentication component
- [x] Implement email verification step
- [x] Handle invalid/expired token states
- [x] Add organization branding display

### Task 3: Questionnaire View Component ✓
**File:** `src/components/vendor-portal/PortalQuestionnaire.tsx`

**Subtasks:**
- [x] Build section navigation sidebar
- [x] Create question rendering by type
- [x] Implement answer input components
- [x] Add progress indicator per section
- [x] Mark required questions visually
- [x] Handle validation for required fields

### Task 4: Progress Auto-Save ✓
**File:** `src/hooks/usePortalAutoSave.ts`

**Subtasks:**
- [x] Implement debounced auto-save hook
- [x] Add visual save status indicator
- [x] Handle offline/error states
- [x] Restore saved answers on load
- [x] Track completion percentage

### Task 5: Submit Flow ✓
**File:** `src/components/vendor-portal/PortalSubmit.tsx`

**Subtasks:**
- [x] Create submission confirmation modal
- [x] Validate all required questions answered
- [x] Update assessment status on submit
- [x] Send notification to RSSI
- [x] Send confirmation to vendor
- [x] Switch to read-only mode post-submit

### Task 6: i18n Translations ✓
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add vendorPortal section
- [x] Add portal auth messages
- [x] Add questionnaire labels
- [x] Add submission messages
- [x] Add expiration messages

### Task 7: Unit Tests ✓
**File:** `src/services/__tests__/VendorPortalService.test.ts`

**Subtasks:**
- [x] Test token generation
- [x] Test token validation
- [x] Test token expiration
- [x] Test access control

## Technical Notes

### Portal Access Token Structure
```typescript
interface VendorPortalAccess {
  id: string;
  assessmentId: string;
  organizationId: string;
  organizationName: string;
  vendorEmail: string;
  vendorName: string;
  token: string; // Secure random token
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'submitted' | 'expired' | 'revoked';
  lastAccessedAt?: string;
  submittedAt?: string;
}
```

### Portal Route Structure
```
/vendor-portal/:token - Main portal entry
  → Token validation
  → Email verification (if needed)
  → Questionnaire display
  → Submission flow
```

### Security Considerations
- Token is a secure random string (32+ bytes)
- Token cannot be used to access other platform features
- Access is scoped to single assessment only
- All portal actions logged for audit
- Rate limiting on portal access attempts
- HTTPS only for portal URLs

### Email Templates
1. **Portal Access Email**
   - Organization name requesting assessment
   - Direct link to portal
   - Deadline reminder
   - Support contact

2. **Submission Confirmation**
   - Thank you message
   - Summary of completion
   - Next steps info

### Firestore Structure
```
organizations/{orgId}/portal_access/{accessId}
  - token: string
  - assessmentId: string
  - vendorEmail: string
  - status: string
  - expiresAt: timestamp
```

### Auto-Save Strategy
- Debounce: 2 seconds after last change
- Save individual question answers
- Update completion percentage
- Show "Saving..." / "Saved" / "Error" states

## Definition of Done

- [x] Portal access tokens can be generated and sent
- [x] Vendors can authenticate with minimal friction
- [x] Questionnaire displays correctly with all question types
- [x] Progress auto-saves with visual feedback
- [x] Submission flow works with notifications
- [x] Access properly expires
- [x] French and English translations
- [x] Unit tests passing (57 tests)
- [x] No TypeScript errors

## Dependencies

### Requires
- Story 37-1: Vendor Assessment Creation (completed)
- Existing email infrastructure
- Firebase Auth capabilities

### Enables
- Story 37-3: Automated Vendor Scoring
- Story 37-4: Vendor Concentration Dashboard

## Dev Agent Record

### Implementation Plan
Implemented vendor self-service portal with:
1. Token-based access management
2. Email verification flow (6-digit codes)
3. Section-by-section questionnaire navigation
4. Debounced auto-save with 2-second delay
5. Submission flow with confirmation modal
6. Read-only mode for submitted questionnaires

### Debug Log
No issues encountered.

### Completion Notes
**Implemented Features:**
- `VendorPortalAccess` type with full lifecycle (active → submitted/expired/revoked)
- `VendorPortalService` with token generation, validation, and answer management
- `PortalAuth` component with 6-digit email verification
- `PortalQuestionnaire` component with section navigation and question rendering
- `PortalSubmit` modal for submission confirmation
- `usePortalAutoSave` hook with debounced saves and error recovery
- Complete i18n support (FR/EN) with 64 translation keys
- 57 unit tests covering all utility functions

**Portal Flow:**
1. Vendor clicks unique link → Token validated
2. Email verification with 6-digit code
3. Questionnaire displayed with sections
4. Auto-save as vendor answers questions
5. Submit → Read-only access

## File List

**New Files Created:**
- `src/types/vendorPortal.ts` - Portal types and utility functions
- `src/services/VendorPortalService.ts` - Portal service with Firestore operations
- `src/views/portal/VendorPortal.tsx` - Main portal view
- `src/components/vendor-portal/PortalAuth.tsx` - Email verification component
- `src/components/vendor-portal/PortalQuestionnaire.tsx` - Questionnaire view
- `src/components/vendor-portal/PortalSubmit.tsx` - Submission modal
- `src/hooks/usePortalAutoSave.ts` - Auto-save hook
- `src/services/__tests__/VendorPortalService.test.ts` - Unit tests (57 tests)

**Modified Files:**
- `src/App.tsx` - Added vendor portal route
- `public/locales/fr/translation.json` - Added vendorPortal section
- `public/locales/en/translation.json` - Added vendorPortal section

## Change Log

- 2026-01-21: Story implementation completed
  - All 7 tasks completed
  - 57 tests passing
  - Full i18n support

---

**Story File Created:** 2026-01-21
**Story Completed:** 2026-01-21
**Author:** Claude (Dev Agent)
**Version:** 1.0
