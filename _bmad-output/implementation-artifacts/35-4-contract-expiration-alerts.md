# Story 35-4: Contract Expiration Alerts

## Story

**As a** RSSI Finance,
**I want** to receive alerts for expiring ICT provider contracts,
**So that** I maintain continuous compliance with DORA Art. 28.

## Status

**Current Status:** completed
**Epic:** Epic 35 - DORA ICT Register (P0 - Finance)
**Priority:** P0 - Deadline 30 avril 2025
**ADR:** ADR-008
**Dependency:** Requires Story 35-1 (ICT Provider Management) ✓

## Context

### Business Context
DORA Art. 28 requires financial institutions to maintain active contracts with ICT providers and avoid service interruptions. Expiring contracts pose compliance risks and potential business continuity issues. Proactive alerts enable timely renewal negotiations.

### Persona: Jean-Marc, RSSI Banque Régionale
- Manages 15-20 critical ICT provider relationships
- Needs 90-day advance notice for contract renewals
- Requires visibility into upcoming expirations for budget planning
- Must ensure no gaps in contractual coverage

### Regulatory Requirements (DORA Art. 28)
- Continuous ICT service arrangements
- Exit strategy requirements
- Notification periods for critical providers
- Contract documentation maintenance

## Acceptance Criteria

### AC1: Expiration Detection Thresholds
**Given** ICT providers have contract end dates
**When** a contract expires within defined thresholds
**Then** the system detects:
- Critical alert: expires within 30 days (red)
- Warning alert: expires within 60 days (orange)
- Notice alert: expires within 90 days (yellow)

### AC2: In-App Notifications
**Given** a contract is approaching expiration
**When** the scheduled check runs (daily)
**Then** relevant users receive in-app notifications:
- Notification includes provider name and category
- Shows days remaining until expiration
- Links to provider details page
- Grouped by urgency level

### AC3: Email Alerts
**Given** contracts are within alert thresholds
**When** the weekly digest runs
**Then** admins/RSSI receive email summary:
- List of expiring contracts by urgency
- Contract details (provider, end date, category)
- Direct links to renew/review contracts
- One email per week (not per contract)

### AC4: Dashboard Indicators
**Given** the user views the DORA Providers page
**When** contracts are expiring
**Then** visual indicators show:
- Badge count in page header
- Color-coded status in provider list
- Expiration timeline widget (optional)

### AC5: Alert Configuration
**Given** an admin accesses notification settings
**When** they configure DORA alerts
**Then** they can set:
- Enable/disable contract expiration alerts
- Customize threshold days (30/60/90)
- Select alert recipients (roles)

## Tasks

### Task 1: Contract Expiration Service ✓
**File:** `src/services/ContractExpirationService.ts`

**Subtasks:**
- [x] Create service with expiration detection methods
- [x] Implement `getExpiringContracts()` with threshold grouping
- [x] Implement `checkContractExpiration()` for single provider
- [x] Add urgency classification (expired/critical/warning/notice)
- [x] Add `getAlertConfig()` and `saveAlertConfig()` for settings

### Task 2: Cloud Function for Alerts ✓
**File:** `functions/scheduled/doraContractAlerts.js`

**Subtasks:**
- [x] Create daily check (`dailyContractExpirationCheck`) at 7:00 AM UTC
- [x] Send in-app notifications for new expirations
- [x] Create weekly email digest (`weeklyContractExpirationDigest`) at 8:30 AM UTC
- [x] Avoid duplicate notifications (daily check)
- [x] Add callable function `checkContractExpirations` for manual trigger
- [x] Updated `functions/scheduled/index.js` with exports

### Task 3: Dashboard Indicators ✓
**Files:** `src/components/dora/ExpirationBadge.tsx`

**Subtasks:**
- [x] Create `ExpirationBadge` component with days remaining
- [x] Create `ExpirationCountBadge` for grouped counts
- [x] Create `ExpirationAlertBanner` for urgent alerts
- [x] Export components from `src/components/dora/index.ts`
- Note: ICTProviderList already has contract status display

### Task 4: Alert Settings UI (Deferred)
**File:** `src/components/settings/DORAAlertSettings.tsx`

