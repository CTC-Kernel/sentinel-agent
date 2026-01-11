# Story 2.6: Configurable Dashboard Widgets

Status: done

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

- [x] **Task 1: Register new widgets in WidgetRegistry** (AC: 2)
  - [x] 1.1 Add `compliance-score` widget (ComplianceScoreWidget from Story 2-2)
  - [x] 1.2 Add `executive-kpi` widget (ExecutiveKPIWidget from Story 2-3)
  - [x] 1.3 Add `rssi-critical-risks` widget (RSSICriticalRisksWidget from Story 2-4)
  - [x] 1.4 Add `rssi-incidents` widget (RSSIIncidentsWidget from Story 2-4)
  - [x] 1.5 Add `rssi-actions` widget (RSSIActionsWidget from Story 2-4)
  - [x] 1.6 Add `pm-actions-overdue` widget (PMActionsOverdueWidget from Story 2-5)
  - [x] 1.7 Add `pm-timeline` widget (PMTimelineWidget from Story 2-5)
  - [x] 1.8 Add `pm-progress` widget (PMProgressWidget from Story 2-5)
  - [x] 1.9 Export i18n translation keys for new widgets

- [x] **Task 2: Create role-based default layouts config** (AC: 5)
  - [x] 2.1 Create `src/config/dashboardDefaults.ts` per ADR-004
  - [x] 2.2 Define direction defaults: compliance-score, executive-kpi, health-check
  - [x] 2.3 Define rssi defaults: rssi-critical-risks, rssi-incidents, rssi-actions, risk-heatmap
  - [x] 2.4 Define project_manager defaults: pm-actions-overdue, pm-timeline, pm-progress
  - [x] 2.5 Define auditor defaults: audits-donut, compliance-progress, documents-stats
  - [x] 2.6 Define default layout for other roles (user, admin)

- [x] **Task 3: Implement Firestore persistence** (AC: 4)
  - [x] 3.1 Create `tenants/{tenantId}/dashboardConfigs/{userId}` Firestore document structure
  - [x] 3.2 Update `useDashboardPreferences.ts` to use Firestore with localStorage fallback
  - [x] 3.3 Add real-time sync with `onSnapshot` for cross-device updates
  - [x] 3.4 Add debounced auto-save on layout change (1 second delay)
  - [x] 3.5 Handle offline mode with localStorage queue

- [x] **Task 4: Create DashboardEditModeToggle component** (AC: 1, 5)
  - [x] 4.1 Create `src/components/dashboard/DashboardEditModeToggle.tsx`
  - [x] 4.2 Add "Personnaliser" button that activates edit mode
  - [x] 4.3 Add "Terminer" button to exit edit mode
  - [x] 4.4 Add "Reinitialiser" button to reset to role defaults
  - [x] 4.5 Show edit mode indicator (visual feedback)

- [x] **Task 5: Create ConfigurableDashboard page integration** (AC: 1, 2, 3, 4, 5)
  - [x] 5.1 Create `src/components/dashboard/ConfigurableDashboard.tsx`
  - [x] 5.2 Integrate role-based default layouts from dashboardDefaults
  - [x] 5.3 Wire up edit mode toggle with ConfigurableDashboardGrid
  - [x] 5.4 Wire up AddWidgetModal with updated WidgetRegistry
  - [x] 5.5 Integrate Firestore persistence via useDashboardPreferences
  - [x] 5.6 Add role detection and apply appropriate defaults

- [x] **Task 6: Update AddWidgetModal with categories** (AC: 2)
  - [x] 6.1 Categorize widgets: "Score & KPI", "Risques", "Actions", "Audits", "Autres"
  - [x] 6.2 Add search/filter functionality in modal
  - [x] 6.3 Show widget preview on hover
  - [x] 6.4 Prevent adding duplicate widgets (except multi-instance widgets)

- [x] **Task 7: Write unit tests** (AC: all)
  - [x] 7.1 Test WidgetRegistry has all new widgets
  - [x] 7.2 Test dashboardDefaults returns correct layouts per role
  - [x] 7.3 Test useDashboardPreferences Firestore save/load
  - [x] 7.4 Test DashboardEditModeToggle states
  - [x] 7.5 Test ConfigurableDashboard role detection
  - [x] 7.6 Test AddWidgetModal filtering and selection
  - [x] 7.7 Test resetLayout restores role defaults

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
Claude Opus 4.5

### Completion Notes List
1. **Task 1 (Widget Registration)**: Added all 8 new widgets from Stories 2-2 to 2-5 to WidgetRegistry.tsx. Each widget includes id, component, titleKey, and defaultColSpan. Updated i18n translations for FR/EN.

2. **Task 2 (Role-based Defaults)**: Created dashboardDefaults.ts with ROLE_DEFAULT_LAYOUTS for direction, rssi, project_manager, auditor, admin, and user roles. Includes getDefaultLayoutForRole(), getDashboardRole(), getWidgetCategory(), and WIDGET_CATEGORIES mapping.

3. **Task 3 (Firestore Persistence)**: Rewrote useDashboardPreferences.ts to use Firestore with localStorage fallback. Implemented onSnapshot real-time sync, 1-second debounced auto-save, and offline queue for failed saves.

4. **Task 4 (Edit Mode Toggle)**: Created DashboardEditModeToggle.tsx with "Personnaliser"/"Terminer" buttons, visual edit mode indicator, and reset confirmation dialog with accessibility support.

5. **Task 5 (ConfigurableDashboard Integration)**: Created ConfigurableDashboard.tsx as main integration component. Implements role detection, wires up all components, and handles empty/loading states.

6. **Task 6 (AddWidgetModal Categories)**: Updated AddWidgetModal.tsx with 5 categories (Score & KPI, Risques, Actions, Audits, Autres), search functionality, category icons/colors, and duplicate prevention.

7. **Task 7 (Unit Tests)**: Created 120 unit tests across 6 test files covering all acceptance criteria. All tests pass.

### File List
**Created:**
- src/config/dashboardDefaults.ts (role-based default layouts)
- src/components/dashboard/DashboardEditModeToggle.tsx (edit mode UI)
- src/components/dashboard/ConfigurableDashboard.tsx (main integration)
- src/config/__tests__/dashboardDefaults.test.ts (24 tests)
- src/components/dashboard/__tests__/DashboardEditModeToggle.test.tsx (15 tests)
- src/components/dashboard/__tests__/ConfigurableDashboard.test.tsx (14 tests)
- src/hooks/__tests__/useDashboardPreferences.test.ts (20 tests)
- src/components/dashboard/configurable/__tests__/WidgetRegistry.test.ts (24 tests)
- src/components/dashboard/configurable/__tests__/AddWidgetModal.test.tsx (23 tests)

**Modified:**
- src/components/dashboard/configurable/WidgetRegistry.tsx (added 8 widget registrations)
- src/hooks/useDashboardPreferences.ts (Firestore persistence rewrite)
- src/components/dashboard/configurable/AddWidgetModal.tsx (categories, search, filtering)
- src/i18n/translations.ts (new widget and category translation keys)

