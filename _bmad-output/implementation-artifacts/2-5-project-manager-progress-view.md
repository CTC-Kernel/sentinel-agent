# Story 2.5: Project Manager Progress View

Status: done

## Story

As a **project_manager**,
I want **to see my project compliance progress**,
So that **I can track deadlines and milestones**.

## Acceptance Criteria

1. **Given** the user has role "project_manager"
   **When** they view their dashboard
   **Then** widgets show: Actions Overdue, Project Timeline, Milestone Progress

2. **Given** the PM dashboard is displayed
   **When** viewing actions widget
   **Then** overdue items are highlighted in red

3. **Given** the PM dashboard is displayed
   **When** viewing progress widget
   **Then** progress bars show completion percentage

4. **Given** the PM dashboard is displayed
   **When** viewing timeline widget
   **Then** upcoming deadlines are visible (next 30 days)

5. **Given** the data changes in Firestore
   **When** viewing the dashboard
   **Then** counts and progress update in real-time

## Tasks / Subtasks

- [x] **Task 1: Create PMActionsOverdueWidget component** (AC: 1, 2, 5)
  - [x] 1.1 Create `src/components/dashboard/PMActionsOverdueWidget.tsx`
  - [x] 1.2 Display overdue actions count prominently
  - [x] 1.3 Show list of overdue actions with title, deadline, days overdue
  - [x] 1.4 Highlight overdue items with red styling and "En retard" badge
  - [x] 1.5 Add click handler to navigate to action detail
  - [x] 1.6 Handle loading and empty states

- [x] **Task 2: Create PMTimelineWidget component** (AC: 1, 4, 5)
  - [x] 2.1 Create `src/components/dashboard/PMTimelineWidget.tsx`
  - [x] 2.2 Display upcoming deadlines for next 30 days
  - [x] 2.3 Show timeline visualization with dates and milestones
  - [x] 2.4 Color code by urgency (< 7 days = orange, overdue = red)
  - [x] 2.5 Add click handler to navigate to item detail
  - [x] 2.6 Handle loading and empty states

- [x] **Task 3: Create PMProgressWidget component** (AC: 1, 3, 5)
  - [x] 3.1 Create `src/components/dashboard/PMProgressWidget.tsx`
  - [x] 3.2 Display overall project completion percentage (circular gauge)
  - [x] 3.3 Show progress bars for key areas (controls, documents, actions, milestones)
  - [x] 3.4 Display milestone completion count (X/Y completed)
  - [x] 3.5 Add trend indicator for progress change
  - [x] 3.6 Handle loading and empty states

- [x] **Task 4: Create hooks for PM data** (AC: 1, 5)
  - [x] 4.1 Create `src/hooks/useOverdueActions.ts` for overdue actions
  - [x] 4.2 Create `src/hooks/useUpcomingDeadlines.ts` for timeline data
  - [x] 4.3 Create `src/hooks/useProjectProgress.ts` for progress metrics
  - [x] 4.4 Implement real-time updates with onSnapshot
  - [x] 4.5 Add loading and error states

- [x] **Task 5: Create PMDashboardWidget assembly** (AC: 1, 2, 3, 4, 5)
  - [x] 5.1 Create `src/components/dashboard/PMDashboardWidget.tsx`
  - [x] 5.2 Compose all 3 widgets in responsive grid
  - [x] 5.3 Add role check for project_manager role visibility
  - [x] 5.4 Handle combined loading/error states

- [x] **Task 6: Write unit tests** (AC: all)
  - [x] 6.1 Test PMActionsOverdueWidget renders with different data
  - [x] 6.2 Test PMTimelineWidget renders correctly
  - [x] 6.3 Test PMProgressWidget with progress bars
  - [x] 6.4 Test hooks return correct data
  - [x] 6.5 Test PMDashboardWidget composition
  - [x] 6.6 Test role-based visibility

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Add French accents to labels: "Echeance" -> "Echeance", "Controles" -> "Controles" (localization consistency)
- [ ] [AI-Review][LOW] Move `canViewPMDashboard` from PMDashboardWidget.tsx to roleUtils.ts per Dev Notes recommendation

## Dev Notes

### Architecture Compliance (ADR-004)

Cette story implemente la **vue Project Manager** de ADR-004: Dashboard Configurable par Role.

**Pattern requis (architecture.md):**
```
Defaults par Role:
| Role | Widgets Defaut |
|------|----------------|
| project_manager | actions-overdue, timeline, resources |
```

