# Story 2.3: Executive KPI Cards

Status: done

## Story

As a **dirigeant**,
I want **to see 3 critical KPIs without technical jargon**,
So that **I can quickly assess what needs attention**.

## Acceptance Criteria

1. **Given** the user has role "direction"
   **When** they view their dashboard
   **Then** 3 KPI cards display: Score Global, Risques Critiques, Audits En Cours

2. **Given** the KPI cards are rendered
   **When** viewing the content
   **Then** each card uses simple language (no ISO jargon)

3. **Given** the KPI cards are rendered
   **When** viewing the numbers
   **Then** numbers are large and prominent

4. **Given** KPI data has trends
   **When** viewing each card
   **Then** trend arrows indicate direction (up/down/stable)

## Tasks / Subtasks

- [x] **Task 1: Create KPICard component** (AC: 2, 3, 4)
  - [x] 1.1 Create `src/components/dashboard/KPICard.tsx`
  - [x] 1.2 Implement card layout with large number display (font-bold text-4xl)
  - [x] 1.3 Add title with simple language (no jargon)
  - [x] 1.4 Add subtitle for additional context
  - [x] 1.5 Integrate trend arrow using TrendSparkline pattern from Story 2.2
  - [x] 1.6 Support different color schemes per KPI type
  - [x] 1.7 Make component responsive (sm, md, lg variants)

- [x] **Task 2: Create hooks for KPI data** (AC: 1, 4)
  - [x] 2.1 Create `src/hooks/useCriticalRisks.ts` for risk count
  - [x] 2.2 Create `src/hooks/useOngoingAudits.ts` for audit count
  - [x] 2.3 Implement trend calculation (compare to previous period)
  - [x] 2.4 Add loading and error states

- [x] **Task 3: Create ExecutiveKPIWidget component** (AC: 1, 2, 3, 4)
  - [x] 3.1 Create `src/components/dashboard/ExecutiveKPIWidget.tsx`
  - [x] 3.2 Display 3 KPICards horizontally (responsive grid)
  - [x] 3.3 Integrate useComplianceScore for Score Global
  - [x] 3.4 Integrate useCriticalRisks for Risques Critiques
  - [x] 3.5 Integrate useOngoingAudits for Audits En Cours
  - [x] 3.6 Handle loading states with skeleton
  - [x] 3.7 Handle error states with retry option

- [x] **Task 4: Define KPI configurations and labels** (AC: 2)
  - [x] 4.1 Create `src/config/kpiConfig.ts` with KPI definitions
  - [x] 4.2 Define simple French labels (no ISO/technical jargon)
  - [x] 4.3 Define color mappings per KPI status
  - [x] 4.4 Add i18n keys for future multilingual support

- [x] **Task 5: Role-based visibility** (AC: 1)
  - [x] 5.1 Add role check utility in `src/utils/roleUtils.ts`
  - [x] 5.2 Implement hasRole('direction') check
  - [x] 5.3 Conditionally render ExecutiveKPIWidget based on role

- [x] **Task 6: Write unit tests** (AC: all)
  - [x] 6.1 Test KPICard renders with different values and trends
  - [x] 6.2 Test useCriticalRisks hook returns correct count
  - [x] 6.3 Test useOngoingAudits hook returns correct count
  - [x] 6.4 Test ExecutiveKPIWidget displays all 3 cards
  - [x] 6.5 Test role-based visibility logic
  - [x] 6.6 Test loading and error states

## Dev Notes

### Architecture Compliance (ADR-004)

Cette story implémente les **KPI cards pour dirigeants** de ADR-004: Dashboard Configurable par Rôle.

**Pattern requis (architecture.md):**
```
Defaults par Rôle:
| Role | Widgets Défaut |
|------|----------------|
| direction | score-gauge, kpi-cards (3), alerts-critical |
```

**WidgetType:**
```typescript
type WidgetType = ... | 'kpi-card' | ...;
```

### Dependencies on Story 2.1 & 2.2