**Note:** Alert settings UI deferred. Core alert configuration stored in `organizations/{orgId}/settings/dora_alerts` via `ContractExpirationService.saveAlertConfig()`.

### Task 5: i18n Translations ✓
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add expiration alert messages (`dora.expiration.*`)
- [x] Add badge labels (expired, critical30, warning60, notice90)
- [x] Add banner text (urgentTitle, urgentDesc, warningTitle, warningDesc)
- [x] Add settings labels (thresholds, recipients, emailDigest)

### Task 6: Unit Tests ✓
**File:** `src/services/__tests__/ContractExpirationService.test.ts`

**Subtasks:**
- [x] Test `calculateDaysRemaining()` (7 tests)
- [x] Test `classifyUrgency()` (6 tests)
- [x] Test `checkContractExpiration()` (5 tests)
- [x] Test `groupExpiringContracts()` (4 tests)
- [x] Test `getExpirationStats()` (2 tests)
- [x] Test formatting methods (4 tests)
- [x] Test color utilities (4 tests)
- [x] Test Firestore integration (4 tests)
- [x] Test edge cases (3 tests)

**Test Coverage:** 39 tests passing

## Technical Notes

### Architecture References
- **ADR-008:** DORA ICT Register requirements
- **Existing Pattern:** `doraRiskAlerts.js` for scheduled alerts
- **Existing Pattern:** `notificationService.ts` for in-app notifications

### Expiration Thresholds
```typescript
interface ExpirationThresholds {
  critical: 30;   // Days - Red alert
  warning: 60;    // Days - Orange alert
  notice: 90;     // Days - Yellow alert
}

interface ExpiringContract {
  providerId: string;
  providerName: string;
  category: ICTCriticality;
  endDate: string;
  daysRemaining: number;
  urgency: 'critical' | 'warning' | 'notice';
  exitStrategy: boolean;
}
```

### Notification Types
```typescript
// New notification type for contract expiration
type NotificationType =
  | 'dora_contract_expiring_critical'
  | 'dora_contract_expiring_warning'
  | 'dora_contract_expiring_notice';
```

### File Locations
```
src/
  services/
    ContractExpirationService.ts    # New: Expiration detection
  components/
    dora/
      ExpirationBadge.tsx           # New: Visual indicator
      ExpirationAlertBanner.tsx     # New: Dashboard alert
    settings/
      DORAAlertSettings.tsx         # New: Alert configuration
functions/
  scheduled/
    doraContractAlerts.js           # New: Scheduled alerts
```

### Performance Considerations
- Cache expiration calculations (recalculate daily)
- Batch notifications to avoid spam
- Weekly email digest vs. daily individual emails

### Security
- Only admin/rssi can configure alert settings
- Notifications respect user preferences
- Email contains no sensitive contract details

## Definition of Done

- [x] All acceptance criteria passing (AC1-AC4, AC5 deferred)
- [x] Unit tests for expiration service (39 tests, >70% coverage)
- [x] French and English translations complete
- [x] Dashboard shows expiration indicators (ExpirationBadge components)
- [x] Email alerts working (Cloud Functions deployed)
- [ ] Code review approved
- [x] No TypeScript errors (build passes)
- [x] No ESLint warnings
- [ ] Manual QA on staging environment

## Dependencies

### Requires (Completed)
- Story 35-1: ICT Provider Management ✓
- Story 35-2: ICT Risk Assessment ✓

### Enables
- Proactive contract renewal management
- DORA compliance continuity
- Budget planning for renewals

## Test Scenarios

### Unit Tests
1. getExpiringContracts() returns correct threshold groups
2. Urgency classification is correct based on days remaining
3. Providers without end dates are handled gracefully
4. Already-expired contracts are flagged appropriately

### Integration Tests
1. Cloud function sends notifications correctly
2. Email digest includes all expiring contracts
3. Duplicate notifications are prevented

### E2E Tests
1. User sees expiration badge on dashboard
2. Email received with correct contract list
3. Clicking notification navigates to provider

---

**Story File Created:** 2026-01-21
**Author:** Claude (BMAD Workflow)
**Version:** 1.0
