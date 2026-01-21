# Story 38-3: Homologation Validity Tracking

## Story

**As a** RSSI Collectivité,
**I want** to track homologation validity periods,
**So that** I renew before expiration.

## Status

**Current Status:** dev-complete
**Epic:** Epic 38 - ANSSI Homologation (P0 - Public Sector)
**Priority:** P0 - Strong demand from public sector
**ADR:** ADR-011
**Dependency:** Requires Story 38-2 (Homologation Document Generation) ✓

## Context

### Business Context
French public sector entities must maintain valid homologations for their information systems. Homologations have defined validity periods (typically 3-5 years) and must be renewed before expiration. The RSSI needs proactive alerts to initiate renewal processes in time.

### Persona: Marie-Claire, RSSI Collectivité Territoriale
- Manages multiple homologated systems
- Needs visibility into upcoming expirations
- Wants automated reminders at 90/60/30 days
- Must track historical homologations for audits

## Acceptance Criteria

### AC1: Validity Period Tracking
**Given** a system is homologated
**When** the validity period is set
**Then** start, end, and renewal dates are tracked
**And** remaining days until expiration are calculated
**And** status reflects current validity state

### AC2: Expiration Alerts
**Given** a homologation is approaching expiration
**When** the alert threshold is reached (90/60/30 days)
**Then** visual indicators show urgency level
**And** configurable alert notifications are triggered
**And** alerts are displayed in dashboard widgets

### AC3: Renewal Workflow
**Given** an expiration alert is displayed
**When** the user clicks "Initiate Renewal"
**Then** a new draft dossier is created
**And** it references the expiring homologation
**And** previous answers are pre-filled

### AC4: Historical Tracking
**Given** a homologation expires or is revoked
**When** viewing the dossier history
**Then** all previous validity periods are shown
**And** decision dates and references are preserved
**And** archive status is indicated

## Tasks

### Task 1: Validity Service Methods ✓
**File:** `src/services/HomologationService.ts`

**Subtasks:**
- [x] Add `getExpiringDossiers()` method
- [x] Add `getDossiersNeedingRenewal()` method
- [x] Add `initializeRenewal()` method
- [x] Add `getValidityStats()` method

### Task 2: Validity Dashboard Widget ✓
**File:** `src/components/homologation/HomologationValidityWidget.tsx`

**Subtasks:**
- [x] Create expiration timeline view
- [x] Add urgency indicators (critical/warning/ok)
- [x] Add quick action buttons
- [x] Show countdown to expiration

### Task 3: Renewal Dialog ✓
**File:** `src/components/homologation/RenewalDialog.tsx`

**Subtasks:**
- [x] Create renewal initiation dialog
- [x] Pre-fill from expiring dossier
- [x] Link to previous homologation
- [x] Navigate to new dossier

### Task 4: Alert Configuration ✓
**File:** `src/services/HomologationService.ts`

**Subtasks:**
- [x] Configure alert thresholds (days) via updateRenewalAlertDays()
- [x] Automatic expiration checking via checkAndUpdateExpiredDossiers()
- [x] Validity state tracking with configurable thresholds

### Task 5: Update Homologation View ✓
**File:** `src/views/Homologation.tsx`

**Subtasks:**
- [x] Add validity widget to dashboard
- [x] Add "Expiring Soon" filter
- [x] Add renewal quick action

### Task 6: i18n Translations ✓
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add validity-related labels
- [x] Add alert messages
- [x] Add renewal labels

### Task 7: Unit Tests ✓
**File:** `src/services/__tests__/HomologationService.test.ts`

**Subtasks:**
- [x] Test expiration calculations
- [x] Test renewal initialization
- [x] Test validity stats

## Technical Notes

### Validity States
```typescript
type ValidityState = 'active' | 'expiring_soon' | 'critical' | 'expired';

function getValidityState(endDate: Date): ValidityState {
  const daysRemaining = differenceInDays(endDate, new Date());
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 30) return 'critical';
  if (daysRemaining <= 90) return 'expiring_soon';
  return 'active';
}
```

### Alert Thresholds
- **Warning (Yellow):** 90 days before expiration
- **Urgent (Orange):** 60 days before expiration
- **Critical (Red):** 30 days before expiration

### Renewal Process
1. User initiates renewal from expiring dossier
2. System creates new draft dossier with:
   - Same system scope and name (+ "Renouvellement")
   - Previous level as default
   - Link to previous dossier for reference
3. User can modify level if requirements changed
4. Full document generation workflow applies

## Definition of Done

- [x] All acceptance criteria passing (AC1-AC4)
- [x] Unit tests for validity calculations
- [x] French and English translations
- [x] Validity widget functional
- [x] Renewal workflow working
- [ ] Code review approved
- [x] No TypeScript errors
- [x] No ESLint warnings
- [ ] Manual QA on staging

## Dependencies

### Requires (Completed)
- Story 38-1: Homologation Level Selector ✓
- Story 38-2: Homologation Document Generation ✓

### Enables
- Story 38-4: EBIOS-Homologation Link

---

**Story File Created:** 2026-01-21
**Author:** Claude (BMAD Workflow)
**Version:** 1.0