### Dependencies on Story 2.3, 2.4

**Reutiliser les composants et hooks existants:**
```typescript
// From Story 2.1
import type { TrendType } from '../types/score.types';

// From Story 2.3
import { KPICard } from '../components/dashboard/KPICard';
import { hasRole, isProjectManager } from '../utils/roleUtils';
import { KPI_COLOR_CLASSES, type KPIColorScheme } from '../config/kpiConfig';

// From Story 2.4
import { useAssignedActions, DUE_STATUS_COLOR_CLASSES } from '../hooks/useAssignedActions';
import type { ActionListItem } from '../hooks/useAssignedActions';
```

### PRD Requirements

**FR10 (prd.md):** "Les project managers peuvent voir l'avancement du projet de conformite"

### Existing Patterns to Follow (from Story 2.4)

**Widget Component Pattern:**
```typescript
interface PMWidgetProps {
  organizationId: string;
  userId?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onItemClick?: (id: string) => void;
}
```

**Progress Item Pattern:**
```typescript
interface ProgressMetrics {
  overall: number; // 0-100
  controls: { completed: number; total: number };
  documents: { completed: number; total: number };
  actions: { completed: number; total: number };
  milestones: { completed: number; total: number };
}
```

**Timeline Item Pattern:**
```typescript
interface TimelineItem {
  id: string;
  title: string;
  type: 'action' | 'milestone' | 'audit' | 'document';
  dueDate: string;
  daysUntilDue: number;
  isOverdue: boolean;
  status: string;
}
```

### Design Specifications

**Widget Layout (same as Story 2.4):**
```
+---------------------------+
|  COUNT (text-3xl bold)    |
|  Title                    |
|  +---------------------+  |
|  | Progress Bar 80%    |  |
|  | Item 1          >   |  |
|  | Item 2          >   |  |
|  +---------------------+  |
|  [Voir tout]              |
+---------------------------+
```

**Progress Bar Colors:**
- Excellent (>= 80%): bg-green-500
- Good (60-79%): bg-blue-500
- Warning (40-59%): bg-orange-500
- Critical (< 40%): bg-red-500

**Timeline Urgency Colors (reuse from Story 2.4):**
- Overdue: text-red-600, badge "En retard"
- Due soon (< 7 days): text-orange-600
- Normal: text-gray-600

### File Structure

**Files to Create:**
- `src/components/dashboard/PMActionsOverdueWidget.tsx`
- `src/components/dashboard/PMTimelineWidget.tsx`
- `src/components/dashboard/PMProgressWidget.tsx`
- `src/components/dashboard/PMDashboardWidget.tsx`
- `src/hooks/useOverdueActions.ts`
- `src/hooks/useUpcomingDeadlines.ts`
- `src/hooks/useProjectProgress.ts`

**Test Files:**
- `src/components/dashboard/__tests__/PMActionsOverdueWidget.test.tsx`
- `src/components/dashboard/__tests__/PMTimelineWidget.test.tsx`
- `src/components/dashboard/__tests__/PMProgressWidget.test.tsx`
- `src/components/dashboard/__tests__/PMDashboardWidget.test.tsx`
- `src/hooks/__tests__/useOverdueActions.test.ts`
- `src/hooks/__tests__/useUpcomingDeadlines.test.ts`
- `src/hooks/__tests__/useProjectProgress.test.ts`

### Firestore Queries

**Overdue Actions Query:**
```typescript
const overdueActionsQuery = query(
  collection(db, `tenants/${tenantId}/actions`),
  where('status', 'in', ['pending', 'in_progress']),
  where('dueDate', '<', new Date().toISOString()),
  orderBy('dueDate', 'asc'),
  limit(10)
);
```

**Upcoming Deadlines Query:**
```typescript
const thirtyDaysFromNow = new Date();
thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

const upcomingDeadlinesQuery = query(
  collection(db, `tenants/${tenantId}/actions`),
  where('status', 'in', ['pending', 'in_progress']),
  where('dueDate', '>=', new Date().toISOString()),
  where('dueDate', '<=', thirtyDaysFromNow.toISOString()),
  orderBy('dueDate', 'asc'),
  limit(20)
);
```

**Project Progress Calculation:**
```typescript
// Calculate from multiple collections
const progress = {
  controls: (compliantControls / totalControls) * 100,
  documents: (publishedDocs / totalRequiredDocs) * 100,
  actions: (completedActions / totalActions) * 100,
  overall: weighted average of above
};
```

