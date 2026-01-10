# Story 2.4: RSSI Risk & Incident View

Status: done

## Story

As a **RSSI**,
I want **to see my critical risks and active incidents**,
So that **I can prioritize my security work**.

## Acceptance Criteria

1. **Given** the user has role "rssi"
   **When** they view their dashboard
   **Then** widgets show: Risques Critiques (count + list), Incidents Actifs, Actions Assignees

2. **Given** the RSSI dashboard is displayed
   **When** viewing the risks widget
   **Then** risks are sorted by criticality (impact x probability)

3. **Given** the RSSI dashboard is displayed
   **When** clicking an item
   **Then** navigation to its detail page occurs

4. **Given** the data changes in Firestore
   **When** viewing the dashboard
   **Then** counts update in real-time

## Tasks / Subtasks

- [x] **Task 1: Create RSSICriticalRisksWidget component** (AC: 1, 2, 3)
  - [x] 1.1 Create `src/components/dashboard/RSSICriticalRisksWidget.tsx`
  - [x] 1.2 Display critical risks count prominently
  - [x] 1.3 Show list of top 5 critical risks with title, category, criticality
  - [x] 1.4 Sort risks by criticality (impact x probability) descending
  - [x] 1.5 Add click handler to navigate to risk detail
  - [x] 1.6 Handle loading and empty states

- [x] **Task 2: Create RSSIIncidentsWidget component** (AC: 1, 3, 4)
  - [x] 2.1 Create `src/components/dashboard/RSSIIncidentsWidget.tsx`
  - [x] 2.2 Display active incidents count
  - [x] 2.3 Show list of recent active incidents
  - [x] 2.4 Add click handler to navigate to incident detail
  - [x] 2.5 Handle loading and empty states

- [x] **Task 3: Create RSSIActionsWidget component** (AC: 1, 3)
  - [x] 3.1 Create `src/components/dashboard/RSSIActionsWidget.tsx`
  - [x] 3.2 Display assigned actions count (overdue highlighted)
  - [x] 3.3 Show list of pending actions with deadlines
  - [x] 3.4 Highlight overdue actions in red
  - [x] 3.5 Add click handler to navigate to action detail

- [x] **Task 4: Create hooks for RSSI data** (AC: 1, 4)
  - [x] 4.1 Create `src/hooks/useActiveIncidents.ts` for incident count
  - [x] 4.2 Create `src/hooks/useAssignedActions.ts` for action count
  - [x] 4.3 Implement real-time updates with onSnapshot
  - [x] 4.4 Add loading and error states

- [x] **Task 5: Create RSSIDashboardWidget assembly** (AC: 1, 2, 3, 4)
  - [x] 5.1 Create `src/components/dashboard/RSSIDashboardWidget.tsx`
  - [x] 5.2 Compose all 3 widgets in responsive grid
  - [x] 5.3 Add role check for rssi role visibility
  - [x] 5.4 Handle combined loading/error states

- [x] **Task 6: Write unit tests** (AC: all)
  - [x] 6.1 Test RSSICriticalRisksWidget renders with different data
  - [x] 6.2 Test RSSIIncidentsWidget renders correctly
  - [x] 6.3 Test RSSIActionsWidget with overdue highlighting
  - [x] 6.4 Test hooks return correct data
  - [x] 6.5 Test RSSIDashboardWidget composition
  - [x] 6.6 Test role-based visibility

## Dev Notes

### Architecture Compliance (ADR-004)

Cette story implemente la **vue RSSI** de ADR-004: Dashboard Configurable par Role.

**Pattern requis (architecture.md):**
```
Defaults par Role:
| Role | Widgets Defaut |
|------|----------------|
| rssi | risks-critical, actions-overdue, incidents-recent, controls-status |
```

### Dependencies on Story 2.1, 2.2, 2.3

**Reutiliser les composants et hooks existants:**
```typescript
// From Story 2.1
import type { TrendType } from '../types/score.types';

// From Story 2.2
import { TrendArrow } from '../components/ui/TrendSparkline';
import { getScoreColor } from '../utils/scoreUtils';

// From Story 2.3
import { KPICard } from '../components/dashboard/KPICard';
import { useCriticalRisks } from '../hooks/useCriticalRisks';
import { hasRole, isRSSI } from '../utils/roleUtils';
```

