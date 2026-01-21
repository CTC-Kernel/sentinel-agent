# Story 37-3: Automated Vendor Scoring

## Story

**As a** RSSI,
**I want** to see automatic risk scores for vendors,
**So that** I can prioritize high-risk relationships.

## Status

**Current Status:** completed
**Epic:** Epic 37 - Third-Party Risk Management (P1 - All Verticals)
**Priority:** P1 - 85% RSSI Gap
**ADR:** ADR-010
**Vertical:** All

## Context

### Business Context
When vendors submit their security questionnaires, RSSIs need immediate visibility into the vendor's risk posture. Manual scoring is time-consuming and inconsistent. Automated scoring calculates inherent and residual risk levels based on questionnaire responses, section weights, and question criticality. This enables RSSIs to quickly identify high-risk vendors requiring immediate attention.

### Persona: RSSI
- Receives notification when assessment is submitted
- Views calculated risk score (0-100)
- Sees inherent vs residual risk breakdown
- Compares vendors by risk level
- Configures scoring weights per template

### Brownfield Context
The codebase already has:
- `EnhancedAssessmentResponse` with `overallScore` field
- `QuestionnaireTemplate` with section weights and question weights
- `VendorPortalService` for submission handling
- Assessment status flow: Submitted → Reviewed
- Dashboard infrastructure

### What Needs to Be Built
1. Scoring algorithm with weighted calculations
2. Inherent/residual risk level assignment
3. Configurable scoring weights per template
4. Automatic score calculation on submission
5. Vendor comparison dashboard view
6. Score breakdown visualization

## Acceptance Criteria

### AC1: Automatic Score Calculation
**Given** a vendor completes their questionnaire
**When** the assessment is submitted
**Then** an automatic score is calculated (0-100)
**And** the score reflects section weights and question criticality
**And** the score is stored in the assessment record

### AC2: Risk Level Assignment
**Given** an assessment score is calculated
**When** the score is determined
**Then** an inherent risk level is assigned (Low/Medium/High/Critical)
**And** a residual risk level considers mitigating controls
**And** risk thresholds are: 0-40 Low, 41-60 Medium, 61-80 High, 81-100 Critical

### AC3: Configurable Scoring Weights
**Given** an organization uses questionnaire templates
**When** they configure scoring
**Then** they can adjust section weights (totaling 100%)
**And** they can mark questions as critical (2x weight)
**And** changes apply to future assessments only

### AC4: Score Breakdown View
**Given** an assessment has been scored
**When** the RSSI views the assessment details
**Then** they see overall score with risk level badge
**And** section-by-section score breakdown
**And** individual question scores with color coding
**And** comparison to organization average

### AC5: Vendor Comparison Dashboard
**Given** multiple vendors have been assessed
**When** the RSSI views the TPRM dashboard
**Then** vendors are displayed in a risk matrix
**And** they can sort by score, risk level, or category
**And** trend indicators show score changes over time

### AC6: Scoring on Answer Types
**Given** a questionnaire has different question types
**When** scoring is calculated
**Then** yes_no questions: Yes=100, No=0, Partial=50
**And** rating questions: Direct percentage (1-5 → 20-100)
**And** multiple_choice questions: Configurable per option
**And** text questions: Manual review required (neutral score)

## Tasks

### Task 1: Scoring Types and Utilities ✓
**File:** `src/types/vendorScoring.ts`

**Subtasks:**
- [x] Create VendorScore interface
- [x] Create SectionScore interface
- [x] Create RiskLevel type with thresholds
- [x] Create ScoringConfiguration type
- [x] Add scoring utility functions

### Task 2: Scoring Service ✓
**File:** `src/services/VendorScoringService.ts`

**Subtasks:**
- [x] Implement calculateAssessmentScore function
- [x] Implement calculateSectionScore function
- [x] Implement calculateQuestionScore function
- [x] Implement assignRiskLevel function
- [x] Add score persistence on submission
- [x] Integrate with VendorPortalService submission

### Task 3: Score Breakdown Component ✓
**File:** `src/components/vendor-scoring/ScoreBreakdown.tsx`

**Subtasks:**
- [x] Build overall score gauge (Apple Health style)
- [x] Create section score bars
- [x] Add question-level score indicators
- [x] Display risk level badge
- [x] Show comparison to average

### Task 4: Vendor Comparison View ✓
**File:** `src/components/vendor-scoring/VendorComparison.tsx`

**Subtasks:**
- [x] Build vendor risk matrix visualization
- [x] Add sorting and filtering controls
- [x] Show trend indicators
- [x] Display category breakdown
- [x] Add export functionality

### Task 5: Scoring Configuration UI ✓
**File:** `src/components/vendor-scoring/ScoringConfig.tsx`

**Subtasks:**
- [x] Build section weight editor
- [x] Add critical question marker
- [x] Create threshold configuration
- [x] Show preview of scoring impact
- [x] Save configuration per template

### Task 6: Integration with Assessment Flow ✓
**File:** `src/services/VendorPortalService.ts`

**Subtasks:**
- [x] Trigger scoring on assessment submission
- [x] Update assessment record with score
- [x] Add score display to assessment list
- [x] Show score in assessment detail drawer

### Task 7: i18n Translations ✓
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add vendorScoring section
- [x] Add risk level labels
- [x] Add score breakdown labels
- [x] Add comparison view labels

### Task 8: Unit Tests ✓
**File:** `src/services/__tests__/VendorScoringService.test.ts`

**Subtasks:**
- [x] Test score calculation algorithm
- [x] Test risk level assignment
- [x] Test section weighting
- [x] Test question type scoring
- [x] Test edge cases (empty answers, missing weights)