### Role Utility Extension

**Add to roleUtils.ts:**
```typescript
export const PM_DASHBOARD_ROLES: UserRole[] = ['project_manager', 'admin'];

export function canViewPMDashboard(
  user: UserWithRole | null | undefined
): boolean {
  return hasAnyRole(user, PM_DASHBOARD_ROLES);
}
```

### Accessibility Requirements

- Progress bars must have aria-valuenow, aria-valuemin, aria-valuemax
- List items must be keyboard navigable
- Click targets must be at least 44x44 pixels
- Screen reader announces "X actions en retard" etc.
- Color coding must have text alternatives

### Integration Points

**This story provides:**
- PM-specific dashboard widgets
- Project progress visualization
- Deadline tracking and timeline view
- Overdue action monitoring

**Depends on:**
- Story 2.3: KPICard, roleUtils patterns
- Story 2.4: useAssignedActions, DUE_STATUS_COLOR_CLASSES patterns

**Required for:**
- Story 2.6: Configurable Dashboard Widgets

### NE PAS implementer

- Drag-and-drop widget rearrangement (Story 2.6)
- Project creation/editing (Epic 8)
- Milestone creation (Epic 8)
- Action creation/editing (Epic 8)
- Full project management view (Epic 8)

## References

- [Source: architecture.md#ADR-004] - Dashboard Configurable par Role
- [Source: epics.md#Story-2.5] - Story requirements
- [Source: prd.md#FR10] - PM progress requirements
- [Source: Story 2.3] - KPICard, roleUtils patterns
- [Source: Story 2.4] - RSSI widget patterns, useAssignedActions

## Dev Agent Record

### Agent Model Used
claude-opus-4-5-20251101

### Completion Notes List
- Implemented PM dashboard widgets per ADR-004 role-based dashboard configuration
- Created 3 specialized hooks for data fetching with real-time Firestore updates
- PMProgressWidget displays circular gauge with weighted progress calculation (controls 40%, documents 20%, actions 25%, milestones 15%)
- PMTimelineWidget shows timeline with overdue items sorted first, urgency color-coding
- PMActionsOverdueWidget highlights overdue actions with severity levels (critical/high/medium)
- PMDashboardWidget assembles all widgets with role check (project_manager, admin)
- All widgets follow existing patterns from Story 2.4 (RSSIDashboardWidget)
- French localization throughout all components
- Accessibility: ARIA attributes, keyboard navigation, progress bar semantics
- 89 unit tests passing across 7 test files

### Code Review Fixes Applied
- Removed unused `now` variable in useOverdueActions.ts (line 177)
- Removed unused `now` variable in useUpcomingDeadlines.ts (line 199)
- Removed unused `where` import in useProjectProgress.ts
- Removed unused `ACTIVE_STATUSES` constant in useProjectProgress.ts
- Fixed unused parameter warnings in test mocks (useProjectProgress.test.ts)
- Fixed explicit `any` type in useUpcomingDeadlines.test.ts

### File List
**Components Created:**
- `src/components/dashboard/PMActionsOverdueWidget.tsx`
- `src/components/dashboard/PMTimelineWidget.tsx`
- `src/components/dashboard/PMProgressWidget.tsx`
- `src/components/dashboard/PMDashboardWidget.tsx`

**Hooks Created:**
- `src/hooks/useOverdueActions.ts`
- `src/hooks/useUpcomingDeadlines.ts`
- `src/hooks/useProjectProgress.ts`

**Tests Created:**
- `src/components/dashboard/__tests__/PMActionsOverdueWidget.test.tsx`
- `src/components/dashboard/__tests__/PMTimelineWidget.test.tsx`
- `src/components/dashboard/__tests__/PMProgressWidget.test.tsx`
- `src/components/dashboard/__tests__/PMDashboardWidget.test.tsx`
- `src/hooks/__tests__/useOverdueActions.test.ts`
- `src/hooks/__tests__/useUpcomingDeadlines.test.ts`
- `src/hooks/__tests__/useProjectProgress.test.ts`

### Change Log

- 2026-01-10: Story created for implementation (ready-for-dev)
- 2026-01-10: Implementation completed - all 6 tasks done, 89 tests passing, build successful
- 2026-01-10: Code review completed - fixed 6 lint issues, 2 LOW issues added as follow-ups, status -> done
