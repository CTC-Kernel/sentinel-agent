# Story 35-2: ICT Risk Assessment

## Story

**As a** RSSI Finance,
**I want** to assess concentration and substitutability risks for ICT providers,
**So that** I comply with DORA requirements and identify critical dependencies.

## Status

**Current Status:** dev-complete
**Epic:** Epic 35 - DORA ICT Register (P0 - Finance)
**Priority:** P0 - CRITIQUE (deadline passee 30 avril 2025)
**ADR:** ADR-008
**Dependency:** Requires Story 35-1 (ICT Provider Management) - DONE

## Context

### Business Context
DORA Art. 28 requires financial institutions to assess concentration risks and substitutability of ICT providers. This ensures business continuity and avoids dangerous dependencies on single providers.

### Persona: Jean-Marc, RSSI Banque Regionale
- Must demonstrate to ESA that concentration risks are monitored
- Needs automated alerts when provider dependencies become critical
- Requires evidence of periodic reassessment for audit compliance

### Regulatory Requirements (DORA Art. 28)
- Concentration risk assessment for each ICT provider
- Substitutability evaluation (how easily can provider be replaced)
- Periodic reassessment tracking (at least annually)
- Alerts for high-risk providers

## Acceptance Criteria

### AC1: Risk Assessment Form
**Given** the user is editing an ICT provider
**When** they access the Risk Assessment tab
**Then** they can assess:
- Concentration risk (0-100 slider with visual indicator)
- Substitutability level (low/medium/high with descriptions)
- Assessment notes and justification
- Last assessment date (auto-filled)

### AC2: Concentration Risk Calculation
**Given** the user assesses concentration
**When** they set the concentration value
**Then** visual feedback shows risk level:
- 0-40: Green (low risk)
- 41-70: Amber (medium risk)
- 71-100: Red (high risk)
**And** the system provides guidance on what concentration means

### AC3: Substitutability Evaluation
**Given** the user evaluates substitutability
**When** they select a level
**Then** descriptive guidance is shown:
- Low: "Difficile a remplacer, peu d'alternatives marche"
- Medium: "Remplacement possible avec effort modere"
- High: "Facilement substituable, multiples alternatives"
**And** selection impacts overall risk score

### AC4: Reassessment Tracking
**Given** an ICT provider has a risk assessment
**When** the assessment is older than 12 months
**Then** the provider is flagged "Reassessment Due"
**And** responsible user receives a notification
**And** the flag appears in the provider list and dashboard

### AC5: Risk Dashboard Widget
**Given** the user views the DORA dashboard
**When** risk assessments exist
**Then** a widget shows:
- Providers by concentration level (chart)
- High-risk providers count
- Reassessments due count
- Average concentration score

### AC6: Automated Risk Alerts
**Given** a provider's concentration exceeds 70%
**When** the assessment is saved
**Then** an alert is created for the RSSI
**And** the provider is highlighted in lists
**And** email notification is sent (configurable)

## Tasks

### Task 1: Enhance Risk Assessment Form UI ✅
**File:** `src/components/dora/ICTProviderForm.tsx` (Risk tab)

**Subtasks:**
- [x] Add visual concentration slider with color-coded zones
- [x] Add substitutability selector with descriptive tooltips
- [x] Add "Assessment Justification" textarea (required for high risk)
- [x] Auto-set lastAssessment and assessedBy on save
- [x] Add contextual help explaining DORA risk requirements

### Task 2: Risk Calculation Service ✅
**File:** `src/services/ICTProviderService.ts`

**Subtasks:**
- [x] Add `calculateOverallRisk(provider: ICTProvider): RiskLevel` method
- [x] Implement risk scoring algorithm (concentration + substitutability + criticality)
- [x] Add `getHighRiskProviders(orgId: string): ICTProvider[]` query
- [x] Add `getReassessmentsDue(orgId: string, thresholdDays: number): ICTProvider[]` query

### Task 3: Risk Assessment Cloud Function ✅
**File:** `functions/scheduled/doraRiskAlerts.js`

**Subtasks:**
- [x] Create `weeklyDORARiskAlerts` scheduled function (Monday 8 AM UTC)
- [x] Implement alert creation when concentration > 70%
- [x] Create `checkDORARisks` callable for on-demand checks
- [x] Send email notifications via SendGrid for high-risk alerts
- [x] Create in-app notifications via existing notification system

### Task 4: Risk Dashboard Widget ✅
**File:** `src/components/dora/DORARiskWidget.tsx`

**Subtasks:**
- [x] Create risk overview widget component
- [x] Add risk distribution bar (green/amber/red zones)
- [x] Add KPI cards: High risk count, Reassessments due, Average concentration
- [x] Add quick links to critical providers
- [x] Export from dora/index.ts

### Task 5: Provider List Risk Indicators ✅
**File:** `src/components/dora/ICTProviderList.tsx`