### PRD Requirements

**FR8 (prd.md):** "Les RSSI peuvent voir les risques ouverts classes par criticite"
**FR9 (prd.md):** "Les RSSI peuvent voir les incidents en cours et actions assignees"

### Existing Patterns to Follow

**Widget Component Pattern (from Story 2.3):**
```typescript
interface RSSIWidgetProps {
  organizationId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onItemClick?: (id: string) => void;
}
```

**List Item Pattern:**
```typescript
interface RiskListItem {
  id: string;
  title: string;
  category: string;
  criticality: number; // impact x probability (1-25)
  status: string;
}
```

### Design Specifications

**Widget Layout:**
```
+---------------------------+
|  COUNT (text-3xl bold)    |
|  Title                    |
|  +---------------------+  |
|  | Item 1          >   |  |
|  | Item 2          >   |  |
|  | Item 3          >   |  |
|  +---------------------+  |
|  [Voir tout]              |
+---------------------------+
```

**Criticality Color Coding:**
- Critical (20-25): bg-red-100 text-red-800
- High (15-19): bg-orange-100 text-orange-800
- Medium (10-14): bg-yellow-100 text-yellow-800
- Low (1-9): bg-green-100 text-green-800

**Overdue Actions:**
- Overdue: text-red-600, badge "En retard"
- Due soon (< 7 days): text-orange-600
- Normal: text-gray-600

### File Structure

**Files to Create:**
- `src/components/dashboard/RSSICriticalRisksWidget.tsx`
- `src/components/dashboard/RSSIIncidentsWidget.tsx`
- `src/components/dashboard/RSSIActionsWidget.tsx`
- `src/components/dashboard/RSSIDashboardWidget.tsx`
- `src/hooks/useActiveIncidents.ts`
- `src/hooks/useAssignedActions.ts`

**Test Files:**
- `src/components/dashboard/__tests__/RSSICriticalRisksWidget.test.tsx`
- `src/components/dashboard/__tests__/RSSIIncidentsWidget.test.tsx`
- `src/components/dashboard/__tests__/RSSIActionsWidget.test.tsx`
- `src/components/dashboard/__tests__/RSSIDashboardWidget.test.tsx`
- `src/hooks/__tests__/useActiveIncidents.test.ts`
- `src/hooks/__tests__/useAssignedActions.test.ts`

### Firestore Queries

**Critical Risks Query (reuse from Story 2.3):**
```typescript
const criticalRisksQuery = query(
  collection(db, `tenants/${tenantId}/risks`),
  where('level', '==', 'critical'),
  where('status', 'in', ['identified', 'analyzing', 'treating']),
  orderBy('criticality', 'desc'),
  limit(5)
);
```

**Active Incidents Query:**
```typescript
const activeIncidentsQuery = query(
  collection(db, `tenants/${tenantId}/incidents`),
  where('status', '==', 'active'),
  orderBy('createdAt', 'desc'),
  limit(5)
);
```

**Assigned Actions Query:**
```typescript
const assignedActionsQuery = query(
  collection(db, `tenants/${tenantId}/actions`),
  where('assigneeId', '==', userId),
  where('status', 'in', ['pending', 'in_progress']),
  orderBy('dueDate', 'asc'),
  limit(10)
);
```

### Accessibility Requirements

- List items must be keyboard navigable
- Click targets must be at least 44x44 pixels
- Status colors must have text alternatives
- Screen reader announces "X risques critiques" etc.

### Integration Points

**This story provides:**
- RSSI-specific dashboard widgets
- Real-time risk/incident monitoring
- Action tracking for assigned tasks

**Depends on:**
- Story 2.3: KPICard, useCriticalRisks, roleUtils

**Required for:**
- Story 2.5: Project Manager Progress View (similar pattern)
- Story 2.6: Configurable Dashboard Widgets

### NE PAS implementer

