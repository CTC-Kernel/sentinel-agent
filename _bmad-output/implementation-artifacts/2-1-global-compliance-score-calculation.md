# Story 2.1: Global Compliance Score Calculation

Status: ready-for-dev

## Story

As a **system**,
I want **to calculate a global compliance score**,
So that **users can see their overall conformity status**.

## Acceptance Criteria

1. **Given** a tenant has risks, controls, documents, and audits
   **When** any of these entities change
   **Then** the compliance score is recalculated via Cloud Function

2. **Given** the compliance score is calculated
   **When** the calculation completes
   **Then** the score is cached in Firestore for fast dashboard loading

3. **Given** a compliance score exists
   **When** viewing the score
   **Then** the score ranges from 0-100

4. **Given** a compliance score exists
   **When** viewing the score details
   **Then** breakdown by category (risks, controls, docs, audits) is available

5. **Given** multiple scores have been calculated over time
   **When** viewing the dashboard
   **Then** a 30-day trend (up/down/stable) is displayed

## Tasks / Subtasks

- [ ] **Task 1: Define ComplianceScore types** (AC: 3, 4, 5)
  - [ ] 1.1 Create `src/types/score.types.ts` with ComplianceScore interface
  - [ ] 1.2 Define CategoryScore type for breakdown
  - [ ] 1.3 Define TrendType ('up' | 'down' | 'stable')
  - [ ] 1.4 Define ScoreHistory type for tracking
  - [ ] 1.5 Export types from types/index.ts

- [ ] **Task 2: Create scoreService for frontend** (AC: 2, 3, 4)
  - [ ] 2.1 Create `src/services/scoreService.ts`
  - [ ] 2.2 Implement `getComplianceScore(organizationId)` - fetch cached score
  - [ ] 2.3 Implement `getScoreHistory(organizationId, days)` - fetch historical scores
  - [ ] 2.4 Implement `subscribeToScore(organizationId, callback)` - real-time updates
  - [ ] 2.5 Add error handling with ErrorLogger pattern

- [ ] **Task 3: Create Cloud Function calculateComplianceScore** (AC: 1, 3, 4)
  - [ ] 3.1 Create `functions/callable/calculateComplianceScore.js`
  - [ ] 3.2 Implement score formula: weighted average of categories
  - [ ] 3.3 Calculate risksScore: (1 - criticalRisks/totalRisks) * 100
  - [ ] 3.4 Calculate controlsScore: implementedControls/actionableControls * 100
  - [ ] 3.5 Calculate documentsScore: validDocs/totalDocs * 100
  - [ ] 3.6 Calculate auditsScore: compliantFindings/totalFindings * 100
  - [ ] 3.7 Apply configurable weights (default: controls 40%, risks 30%, audits 20%, docs 10%)
  - [ ] 3.8 Save score to `tenants/{tenantId}/complianceScores/current`

- [ ] **Task 4: Create Firestore triggers for score recalculation** (AC: 1)
  - [ ] 4.1 Create `functions/triggers/onScoreRelevantChange.js`
  - [ ] 4.2 Add trigger for risks collection changes
  - [ ] 4.3 Add trigger for controls collection changes
  - [ ] 4.4 Add trigger for documents collection changes
  - [ ] 4.5 Add trigger for audits collection changes
  - [ ] 4.6 Implement debounce (5s) to avoid excessive recalculations
  - [ ] 4.7 Call calculateComplianceScore with tenantId

- [ ] **Task 5: Implement score history and trend** (AC: 5)
  - [ ] 5.1 Create scheduled function `dailyScoreSnapshot` to save daily history
  - [ ] 5.2 Store history in `tenants/{tenantId}/complianceScores/history/{date}`
  - [ ] 5.3 Implement trend calculation: compare current vs 30-day average
  - [ ] 5.4 Up if current > avg + 5%, Down if current < avg - 5%, else Stable

- [ ] **Task 6: Create useComplianceScore hook** (AC: 2, 3, 4, 5)
  - [ ] 6.1 Create `src/hooks/useComplianceScore.ts`
  - [ ] 6.2 Use scoreService for data fetching
  - [ ] 6.3 Implement real-time subscription with onSnapshot
  - [ ] 6.4 Return { score, breakdown, trend, history, loading, error }
  - [ ] 6.5 Memoize for performance

- [ ] **Task 7: Write unit tests** (AC: all)
  - [ ] 7.1 Test score calculation formula
  - [ ] 7.2 Test trend calculation logic
  - [ ] 7.3 Test scoreService methods
  - [ ] 7.4 Test useComplianceScore hook
  - [ ] 7.5 Test Cloud Function with Firebase emulator

## Dev Notes

### Architecture Compliance (ADR-003)

Cette story implémente **ADR-003: Score de Conformité Global (Apple Health Style)** de `architecture.md`.

**Pattern requis:**
```typescript
// src/types/score.types.ts
export interface ComplianceScore {
  global: number;        // 0-100
  byFramework: {
    iso27001: number;
    nis2: number;
    dora: number;
    rgpd: number;
  };
  trend: 'up' | 'down' | 'stable';
  lastCalculated: Timestamp;
  breakdown: {
    risks: { score: number; weight: number };
    controls: { score: number; weight: number };
    documents: { score: number; weight: number };
    audits: { score: number; weight: number };
  };
}
```

### Existing Patterns to Follow

