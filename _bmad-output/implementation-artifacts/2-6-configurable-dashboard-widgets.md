# Story 2.6: Configurable Dashboard Widgets

Status: ready-for-dev

## Story

As a **user**,
I want **to customize my dashboard layout**,
So that **I see the information most relevant to me**.

## Acceptance Criteria

1. **Given** the user clicks "Personnaliser" on their dashboard
   **When** the edit mode activates
   **Then** widgets become draggable and sortable

2. **Given** edit mode is active
   **When** the user clicks "Ajouter un widget"
   **Then** a widget catalog modal opens showing available widgets

3. **Given** edit mode is active
   **When** the user clicks remove on a widget
   **Then** the widget is removed from their layout

4. **Given** the user modifies their dashboard layout
   **When** they exit edit mode
   **Then** the layout is saved to their Firestore profile

5. **Given** the user has customized their dashboard
   **When** they click "Reinitialiser"
   **Then** role-based defaults are restored

## Tasks / Subtasks

- [ ] **Task 1: Register new widgets in WidgetRegistry** (AC: 2)
  - [ ] 1.1 Add `compliance-score` widget (ComplianceScoreWidget from Story 2-2)
  - [ ] 1.2 Add `executive-kpi` widget (ExecutiveKPIWidget from Story 2-3)
  - [ ] 1.3 Add `rssi-critical-risks` widget (RSSICriticalRisksWidget from Story 2-4)
  - [ ] 1.4 Add `rssi-incidents` widget (RSSIIncidentsWidget from Story 2-4)
  - [ ] 1.5 Add `rssi-actions` widget (RSSIActionsWidget from Story 2-4)
  - [ ] 1.6 Add `pm-actions-overdue` widget (PMActionsOverdueWidget from Story 2-5)
  - [ ] 1.7 Add `pm-timeline` widget (PMTimelineWidget from Story 2-5)
  - [ ] 1.8 Add `pm-progress` widget (PMProgressWidget from Story 2-5)
  - [ ] 1.9 Export i18n translation keys for new widgets

- [ ] **Task 2: Create role-based default layouts config** (AC: 5)
  - [ ] 2.1 Create `src/config/dashboardDefaults.ts` per ADR-004
  - [ ] 2.2 Define direction defaults: compliance-score, executive-kpi, health-check
  - [ ] 2.3 Define rssi defaults: rssi-critical-risks, rssi-incidents, rssi-actions, risk-heatmap
  - [ ] 2.4 Define project_manager defaults: pm-actions-overdue, pm-timeline, pm-progress
  - [ ] 2.5 Define auditor defaults: audits-donut, compliance-progress, documents-stats
  - [ ] 2.6 Define default layout for other roles (user, admin)

- [ ] **Task 3: Implement Firestore persistence** (AC: 4)
  - [ ] 3.1 Create `tenants/{tenantId}/dashboardConfigs/{userId}` Firestore document structure
  - [ ] 3.2 Update `useDashboardPreferences.ts` to use Firestore with localStorage fallback
  - [ ] 3.3 Add real-time sync with `onSnapshot` for cross-device updates
  - [ ] 3.4 Add debounced auto-save on layout change (1 second delay)
  - [ ] 3.5 Handle offline mode with localStorage queue

- [ ] **Task 4: Create DashboardEditModeToggle component** (AC: 1, 5)
  - [ ] 4.1 Create `src/components/dashboard/DashboardEditModeToggle.tsx`
  - [ ] 4.2 Add "Personnaliser" button that activates edit mode
  - [ ] 4.3 Add "Terminer" button to exit edit mode
  - [ ] 4.4 Add "Reinitialiser" button to reset to role defaults
  - [ ] 4.5 Show edit mode indicator (visual feedback)

- [ ] **Task 5: Create ConfigurableDashboard page integration** (AC: 1, 2, 3, 4, 5)
  - [ ] 5.1 Create `src/components/dashboard/ConfigurableDashboard.tsx`
  - [ ] 5.2 Integrate role-based default layouts from dashboardDefaults
  - [ ] 5.3 Wire up edit mode toggle with ConfigurableDashboardGrid
  - [ ] 5.4 Wire up AddWidgetModal with updated WidgetRegistry
  - [ ] 5.5 Integrate Firestore persistence via useDashboardPreferences
  - [ ] 5.6 Add role detection and apply appropriate defaults

