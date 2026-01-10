# Story 2.2: Apple Health Style Score Gauge

Status: done

## Story

As a **dirigeant**,
I want **to see my compliance score as a visual gauge**,
So that **I understand my organization's health at a glance**.

## Acceptance Criteria

1. **Given** the user views the dashboard
   **When** the ScoreGauge component renders
   **Then** an animated circular gauge displays the score (0-100)

2. **Given** a compliance score exists
   **When** the ScoreGauge renders
   **Then** color reflects status (<50 red, 50-75 orange, >75 green)

3. **Given** score history exists
   **When** viewing the ScoreGauge
   **Then** a sparkline shows 30-day trend below the gauge

4. **Given** the user clicks on the gauge
   **When** the click handler fires
   **Then** a detailed breakdown modal/panel appears showing category scores

## Tasks / Subtasks

- [x] **Task 1: Create ScoreGauge component** (AC: 1, 2)
  - [x] 1.1 Create `src/components/ui/ScoreGauge.tsx`
  - [x] 1.2 Implement circular gauge using SVG with stroke-dasharray animation
  - [x] 1.3 Display score number in center with large typography
  - [x] 1.4 Add smooth animation on score changes (CSS transitions)
  - [x] 1.5 Make component responsive (different sizes: sm, md, lg)

- [x] **Task 2: Implement color coding logic** (AC: 2)
  - [x] 2.1 Create score color utility in `src/utils/scoreUtils.ts`
  - [x] 2.2 Implement getScoreColor(score): red (<50), orange (50-75), green (>75)
  - [x] 2.3 Apply gradient effect on gauge arc
  - [x] 2.4 Add pulse animation for critical scores (<30)

- [x] **Task 3: Create TrendSparkline component** (AC: 3)
  - [x] 3.1 Create `src/components/ui/TrendSparkline.tsx`
  - [x] 3.2 Render mini line chart from history data (last 30 days)
  - [x] 3.3 Show trend arrow indicator (up/down/stable)
  - [x] 3.4 Use lightweight SVG rendering (no heavy chart library)

- [x] **Task 4: Implement ScoreBreakdownPanel** (AC: 4)
  - [x] 4.1 Create `src/components/dashboard/ScoreBreakdownPanel.tsx`
  - [x] 4.2 Display category scores (controls, risks, audits, documents)
  - [x] 4.3 Show weight percentage for each category
  - [x] 4.4 Add mini gauges or progress bars per category
  - [x] 4.5 Include calculation details if available

- [x] **Task 5: Integrate with useComplianceScore hook** (AC: 1, 3, 4)
  - [x] 5.1 Create `src/components/dashboard/ComplianceScoreWidget.tsx`
  - [x] 5.2 Use useComplianceScore hook from Story 2.1
  - [x] 5.3 Handle loading state with skeleton
  - [x] 5.4 Handle error state with retry option
  - [x] 5.5 Wire click handler to open breakdown panel

- [x] **Task 6: Write unit tests** (AC: all)
  - [x] 6.1 Test ScoreGauge renders correctly with different scores
  - [x] 6.2 Test color logic returns correct colors for score ranges
  - [x] 6.3 Test TrendSparkline renders history data
  - [x] 6.4 Test ScoreBreakdownPanel displays all categories
  - [x] 6.5 Test ComplianceScoreWidget integration with hook

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Export TrendArrow component for reusability [TrendSparkline.tsx:30]

## Dev Notes

### Architecture Compliance (ADR-003)

Cette story implémente la partie **visualisation** de ADR-003: Score de Conformité Global (Apple Health Style).

**Pattern requis (architecture.md):**
```
Visualisation (Frontend):
- Composant `ScoreGauge` - cercle animé
- Couleurs: <50 rouge, 50-75 orange, >75 vert
- Sparkline tendance 30 jours
```

### Dependencies on Story 2.1

**Utiliser les types et hooks de Story 2.1:**
```typescript
import { useComplianceScore } from '../hooks/useComplianceScore';
import type { ComplianceScore, ScoreHistory, TrendType } from '../types/score.types';
```

### Existing Patterns to Follow

**UI Component Pattern (from src/components/ui/):**
```typescript
interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showAnimation?: boolean;
  className?: string;
}

export function ScoreGauge({ score, size = 'md', showAnimation = true, className }: ScoreGaugeProps) {
  // Implementation
}
```

**Color Tokens (from tailwind.config.js):**
- Red: `text-red-500` / `stroke-red-500`
- Orange: `text-orange-500` / `stroke-orange-500`
- Green: `text-green-500` / `stroke-green-500`

### Design Specifications

**ScoreGauge Dimensions:**
- sm: 80px diameter
- md: 120px diameter (default)
- lg: 180px diameter

**Animation:**
- Use CSS transition for score changes: `transition: stroke-dashoffset 1s ease-out`
- Entry animation: gauge fills from 0 to actual score

**Typography:**
- Score number: font-bold, text-3xl (lg), text-2xl (md), text-xl (sm)
- Use Apple system fonts (SF Pro) as per project CLAUDE.md

### SVG Gauge Implementation

```typescript
// Circular gauge math
const radius = 45; // For 100px viewBox
const circumference = 2 * Math.PI * radius;
const strokeDashoffset = circumference - (score / 100) * circumference;
```

### File Structure