- Drag-and-drop widget rearrangement (Story 2.6)
- Risk creation/editing (Epic 3)
- Incident creation/editing (future)
- Full risk register view (Story 3.5)

## References

- [Source: architecture.md#ADR-004] - Dashboard Configurable par Role
- [Source: epics.md#Story-2.4] - Story requirements
- [Source: prd.md#FR8-FR9] - RSSI requirements
- [Source: Story 2.3] - KPICard, useCriticalRisks, roleUtils patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created useCriticalRisksList hook extending useCriticalRisks with full risk details and criticality sorting
2. Created useActiveIncidents hook with Firestore real-time listener for active incidents
3. Created useAssignedActions hook with overdue detection and deadline tracking
4. Built RSSICriticalRisksWidget showing top 5 critical risks with criticality color coding
5. Built RSSIIncidentsWidget showing active incidents with severity badges
6. Built RSSIActionsWidget showing assigned actions with overdue highlighting ("En retard" badge)
7. Created RSSIDashboardWidget assembling all 3 widgets in responsive grid with role-based visibility
8. Added canViewRSSIDashboard function for role checking (rssi, admin)
9. All 102 new tests passing, 1052 total tests passing

### File List

**New Files:**
- `src/hooks/useCriticalRisksList.ts` - Hook for critical risks list with details
- `src/hooks/useActiveIncidents.ts` - Hook for active incidents count and list
- `src/hooks/useAssignedActions.ts` - Hook for assigned actions with deadline tracking
- `src/components/dashboard/RSSICriticalRisksWidget.tsx` - Critical risks widget
- `src/components/dashboard/RSSIIncidentsWidget.tsx` - Active incidents widget
- `src/components/dashboard/RSSIActionsWidget.tsx` - Assigned actions widget
- `src/components/dashboard/RSSIDashboardWidget.tsx` - RSSI dashboard assembly
- `src/hooks/__tests__/useCriticalRisksList.test.ts` - 14 tests
- `src/hooks/__tests__/useActiveIncidents.test.ts` - 13 tests
- `src/hooks/__tests__/useAssignedActions.test.ts` - 15 tests
- `src/components/dashboard/__tests__/RSSICriticalRisksWidget.test.tsx` - 12 tests
- `src/components/dashboard/__tests__/RSSIIncidentsWidget.test.tsx` - 14 tests
- `src/components/dashboard/__tests__/RSSIActionsWidget.test.tsx` - 16 tests
- `src/components/dashboard/__tests__/RSSIDashboardWidget.test.tsx` - 18 tests

**Modified Files:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Status updated

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: 3 widgets for rssi role | PASS | RSSIDashboardWidget displays RSSICriticalRisksWidget, RSSIIncidentsWidget, RSSIActionsWidget |
| AC2: Risks sorted by criticality | PASS | useCriticalRisksList sorts by criticality (impact × probability) descending |
| AC3: Click navigates to detail | PASS | onRiskClick, onIncidentClick, onActionClick handlers implemented |
| AC4: Real-time updates | PASS | All hooks use Firestore onSnapshot for real-time data |

### Test Summary

- **Total New Tests**: 102 tests
- **All Passing**: Yes
- **Coverage by Component**:
  - useCriticalRisksList: 14 tests (loading, data, sorting, color schemes)
  - useActiveIncidents: 13 tests (loading, data, severity colors)
  - useAssignedActions: 15 tests (loading, data, overdue detection, sorting)
  - RSSICriticalRisksWidget: 12 tests (rendering, clicks, states, accessibility)
  - RSSIIncidentsWidget: 14 tests (rendering, clicks, states, accessibility)
  - RSSIActionsWidget: 16 tests (rendering, clicks, overdue highlighting, states)
  - RSSIDashboardWidget: 18 tests (composition, role checking, accessibility)

### Change Log

- 2026-01-10: Story created for implementation
- 2026-01-10: Implementation completed - all 6 tasks done, 102 tests passing
- 2026-01-10: Story status changed to "review"
- 2026-01-10: Code review completed - 5 issues fixed (1 HIGH, 4 MEDIUM), status changed to "done"