- [ ] **Task 6: Update AddWidgetModal with categories** (AC: 2)
  - [ ] 6.1 Categorize widgets: "Score & KPI", "Risques", "Actions", "Audits", "Autres"
  - [ ] 6.2 Add search/filter functionality in modal
  - [ ] 6.3 Show widget preview on hover
  - [ ] 6.4 Prevent adding duplicate widgets (except multi-instance widgets)

- [ ] **Task 7: Write unit tests** (AC: all)
  - [ ] 7.1 Test WidgetRegistry has all new widgets
  - [ ] 7.2 Test dashboardDefaults returns correct layouts per role
  - [ ] 7.3 Test useDashboardPreferences Firestore save/load
  - [ ] 7.4 Test DashboardEditModeToggle states
  - [ ] 7.5 Test ConfigurableDashboard role detection
  - [ ] 7.6 Test AddWidgetModal filtering and selection
  - [ ] 7.7 Test resetLayout restores role defaults

## Dev Notes

### Architecture Compliance (ADR-004)

Cette story complete l'implementation de ADR-004: Dashboard Configurable par Role.

**Pattern requis (architecture.md):**
```typescript
// Dashboard configuration
interface DashboardConfig {
  userId: string;
  role: UserRole;
  widgets: WidgetConfig[];
  layout: LayoutConfig;
  customized: boolean; // false = use role defaults
}

// Defaults par Role:
| Role | Widgets Defaut |
|------|----------------|
| direction | score-gauge, kpi-cards (3), alerts-critical |
| rssi | risks-critical, actions-overdue, incidents-recent, controls-status |
| auditor | audit-progress, document-expiring, checklist-summary |
| project_manager | actions-overdue, timeline, resources |
```

### Existing Code Analysis

**Ce qui existe deja:**

1. `src/components/dashboard/configurable/ConfigurableDashboardGrid.tsx`
   - Uses `@dnd-kit/core` for drag & drop (NOT react-grid-layout)
   - Already supports sorting, drag overlay
   - Takes `layout`, `onLayoutChange`, `isEditing`, `widgetProps` props

2. `src/components/dashboard/configurable/SortableWidget.tsx`
   - Individual sortable widget wrapper
   - Remove button in edit mode

3. `src/components/dashboard/configurable/AddWidgetModal.tsx`
   - Modal pour ajouter des widgets
   - Uses WidgetRegistry

4. `src/components/dashboard/configurable/WidgetRegistry.tsx`
   - 18 widgets registered (stats-overview, my-workspace, compliance-evolution, etc.)
   - Missing: compliance-score, executive-kpi, rssi-*, pm-* widgets

5. `src/hooks/useDashboardPreferences.ts`
   - localStorage persistence only (needs Firestore)
   - Has: `layout`, `updateLayout`, `resetLayout`, `hasLoaded`
   - Uses key: `sentinel_dashboard_prefs_v1_{userId}_{role}`

**Widgets des stories precedentes a integrer:**
```typescript
// Story 2-2: Apple Health Style Score Gauge
import { ComplianceScoreWidget } from '../ComplianceScoreWidget';

// Story 2-3: Executive KPI Cards
import { ExecutiveKPIWidget } from '../ExecutiveKPIWidget';

// Story 2-4: RSSI Risk & Incident View
import { RSSICriticalRisksWidget } from '../RSSICriticalRisksWidget';
import { RSSIIncidentsWidget } from '../RSSIIncidentsWidget';
import { RSSIActionsWidget } from '../RSSIActionsWidget';

// Story 2-5: PM Progress View
import { PMActionsOverdueWidget } from '../PMActionsOverdueWidget';
import { PMTimelineWidget } from '../PMTimelineWidget';
import { PMProgressWidget } from '../PMProgressWidget';
```

### Dependencies on Stories 2.1-2.5