**Réutiliser les composants et hooks existants:**
```typescript
// From Story 2.1
import { useComplianceScore } from '../hooks/useComplianceScore';
import type { TrendType } from '../types/score.types';

// From Story 2.2
import { TrendArrow } from '../components/ui/TrendSparkline';
import { getScoreColor, getScoreLabel } from '../utils/scoreUtils';
```

### PRD Requirement FR7

**FR7 (prd.md):** "Les dirigeants peuvent voir les 3 KPIs critiques sans jargon technique"

**KPI Definitions (simple language):**
| KPI | Technical | Simple FR Label | Description |
|-----|-----------|-----------------|-------------|
| Score Global | ComplianceScore.global | "Santé Conformité" | Score de 0 à 100 |
| Risques Critiques | Risk count level=critical | "Points d'Attention" | Nombre de risques critiques |
| Audits En Cours | Audit count status=in_progress | "Contrôles Actifs" | Nombre d'audits en cours |

### Existing Patterns to Follow

**KPICard Component Pattern:**
```typescript
interface KPICardProps {
  title: string;           // Simple French label
  value: number | string;  // Large number display
  subtitle?: string;       // Additional context
  trend?: TrendType;       // up/down/stable
  trendValue?: number;     // Change percentage
  colorScheme?: 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

**Hook Pattern (from useComplianceScore):**
```typescript
interface KPIHookResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

### Design Specifications

**KPICard Layout:**
```
+---------------------------+
|  [Trend Arrow]            |
|  VALUE (text-4xl bold)    |
|  Title (text-lg)          |
|  Subtitle (text-sm muted) |
+---------------------------+
```

**Color Schemes:**
- Success (green): Score > 75, Risques = 0
- Warning (orange): Score 50-75, Risques 1-3
- Danger (red): Score < 50, Risques > 3
- Neutral (gray): Audits (no status color)

**Typography:**
- Value: font-bold text-4xl (48px)
- Title: font-semibold text-lg (18px)
- Subtitle: text-sm text-muted-foreground (14px)

### File Structure

**Files to Create:**
- `src/components/dashboard/KPICard.tsx` - Reusable KPI card component
- `src/components/dashboard/ExecutiveKPIWidget.tsx` - 3-card widget assembly
- `src/hooks/useCriticalRisks.ts` - Hook for critical risk count
- `src/hooks/useOngoingAudits.ts` - Hook for ongoing audit count
- `src/config/kpiConfig.ts` - KPI definitions and labels
- `src/utils/roleUtils.ts` - Role checking utilities

**Test Files:**
- `src/components/dashboard/__tests__/KPICard.test.tsx`
- `src/components/dashboard/__tests__/ExecutiveKPIWidget.test.tsx`
- `src/hooks/__tests__/useCriticalRisks.test.ts`
- `src/hooks/__tests__/useOngoingAudits.test.ts`
- `src/utils/__tests__/roleUtils.test.ts`

### Firestore Queries

**Critical Risks Query:**
```typescript
// Collection: tenants/{tenantId}/risks
// Filter: level === 'critical' AND status !== 'mitigated'
const criticalRisksQuery = query(
  collection(db, `tenants/${tenantId}/risks`),
  where('level', '==', 'critical'),
  where('status', 'in', ['identified', 'analyzing', 'treating'])
);
```

**Ongoing Audits Query:**
```typescript
// Collection: tenants/{tenantId}/audits
// Filter: status === 'in_progress'
const ongoingAuditsQuery = query(
  collection(db, `tenants/${tenantId}/audits`),
  where('status', '==', 'in_progress')
);
```

### Accessibility Requirements

- KPICard must have descriptive aria-label with full context
- Trend arrows must have screen reader text (e.g., "En hausse de 5%")
- Color information must have text alternative
- Cards should be keyboard navigable if clickable

### Integration Points

**This story provides:**
- KPICard component reusable for other dashboards
- Role-based widget visibility pattern
- Executive dashboard foundation

**Depends on:**
- Story 2.1: useComplianceScore hook, ComplianceScore type
- Story 2.2: TrendArrow pattern, scoreUtils

