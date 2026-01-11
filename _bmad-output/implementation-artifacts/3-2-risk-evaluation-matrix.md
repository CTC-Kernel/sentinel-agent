# Story 3.2: Risk Evaluation Matrix

Status: done

## Story

As a **RSSI**,
I want **to evaluate risks using impact x probability**,
So that **I can calculate criticality**.

## Acceptance Criteria

1. **Given** the user is editing a risk
   **When** they select Impact (1-5) and Probability (1-5)
   **Then** Criticality is auto-calculated (Impact × Probability)
   **And** the calculated score appears in real-time

2. **Given** the user has selected Impact and Probability
   **When** the risk score is calculated
   **Then** a visual 5x5 matrix displays the risk position
   **And** the current position is highlighted

3. **Given** the risk score is calculated
   **When** the score is displayed
   **Then** color coding indicates severity level:
   - Green (1-4): Low risk
   - Yellow (5-9): Medium risk
   - Orange (10-15): High risk
   - Red (16-25): Critical risk

4. **Given** the user modifies Impact or Probability
   **When** the values change
   **Then** the risk level updates automatically
   **And** the matrix highlights the new position

5. **Given** the user is viewing a risk with residual values
   **When** residual Impact and Probability are set
   **Then** both initial and residual scores are displayed
   **And** the matrix shows both positions (initial with lighter color)

## Tasks / Subtasks

- [x] **Task 1: Create RiskMatrix Component** (AC: 2, 3)
  - [x] 1.1 Enhanced existing `RiskMatrixSelector.tsx` (reused instead of creating new)
  - [x] 1.2 Implement 5x5 grid with impact (Y-axis) and probability (X-axis)
  - [x] 1.3 Add color coding for each cell based on score
  - [x] 1.4 Highlight current risk position
  - [x] 1.5 Add accessibility labels for screen readers

- [x] **Task 2: Implement Score Calculation** (AC: 1, 4)
  - [x] 2.1 Create `calculateRiskScore(impact, probability)` utility
  - [x] 2.2 Create `getRiskLevelFromScore(score)` utility returning level and color
  - [x] 2.3 Integrate auto-calculation in RiskForm
  - [x] 2.4 Display calculated score next to matrix

- [x] **Task 3: Integrate Matrix into RiskForm** (AC: 1, 2)
  - [x] 3.1 Update Assessment tab to display RiskMatrix
  - [x] 3.2 Connect matrix to Impact/Probability form fields
  - [x] 3.3 Enable interactive cell selection on matrix
  - [x] 3.4 Sync matrix selection with form values

- [x] **Task 4: Add Residual Risk Display** (AC: 5)
  - [x] 4.1 Add residual score calculation
  - [x] 4.2 Show both initial and residual positions on matrix
  - [x] 4.3 Use different opacity/marker for residual position (blue dot)
  - [x] 4.4 Display score comparison (initial vs residual with arrow)

- [x] **Task 5: Enhance Visual Feedback** (AC: 3, 4)
  - [x] 5.1 Add animations for position changes (framer-motion)
  - [x] 5.2 Add tooltip on matrix cells showing score details
  - [x] 5.3 Add legend showing color-to-risk mapping
  - [x] 5.4 Ensure dark mode compatibility

- [x] **Task 6: Write Unit Tests** (AC: all)
  - [x] 6.1 Test score calculation utilities (19 tests)
  - [x] 6.2 Test risk level classification
  - [x] 6.3 Test RiskMatrixSelector component rendering (28 tests)
  - [x] 6.4 Test interactive cell selection

## Dev Notes

### Existing Infrastructure

The RiskForm already has:
- `RiskMatrixSelector` component in `src/components/risks/RiskMatrixSelector.tsx`
- `getRiskLevel` utility in `src/utils/riskUtils.ts`
- Impact/Probability sliders in Assessment tab

This story may enhance or replace the existing matrix component.

### Current RiskMatrixSelector

```typescript
// Check existing implementation at:
// src/components/risks/RiskMatrixSelector.tsx
```

### Color Scheme (from riskUtils.ts)

```typescript
export function getRiskLevel(score: number): { level: string; status: 'success' | 'warning' | 'error' | 'info' } {
  if (score <= 4) return { level: 'Faible', status: 'success' };
  if (score <= 9) return { level: 'Modéré', status: 'info' };
  if (score <= 15) return { level: 'Élevé', status: 'warning' };
  return { level: 'Critique', status: 'error' };
}
```

### Matrix Layout Reference

```
       Probability (P)
       1   2   3   4   5
    +---+---+---+---+---+
  5 | 5 |10 |15 |20 |25 |  Impact
    +---+---+---+---+---+
  4 | 4 | 8 |12 |16 |20 |
    +---+---+---+---+---+
  3 | 3 | 6 | 9 |12 |15 |
    +---+---+---+---+---+
  2 | 2 | 4 | 6 | 8 |10 |
    +---+---+---+---+---+
  1 | 1 | 2 | 3 | 4 | 5 |
    +---+---+---+---+---+
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/risks/RiskMatrixSelector.tsx` | Enhance or replace with new matrix |
| `src/components/risks/RiskForm.tsx` | Update Assessment tab integration |
| `src/utils/riskUtils.ts` | Add/verify score calculation utilities |

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/risks/RiskMatrix.tsx` | Standalone matrix visualization (if replacing) |
| `src/components/risks/__tests__/RiskMatrix.test.tsx` | Component tests |
| `src/utils/__tests__/riskUtils.test.ts` | Utility tests |

### i18n Keys

```json
{
  "risk": {
    "matrix": {
      "title": "Matrice de Risque",
      "impact": "Impact",
      "probability": "Probabilité",
      "score": "Score",
      "level": "Niveau",
      "initial": "Initial",
      "residual": "Résiduel",
      "low": "Faible",
      "moderate": "Modéré",
      "high": "Élevé",
      "critical": "Critique"
    }
  }
}
```

## References

- [Source: prd.md#FR13] - Évaluation des risques
- [Source: architecture.md] - Risk domain model
- [Source: epics.md#Story-3.2] - Story requirements
- [Existing: src/components/risks/RiskMatrixSelector.tsx] - Current matrix implementation
- [Existing: src/utils/riskUtils.ts] - Risk level utilities

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Enhanced existing RiskMatrixSelector** instead of creating a new component - aligns with DRY principles
2. Added `calculateRiskScore()` and `getRiskLevelFromScore()` utilities directly in component for colocation
3. Integrated framer-motion for smooth animations on position markers
4. Added support for residual risk display with blue marker vs white for initial
5. Score comparison with arrow (→) between initial and residual in header
6. Legend shows color boxes with score ranges
7. Position markers legend when residual values exist
8. Full accessibility with aria-label and aria-pressed attributes
9. Compact mode support for smaller displays
10. Validation warning when residual > initial in RiskForm
11. **47 unit tests** covering all acceptance criteria

### File List

| File | Action |
|------|--------|
| `src/components/risks/RiskMatrixSelector.tsx` | Modified - Enhanced with residual display, animations, legends |
| `src/components/risks/RiskForm.tsx` | Modified - Updated assessment tab integration |
| `src/components/risks/__tests__/RiskMatrixSelector.test.tsx` | Created - 28 tests |
| `src/utils/__tests__/riskUtils.test.ts` | Created - 19 tests |