**Reutiliser les composants existants:**
```typescript
// Story 2.3 role utilities
import { hasRole, isDirection, isRSSI, isProjectManager, isAuditor } from '../utils/roleUtils';
import type { UserRole } from '../types/user.types';

// Story 2.3 KPI patterns
import { KPI_COLOR_CLASSES } from '../config/kpiConfig';

// Existing auth context
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
```

### File Structure

**Files to Create:**
- `src/config/dashboardDefaults.ts` - Role-based default layouts
- `src/components/dashboard/DashboardEditModeToggle.tsx` - Edit mode UI
- `src/components/dashboard/ConfigurableDashboard.tsx` - Main integration component

**Files to Modify:**
- `src/components/dashboard/configurable/WidgetRegistry.tsx` - Add 8 new widgets
- `src/hooks/useDashboardPreferences.ts` - Add Firestore persistence
- `src/components/dashboard/configurable/AddWidgetModal.tsx` - Add categories

**Test Files:**
- `src/config/__tests__/dashboardDefaults.test.ts`
- `src/components/dashboard/__tests__/DashboardEditModeToggle.test.tsx`
- `src/components/dashboard/__tests__/ConfigurableDashboard.test.tsx`
- `src/hooks/__tests__/useDashboardPreferences.test.ts` (update)
- `src/components/dashboard/configurable/__tests__/AddWidgetModal.test.tsx`

### Firestore Schema

**Document: `tenants/{tenantId}/dashboardConfigs/{userId}`**
```typescript
interface DashboardConfigDocument {
  userId: string;
  role: string;
  layout: WidgetLayout[];
  customized: boolean;
  updatedAt: Timestamp;
  createdAt: Timestamp;
}
```

### Role Detection Pattern

```typescript
// Get user role for default layout
function getUserDashboardRole(user: UserWithRole): string {
  if (isDirection(user)) return 'direction';
  if (isRSSI(user)) return 'rssi';
  if (isProjectManager(user)) return 'project_manager';
  if (isAuditor(user)) return 'auditor';
  if (hasRole(user, 'admin')) return 'admin';
  return 'user'; // Default
}
```

### i18n Keys to Add

```json
{
  "dashboard": {
    "editMode": "Mode edition",
    "customize": "Personnaliser",
    "doneEditing": "Terminer",
    "resetToDefaults": "Reinitialiser",
    "resetConfirm": "Reinitialiser votre dashboard aux parametres par defaut?",
    "addWidget": "Ajouter un widget",
    "removeWidget": "Supprimer",
    "widgetCategories": {
      "scoreKpi": "Score & KPI",
      "risks": "Risques",
      "actions": "Actions",
      "audits": "Audits",
      "other": "Autres"
    },
    "complianceScore": "Score de Conformite",
    "executiveKpi": "KPIs Direction",
    "rssiCriticalRisks": "Risques Critiques",
    "rssiIncidents": "Incidents Actifs",
    "rssiActions": "Actions RSSI",
    "pmActionsOverdue": "Actions en Retard",
    "pmTimeline": "Timeline Projet",
    "pmProgress": "Progression Projet"
  }
}
```

### Accessibility Requirements

- Drag & drop must have keyboard alternatives (already supported by @dnd-kit)
- Edit mode button must announce state change to screen readers
- Widget remove button must have aria-label
- Modal must trap focus when open
- Reset confirmation must be dismissible with Escape

### NE PAS implementer

- Widget resizing (use fixed colSpan for now)
- Multi-page dashboards
- Dashboard sharing between users
- Widget-level settings/configuration
- Dark/light theme per widget

## References

- [Source: architecture.md#ADR-004] - Dashboard Configurable par Role
- [Source: epics.md#Story-2.6] - Story requirements
- [Source: prd.md#FR11] - Dashboard personnalisable
- [Source: Story 2.2] - ComplianceScoreWidget
- [Source: Story 2.3] - ExecutiveKPIWidget, roleUtils
- [Source: Story 2.4] - RSSI widgets
- [Source: Story 2.5] - PM widgets
- [Source: existing] - src/components/dashboard/configurable/

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List