## Technical Notes

### Scoring Algorithm

```typescript
// Overall Score = Σ(SectionScore × SectionWeight) / Σ(SectionWeight)
// SectionScore = Σ(QuestionScore × QuestionWeight) / Σ(QuestionWeight)
// QuestionScore = based on answer type (0-100)

interface VendorScore {
  assessmentId: string;
  overallScore: number; // 0-100
  inherentRisk: RiskLevel;
  residualRisk: RiskLevel;
  sectionScores: SectionScore[];
  calculatedAt: string;
  calculatedBy: 'system' | 'manual';
}

interface SectionScore {
  sectionId: string;
  sectionTitle: string;
  score: number; // 0-100
  weight: number;
  weightedScore: number;
  questionCount: number;
  answeredCount: number;
  criticalIssues: number;
}

type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

// Default thresholds
const RISK_THRESHOLDS: Record<RiskLevel, [number, number]> = {
  Low: [0, 40],
  Medium: [41, 60],
  High: [61, 80],
  Critical: [81, 100],
};
```

### Question Scoring Logic

```typescript
function scoreYesNoQuestion(answer: string | boolean): number {
  if (answer === true || answer === 'yes' || answer === 'Oui') return 100;
  if (answer === false || answer === 'no' || answer === 'Non') return 0;
  if (answer === 'partial' || answer === 'Partiel') return 50;
  return 50; // Neutral for unanswered
}

function scoreRatingQuestion(rating: number, maxRating: number = 5): number {
  return (rating / maxRating) * 100;
}

function scoreMultipleChoice(answer: string, options: ScoringOption[]): number {
  const option = options.find(o => o.value === answer);
  return option?.score ?? 50;
}

function scoreTextQuestion(): number {
  // Text requires manual review
  return 50; // Neutral until reviewed
}
```

### Inherent vs Residual Risk

```typescript
// Inherent Risk: Raw score before controls
// Residual Risk: Score after applying mitigating factors

interface RiskContext {
  inherentRisk: RiskLevel;
  residualRisk: RiskLevel;
  mitigatingFactors: MitigatingFactor[];
}

interface MitigatingFactor {
  type: 'certification' | 'insurance' | 'audit' | 'contract';
  description: string;
  riskReduction: number; // Percentage points to subtract
}

// Example: SOC 2 certification = -10 points on risk score
```

### Dashboard Integration

The scoring integrates with existing dashboard components:
- Assessment list shows score badge
- Detail drawer shows full breakdown
- TPRM dashboard shows comparison matrix

### Performance Considerations

- Score calculation is synchronous and fast (~10ms)
- Scores are cached in assessment record
- Recalculation only on manual trigger
- Comparison aggregates are pre-computed

## Definition of Done

- [x] Scores calculated automatically on submission
- [x] Risk levels assigned correctly per thresholds
- [x] Section-by-section breakdown displayed
- [x] Vendor comparison matrix functional
- [x] Scoring weights configurable per template
- [x] French and English translations
- [x] Unit tests passing (49 tests)
- [x] No TypeScript errors

## Dependencies

### Requires
- Story 37-1: Vendor Assessment Creation (completed)
- Story 37-2: Vendor Self-Service Portal (completed)
- Existing assessment infrastructure

### Enables
- Story 37-4: Vendor Concentration Dashboard
- Enhanced TPRM reporting

## Dev Agent Record

### Implementation Plan
Implemented automated vendor scoring with:
1. Comprehensive scoring types and utility functions
2. VendorScoringService with weighted calculation algorithm
3. Apple Health-style score gauge component
4. Risk matrix and vendor comparison views
5. Scoring configuration UI for section weights
6. Automatic scoring triggered on portal submission

### Debug Log
No issues encountered.

### Completion Notes
**Implemented Features:**
- `VendorScore` type with inherent/residual risk tracking
- `VendorScoringService` with weighted scoring algorithm
- `ScoreBreakdown` component with expandable section details
- `VendorComparison` component with list and matrix views
- `ScoringConfig` for adjusting section weights
- Integration with portal submission flow
- Complete i18n support (FR/EN) with 47 translation keys
- 49 unit tests covering all scoring logic

**Scoring Algorithm:**
- Risk score: 0 = no risk, 100 = critical risk
- Display score: 100 = excellent, 0 = poor (inverted for user-friendly display)
- Risk levels: Low (0-40), Medium (41-60), High (61-80), Critical (81-100)
- Mitigating factors reduce risk score (certifications, audits, etc.)

## File List

**New Files Created:**
- `src/types/vendorScoring.ts` - Scoring types and utilities
- `src/services/VendorScoringService.ts` - Scoring calculation service
- `src/components/vendor-scoring/ScoreBreakdown.tsx` - Score visualization
- `src/components/vendor-scoring/VendorComparison.tsx` - Comparison view
- `src/components/vendor-scoring/ScoringConfig.tsx` - Configuration UI
- `src/components/vendor-scoring/index.ts` - Component exports
- `src/services/__tests__/VendorScoringService.test.ts` - Unit tests

**Modified Files:**
- `src/services/VendorPortalService.ts` - Added scoring trigger on submission
- `public/locales/fr/translation.json` - Added vendorScoring section
- `public/locales/en/translation.json` - Added vendorScoring section

## Change Log

- 2026-01-21: Story implementation completed
  - All 8 tasks completed
  - 49 tests passing
  - Full i18n support

---

**Story File Created:** 2026-01-21
**Story Completed:** 2026-01-21
**Author:** Claude (Dev Agent)
**Version:** 1.0