**Required for:**
- Story 2.4: RSSI Risk/Incident View (similar pattern)
- Story 2.5: Project Manager Progress View
- Story 2.6: Configurable Dashboard Widgets

### NE PAS implémenter

- Dashboard layout/grid (Story 2.6)
- Widget drag-and-drop (Story 2.6)
- Click-through to detail views (future stories)
- Email notifications for KPI thresholds (Epic 9)

## References

- [Source: architecture.md#ADR-004] - Dashboard Configurable par Rôle
- [Source: architecture.md#ADR-003] - Score de Conformité Global
- [Source: epics.md#Story-2.3] - Story requirements
- [Source: prd.md#FR7] - KPIs sans jargon technique
- [Source: Story 2.1] - useComplianceScore hook
- [Source: Story 2.2] - TrendSparkline, scoreUtils patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created KPICard component with large number display (text-4xl), trend arrows, and responsive sizes (sm, md, lg)
2. Implemented useCriticalRisks and useOngoingAudits hooks with Firestore real-time listeners
3. Created ExecutiveKPIWidget assembling 3 KPI cards in responsive grid layout
4. Built kpiConfig.ts with simple French labels ("Sante Conformite", "Points d'Attention", "Controles Actifs")
5. Implemented roleUtils.ts with hasRole, isExecutive, canViewExecutiveDashboard functions
6. Added comprehensive unit tests covering all components, hooks, and utilities
7. All 103 tests passing

### File List

**New Files:**
- `src/components/dashboard/KPICard.tsx` - Reusable KPI card component
- `src/components/dashboard/ExecutiveKPIWidget.tsx` - 3-card widget assembly
- `src/hooks/useCriticalRisks.ts` - Hook for critical risk count with real-time updates
- `src/hooks/useOngoingAudits.ts` - Hook for ongoing audit count with real-time updates
- `src/config/kpiConfig.ts` - KPI definitions, thresholds, and color mappings
- `src/utils/roleUtils.ts` - Role checking utilities
- `src/components/dashboard/__tests__/KPICard.test.tsx` - 22 tests
- `src/components/dashboard/__tests__/ExecutiveKPIWidget.test.tsx` - 14 tests
- `src/hooks/__tests__/useCriticalRisks.test.ts` - 8 tests
- `src/hooks/__tests__/useOngoingAudits.test.ts` - 8 tests
- `src/utils/__tests__/roleUtils.test.ts` - 25 tests
- `src/config/__tests__/kpiConfig.test.ts` - 26 tests

**Modified Files:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Status updated

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: 3 KPI cards for direction role | PASS | ExecutiveKPIWidget displays Score Global, Risques Critiques, Audits En Cours |
| AC2: Simple language, no jargon | PASS | Labels: "Sante Conformite", "Points d'Attention", "Controles Actifs" |
| AC3: Large prominent numbers | PASS | Values use text-4xl (48px) font-bold styling |
| AC4: Trend arrows | PASS | TrendArrow component shows up/down/stable with colors |

### Test Summary

- **Total Tests**: 103 new tests
- **All Passing**: Yes
- **Coverage by Component**:
  - KPICard: 22 tests (rendering, sizes, colors, accessibility, interactions)
  - ExecutiveKPIWidget: 14 tests (composition, loading, error, click handlers)
  - useCriticalRisks: 8 tests (loading, data, errors, refetch)
  - useOngoingAudits: 8 tests (loading, data, errors, refetch)
  - roleUtils: 25 tests (hasRole, hasAnyRole, isExecutive, canViewExecutiveDashboard)
  - kpiConfig: 26 tests (definitions, thresholds, color schemes, labels)

### Change Log

- 2026-01-10: Story created for implementation
- 2026-01-10: Implementation completed - all 6 tasks done, 103 tests passing
- 2026-01-10: Story status changed to "review"
- 2026-01-10: Code review completed - 4 issues fixed (1 HIGH, 2 MEDIUM, 1 LOW), status changed to "done"