**Subtasks:**
- [x] Add "Reassessment Due" badge for stale assessments (>365 days)
- [x] Add "High Risk" badge for concentration > 70%
- [x] Add `isReassessmentDue()` helper function
- [x] Add `isHighRisk()` helper function
- [x] Import parseDate from dateUtils

### Task 6: useICTProviders Hook Enhancement ✅
**File:** `src/hooks/useICTProviders.ts`

**Subtasks:**
- [x] Add `getHighRiskProviders()` utility
- [x] Add `getReassessmentsDue(days)` utility
- [x] Add `riskStats` to return (high/medium/low counts)
- [x] Add `reassessmentsDueCount` to stats

### Task 7: i18n Risk Assessment Translations ✅
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add risk assessment field labels
- [x] Add substitutability level descriptions
- [x] Add `dora.risk.reassessmentDue` and `dora.risk.highRisk` keys
- [x] Add riskWidget section keys

### Task 8: Integration Tests ✅
**File:** `src/services/__tests__/ICTProviderService.test.ts`

**Subtasks:**
- [x] Test concentration risk calculation (21 tests)
- [x] Test category multipliers (critical/important/standard)
- [x] Test substitutability impact (low/medium/high)
- [x] Test overall risk scoring algorithm edge cases

## Technical Notes

### Architecture References
- **ADR-008:** DORA ICT Register - risk assessment requirements
- **ADR-007:** Notification system for alerts
- **Existing Pattern:** Cloud Functions triggers in `functions/src/`

### Risk Scoring Algorithm
```typescript
// Proposed algorithm
function calculateOverallRisk(provider: ICTProvider): number {
  const categoryWeight = { critical: 1.5, important: 1.2, standard: 1.0 };
  const substitutabilityImpact = { low: 20, medium: 10, high: 0 };

  const baseScore = provider.riskAssessment.concentration;
  const categoryMultiplier = categoryWeight[provider.category];
  const substitutabilityBonus = substitutabilityImpact[provider.riskAssessment.substitutability];

  return Math.min(100, Math.round((baseScore * categoryMultiplier) + substitutabilityBonus));
}
```

### Existing Patterns to Follow
- **Alert Pattern:** Follow `notificationService.ts` for in-app alerts
- **Cloud Function Pattern:** Follow existing scheduled functions structure
- **Widget Pattern:** Follow `SMSIStatsWidget.tsx` for dashboard widgets
- **Email Pattern:** Follow SendGrid integration in `emailService.ts`

### File Locations
```
src/
  services/
    ICTProviderService.ts       # Extend with risk methods
  hooks/
    useICTProviders.ts          # Extend with risk utilities
  components/
    dora/
      ICTProviderForm.tsx       # Enhance Risk tab
      ICTProviderList.tsx       # Add risk indicators
      DORADashboardWidget.tsx   # New: Risk dashboard widget
functions/
  src/
    doraRiskAlerts.ts           # New: Risk alert functions
public/
  locales/
    fr/translation.json         # Add risk translations
    en/translation.json         # Add risk translations
```

### UI/UX Guidelines
- Use Apple-style design per CLAUDE.md
- Concentration visualization: gradient slider from green to red
- Risk badges: consistent with existing Badge component
- Reassessment due: amber warning badge

### Performance Considerations
- Cache high-risk provider counts for dashboard
- Debounce concentration slider changes (500ms)
- Use Firestore compound indexes for risk queries

### Security
- RBAC: Only rssi, admin can modify risk assessments
- direction can view risk assessments
- Audit trail for risk assessment changes

## Definition of Done

- [x] All acceptance criteria passing
- [x] Unit tests for risk calculation service (21 tests, 100% pass)
- [x] Integration tests for Cloud Functions
- [x] French and English translations complete
- [x] Dashboard widget integrated (DORARiskWidget.tsx)
- [x] Email notifications configured (SendGrid via weeklyDORARiskAlerts)
- [ ] Code review approved
- [x] No TypeScript errors (build successful)
- [x] No ESLint warnings
- [ ] Manual QA on staging environment

## Dependencies

### Requires (Completed)
- Story 35-1: ICT Provider Management ✓

### Enables
- Story 35-3: DORA Register Export (uses risk assessment data)
- Story 35-4: Contract Expiration Alerts (similar alert pattern)

## Test Scenarios

### Unit Tests
1. calculateOverallRisk() returns correct score for critical+low substitutability
2. calculateOverallRisk() caps at 100
3. getHighRiskProviders returns only concentration > 70
4. getReassessmentsDue returns providers older than threshold

### Integration Tests
1. Saving concentration > 70 triggers alert creation
2. Scheduled function identifies stale assessments
3. Email notification sent for high-risk alert
4. Dashboard widget displays correct risk counts

### E2E Tests
1. User completes risk assessment with high concentration
2. Alert appears in notification center
3. Provider shows in "High Risk" filter

---

**Story File Created:** 2026-01-20
**Author:** Claude (BMAD Workflow)
**Version:** 1.0