**Files to Create:**
- `src/components/ui/ScoreGauge.tsx` - Main gauge component
- `src/components/ui/TrendSparkline.tsx` - Mini sparkline chart
- `src/components/dashboard/ScoreBreakdownPanel.tsx` - Breakdown modal/panel
- `src/components/dashboard/ComplianceScoreWidget.tsx` - Full widget assembly
- `src/utils/scoreUtils.ts` - Color and utility functions

**Test Files:**
- `src/components/ui/__tests__/ScoreGauge.test.tsx`
- `src/components/ui/__tests__/TrendSparkline.test.tsx`
- `src/components/dashboard/__tests__/ScoreBreakdownPanel.test.tsx`
- `src/components/dashboard/__tests__/ComplianceScoreWidget.test.tsx`
- `src/utils/__tests__/scoreUtils.test.ts`

### Accessibility Requirements

- Gauge must have `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Color-coded information must have text alternative (trend label)
- Clickable gauge needs keyboard accessibility

### References

- [Source: architecture.md#ADR-003] - Score de Conformité Global decision
- [Source: epics.md#Story-2.2] - Story requirements
- [Source: Story 2.1] - ComplianceScore types and useComplianceScore hook
- [Source: CLAUDE.md] - Apple typography requirements

### Integration Points

**This story provides:**
- Visual score display for dashboard (Story 2.3-2.6)
- Reusable ScoreGauge for other contexts

**NE PAS implémenter:**
- Dashboard layout (Story 2.3+)
- Widget drag-and-drop (Story 2.6)
- Framework-specific gauges (future)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Implemented ScoreGauge component with SVG circular gauge using stroke-dasharray animation
2. Created scoreUtils with SCORE_THRESHOLDS constants and color utility functions
3. Implemented TrendSparkline component with lightweight SVG rendering and trend arrows
4. Created ScoreBreakdownPanel displaying category scores with progress bars and calculation details
5. Built ComplianceScoreWidget integrating all components with useComplianceScore hook
6. Added comprehensive unit tests (79 tests) covering all components and utilities
7. All components follow accessibility requirements (role="meter", aria attributes, keyboard navigation)
8. Components support three sizes (sm: 80px, md: 120px, lg: 180px) as per design specs

**Code Review Fixes (2026-01-10):**
9. CRIT-1: Implemented gradient effect on gauge arc using SVG linearGradient
10. HIGH-1: Removed duplicate getScoreColor/getScoreStrokeColor functions, now using scoreUtils
11. HIGH-2: Fixed dead ternary code in gaugeStyle useMemo
12. HIGH-3: Replaced window.location.reload() with proper refetch function in hook
13. MED-1: Added ESC key handler to close breakdown modal
14. MED-2: Fixed duplicate min/max calculation in TrendSparkline by extracting to useMemo

### File List

**New Files:**
- `src/components/ui/ScoreGauge.tsx` - Main circular gauge component
- `src/components/ui/TrendSparkline.tsx` - Mini sparkline chart component
- `src/components/dashboard/ScoreBreakdownPanel.tsx` - Score breakdown panel
- `src/components/dashboard/ComplianceScoreWidget.tsx` - Full widget assembly
- `src/utils/scoreUtils.ts` - Score color and utility functions
- `src/components/ui/__tests__/ScoreGauge.test.tsx` - 18 tests
- `src/components/ui/__tests__/TrendSparkline.test.tsx` - 13 tests
- `src/components/dashboard/__tests__/ScoreBreakdownPanel.test.tsx` - 11 tests
- `src/components/dashboard/__tests__/ComplianceScoreWidget.test.tsx` - 13 tests
- `src/utils/__tests__/scoreUtils.test.ts` - 24 tests

**Modified Files:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Status updated
- `src/hooks/useComplianceScore.ts` - Added refetch function (code review fix)
- `src/types/score.types.ts` - Added refetch to ComplianceScoreHookResult (code review fix)
- `src/types/__tests__/score.types.test.ts` - Updated tests for refetch (code review fix)

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: Animated circular gauge | ✅ PASS | ScoreGauge renders SVG with stroke-dashoffset animation, displays score 0-100 |
| AC2: Color coding by score | ✅ PASS | getScoreStrokeColor returns red (<50), orange (50-75), green (>75) |
| AC3: 30-day sparkline | ✅ PASS | TrendSparkline renders history data with trend arrow indicator |
| AC4: Clickable breakdown | ✅ PASS | ComplianceScoreWidget opens ScoreBreakdownPanel on gauge click |

### Test Summary

- **Total Tests**: 79 new tests (847 total in project)
- **All Passing**: ✅
- **Coverage by Component**:
  - scoreUtils: 24 tests (color functions, thresholds, normalization)
  - ScoreGauge: 18 tests (rendering, sizes, accessibility, interactions)
  - TrendSparkline: 13 tests (history rendering, trend arrows, edge cases)
  - ScoreBreakdownPanel: 11 tests (categories, weights, calculation details)
  - ComplianceScoreWidget: 13 tests (loading, error, empty states, integration)

### Change Log

- 2026-01-10: Story created for implementation
- 2026-01-10: Implementation completed - all 6 tasks done, 79 tests passing
- 2026-01-10: Story status changed to "review"
- 2026-01-10: Code review completed - 6 issues fixed (1 CRIT, 3 HIGH, 2 MED), 1 LOW action item created
- 2026-01-10: Story status changed to "done"