**Cloud Functions (from functions/index.js):**
```javascript
// Use firebase-functions/v2 APIs
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
```

**Service Pattern (from src/services/dashboardService.ts):**
```typescript
export class ScoreService {
    static async getComplianceScore(organizationId: string): Promise<ComplianceScore> {
        // Implementation
    }
}
```

**Hook Pattern (from src/hooks/dashboard/useDashboardMetrics.ts):**
```typescript
export const useComplianceScore = (organizationId: string) => {
    return useMemo(() => {
        // Calculation logic
    }, [dependencies]);
};
```

### Firestore Data Structure

**Score Document Path:**
```
tenants/{tenantId}/complianceScores/current
```

**History Document Path:**
```
tenants/{tenantId}/complianceScores/history/{YYYY-MM-DD}
```

**Document Schema:**
```typescript
{
  global: 75,
  byFramework: {
    iso27001: 80,
    nis2: 70,
    dora: 65,
    rgpd: 85
  },
  trend: 'up',
  lastCalculated: Timestamp,
  breakdown: {
    risks: { score: 70, weight: 0.30 },
    controls: { score: 80, weight: 0.40 },
    documents: { score: 75, weight: 0.10 },
    audits: { score: 72, weight: 0.20 }
  },
  calculationDetails: {
    totalRisks: 50,
    criticalRisks: 5,
    implementedControls: 80,
    actionableControls: 100,
    validDocuments: 45,
    totalDocuments: 60,
    compliantFindings: 36,
    totalFindings: 50
  }
}
```

### Score Calculation Formula

**Global Score:**
```
globalScore = (controlsScore * 0.40) + (risksScore * 0.30) + (auditsScore * 0.20) + (documentsScore * 0.10)
```

**Category Scores:**
```typescript
// Controls: % of implemented vs actionable
controlsScore = (implementedControls / actionableControls) * 100;

// Risks: Inverse of critical risk ratio
risksScore = (1 - (criticalRisks / totalRisks)) * 100;

// Documents: % of valid (not expired, not draft) documents
documentsScore = (validDocuments / totalDocuments) * 100;

// Audits: % of compliant findings in last audit
auditsScore = (compliantFindings / totalFindings) * 100;
```

**Trend Calculation:**
```typescript
const avgLast30Days = history.slice(-30).reduce((sum, h) => sum + h.global, 0) / 30;
const diff = currentScore - avgLast30Days;

if (diff > 5) return 'up';
if (diff < -5) return 'down';
return 'stable';
```

### Project Structure Notes

**Files to Create:**
- `src/types/score.types.ts` - Score type definitions
- `src/services/scoreService.ts` - Frontend service
- `src/hooks/useComplianceScore.ts` - React hook
- `functions/callable/calculateComplianceScore.js` - Cloud Function
- `functions/triggers/onScoreRelevantChange.js` - Firestore triggers
- `functions/scheduled/dailyScoreSnapshot.js` - Daily snapshot

**Files to Modify:**
- `functions/index.js` - Export new functions
- `src/types/index.ts` - Export score types

### Testing Standards

**Framework:** Vitest (frontend), Jest (Cloud Functions)

**Test file locations:**
- `src/services/__tests__/scoreService.test.ts`
- `src/hooks/__tests__/useComplianceScore.test.ts`
- `functions/__tests__/calculateComplianceScore.test.js`

**Minimum coverage:** 70% (NFR-M1)

### Performance Considerations

1. **Debounce triggers**: Don't recalculate on every document change - wait 5 seconds
2. **Cache aggressively**: Store calculated score in Firestore, don't recalculate on every page load
3. **Real-time updates**: Use onSnapshot for dashboard, not polling
4. **History cleanup**: Keep only 90 days of history, archive older

### Dependencies on Epic 1

**From Story 1.1 (Locale Config):**
- Use `useLocale()` hook for formatting numbers in score display
- Format dates using `localeConfig` for lastCalculated timestamp

**From Story 1.2 (Error Messages):**
- Use `AppError` pattern for Cloud Function errors
- Localized error messages for calculation failures

### References

- [Source: architecture.md#ADR-003] - Score de Conformité Global decision
- [Source: epics.md#Story-2.1] - Story requirements
- [Source: prd.md#FR6] - Score maturité global avec tendance
- [Source: functions/index.js] - Cloud Functions patterns
- [Source: src/services/dashboardService.ts] - Service patterns
- [Source: src/hooks/dashboard/useDashboardMetrics.ts] - Hook patterns

### Integration Points

**This story provides foundation for:**
- Story 2.2: Apple Health Style Score Gauge (uses ComplianceScore)
- Story 2.3: Executive KPI Cards (uses global score)
- Story 2.4: RSSI Risk & Incident View (uses breakdown)

**NE PAS implémenter dans cette story:**
- UI visualization (Story 2.2)
- Dashboard widgets (Story 2.3-2.6)
- Framework-specific scores (future enhancement)

## Dev Agent Record

### Agent Model Used

(To be filled after implementation)

### Completion Notes List

(To be filled after implementation)

### File List

(To be filled after implementation)

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: Recalculation on entity change | Pending | |
| AC2: Cached in Firestore | Pending | |
| AC3: Score 0-100 | Pending | |
| AC4: Breakdown by category | Pending | |
| AC5: 30-day trend | Pending | |

### Test Summary

(To be filled after implementation)

### Change Log

- 2026-01-10: Story created for implementation
