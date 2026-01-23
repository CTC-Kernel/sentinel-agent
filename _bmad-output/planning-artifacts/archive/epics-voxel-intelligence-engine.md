# Epics & Stories - Voxel Intelligence Engine

**Module:** 3D Security Intelligence Platform
**Date:** 2026-01-17
**Version:** 1.0
**PRD Reference:** prd-voxel-intelligence-engine.md
**Architecture Reference:** architecture-voxel-intelligence-engine.md

---

## Overview

Ce document structure l'implementation du Voxel Intelligence Engine en 7 Epics, chacun regroupant des User Stories avec des Acceptance Criteria detailles. L'objectif est de transformer le module Voxel d'une visualisation 3D passive en une plateforme d'intelligence securite temps reel.

### Epic Summary

| Epic | Nom | FRs | Effort | Priority |
|------|-----|-----|--------|----------|
| 28 | Synchronisation Temps Reel | FR-VOXEL-001 | 1.5 sprints | P0 |
| 29 | Detection d'Anomalies | FR-VOXEL-002, FR-VOXEL-007 | 3.5 sprints | P0 |
| 30 | Simulation Blast Radius | FR-VOXEL-003, FR-VOXEL-006 | 3.5 sprints | P0 |
| 31 | Vues par Role & Analytics | FR-VOXEL-004, FR-VOXEL-005 | 4 sprints | P1 |
| 32 | Performance & Export | FR-VOXEL-008, FR-VOXEL-009 | 3.5 sprints | P1 |
| 33 | Annotations & Collaboration | FR-VOXEL-010 | 1.5 sprints | P2 |
| 34 | Fondation AR/VR | FR-VOXEL-011 | 1 sprint | P3 |

### Dependencies

```
Epic 28 (Real-time)
    |
    v
Epic 29 (Anomalies) -----> Epic 31 (Views & Analytics)
    |                           |
    v                           v
Epic 30 (Blast Radius) --> Epic 32 (Performance & Export)
                                |
                                v
                           Epic 33 (Annotations)
                                |
                                v
                           Epic 34 (AR/VR)
```

---

## Epic 28: Synchronisation Temps Reel

### Description

Implementer la synchronisation en temps reel des donnees Firestore avec la visualisation 3D. Les utilisateurs verront les modifications instantanement avec des animations fluides d'apparition/disparition.

### Objectif

Permettre aux utilisateurs (notamment SOC analysts) de voir les changements de donnees en temps reel sans avoir a rafraichir la page, avec une latence <2s.

### FRs Couverts

- **FR-VOXEL-001:** Temps Reel (Real-time Sync)

### Stories

---

#### Story 28.1: Zustand Store pour Voxel State

**Priority:** P0
**Story Points:** 5

**Description:**
As a developer,
I want a centralized Zustand store for Voxel state management,
So that real-time updates can be efficiently propagated to all components.

**Acceptance Criteria:**

```gherkin
Given the Voxel module is loaded
When I initialize the store
Then it should contain nodes, edges, anomalies, filters, and UI state

Given multiple components subscribe to the store
When a node is updated
Then all subscribed components should re-render with new data

Given user closes the Voxel view
When they reopen it
Then persisted preferences (filters, view) should be restored from localStorage
```

**Technical Notes:**
- Create `/src/stores/voxelStore.ts` using Zustand with devtools and persist middleware
- Use Map<string, VoxelNode> for O(1) node access
- Implement slices: nodes, filters, ui, sync, anomalies, analytics
- Add `computeEdges()` function called on node add/remove

---

#### Story 28.2: Firestore Real-time Listeners

**Priority:** P0
**Story Points:** 8

**Description:**
As a RSSI,
I want to see data changes immediately in Voxel,
So that I can monitor my security posture in real-time.

**Acceptance Criteria:**

```gherkin
Given I am viewing the Voxel 3D scene
When a colleague creates a new risk in another session
Then I should see the new risk node appear within 2 seconds

Given I am viewing the Voxel 3D scene
When an incident is marked as resolved
Then the incident node should update its visual state within 2 seconds

Given multiple rapid changes occur
When 10 updates happen within 500ms
Then they should be batched and applied together (debounce)
```

**Technical Notes:**
- Create `useVoxelRealtime.ts` hook
- Subscribe to collections: assets, risks, projects, audits, incidents, suppliers, controls
- Use `onSnapshot` with `where('organizationId', '==', orgId)`
- Implement 100ms debounce for batch updates
- Handle `added`, `modified`, `removed` change types

---

#### Story 28.3: Node Animation System

**Priority:** P0
**Story Points:** 5

**Description:**
As a user,
I want smooth animations when nodes appear or disappear,
So that I can notice changes without jarring visual transitions.

**Acceptance Criteria:**

```gherkin
Given a new node is added to the scene
When the real-time update is received
Then the node should animate in with scale (0 -> 1) over 300ms

Given a node is removed from the scene
When the real-time update is received
Then the node should animate out with scale (1 -> 0) and fade before removal

Given a node is modified
When the real-time update is received
Then the node should pulse/highlight briefly to indicate change
```

**Technical Notes:**
- Use `@react-spring/three` for 3D animations
- Create `useNodeAnimation.ts` hook
- `animateNodeIn()`: scale from 0 with spring physics
- `animateNodeOut()`: scale to 0, then call removeNode after animation
- `highlightNodeChange()`: brief color pulse or glow effect

---

#### Story 28.4: Sync Status Indicator

**Priority:** P1
**Story Points:** 3

**Description:**
As a user,
I want to know if Voxel is connected and synchronized,
So that I can trust the data I'm seeing is current.

**Acceptance Criteria:**

```gherkin
Given I am viewing Voxel
When all listeners are active and receiving data
Then I should see a green "Live" indicator

Given a Firestore listener encounters an error
When the connection is interrupted
Then I should see an orange "Syncing..." indicator

Given I lose internet connection
When Voxel detects offline status
Then I should see a red "Offline" indicator with cached data warning
```

**Technical Notes:**
- Track `syncStatus: 'connected' | 'syncing' | 'offline'` in store
- Use `navigator.onLine` and Firestore metadata changes
- Display status badge in VoxelHeader component
- Show `lastSyncAt` timestamp on hover

---

#### Story 28.5: Offline Mode with Cache

**Priority:** P1
**Story Points:** 5

**Description:**
As a mobile user,
I want Voxel to work offline with cached data,
So that I can still view my security posture during connectivity issues.

**Acceptance Criteria:**

```gherkin
Given I have previously loaded Voxel with data
When I lose internet connection
Then I should still see the last known state of all nodes

Given I make changes while offline
When connection is restored
Then local changes should sync and remote changes should be applied

Given Firestore listener fails
When automatic reconnection fails 3 times
Then fallback to polling every 30 seconds should activate
```

**Technical Notes:**
- Enable Firestore persistence: `enablePersistence(db)`
- Implement `enablePollingFallback()` function
- Store last successful snapshot in IndexedDB as backup
- Show toast notification on reconnection with summary of changes

---

## Epic 29: Detection d'Anomalies

### Description

Implementer un moteur de detection d'anomalies hybride (Cloud Function + client-side) qui identifie automatiquement les incoherences, orphelins, et tendances negatives dans les donnees de securite.

### Objectif

Detecter automatiquement >80% des anomalies de donnees (orphelins, perimes, incoherences) et alerter proactivement les utilisateurs.

### FRs Couverts

- **FR-VOXEL-002:** Detection d'Anomalies Automatique
- **FR-VOXEL-007:** Alertes Proactives

### Stories

---

#### Story 29.1: Anomaly Data Model & Collection

**Priority:** P0
**Story Points:** 3

**Description:**
As a developer,
I want a Firestore collection to store detected anomalies,
So that anomalies can be tracked, resolved, and reported on.

**Acceptance Criteria:**

```gherkin
Given an anomaly is detected
When it is saved to Firestore
Then it should contain: id, type, severity, entityId, entityType, message, detectedAt, status

Given an anomaly already exists
When the same anomaly is detected again
Then it should not create a duplicate (idempotent)

Given an anomaly is resolved
When the underlying issue is fixed
Then the anomaly status should change to 'resolved' with resolvedAt timestamp
```

**Technical Notes:**
- Create `anomalies` collection with proper indexes
- Fields: id, organizationId, type, severity, entityId, entityType, message, detectedAt, status, acknowledgedBy, acknowledgedAt, resolvedAt, dismissedReason, metadata
- Status enum: 'active', 'acknowledged', 'resolved', 'dismissed'
- Type enum: 'orphan', 'stale', 'inconsistency', 'cycle', 'cluster', 'trend'
- Add Firestore security rules

---

#### Story 29.2: Cloud Function - Anomaly Detection Engine

**Priority:** P0
**Story Points:** 8

**Description:**
As a system,
I want a scheduled Cloud Function that detects anomalies,
So that issues are identified even when no user is viewing Voxel.

**Acceptance Criteria:**

```gherkin
Given the function runs every 15 minutes
When it analyzes organization data
Then it should detect: orphaned assets, orphaned risks, stale controls, old incidents

Given new anomalies are detected
When they are saved to Firestore
Then they should have unique, deterministic IDs based on type and entity

Given previously detected anomalies are no longer present
When the issue has been resolved
Then the anomaly status should be updated to 'resolved'
```

**Technical Notes:**
- Create `functions/src/detectAnomalies.ts` using `onSchedule('*/15 * * * *')`
- Implement anomaly rules as modular functions
- Rules to implement:
  - `orphan-asset`: Assets without controls
  - `orphan-risk`: Risks without assets
  - `stale-control`: Controls not reviewed >90 days
  - `stale-incident`: Incidents open >30 days
  - `supplier-no-sla`: Critical suppliers without SLA
  - `risk-severity-mismatch`: Risk score vs asset criticality mismatch
- Batch write for efficiency

---

#### Story 29.3: Circular Dependency Detection

**Priority:** P0
**Story Points:** 5

**Description:**
As an auditor,
I want the system to detect circular dependencies in my data,
So that I can identify configuration errors that could cause issues.

**Acceptance Criteria:**

```gherkin
Given assets A -> B -> C -> A form a circular dependency
When the anomaly detection runs
Then a 'cycle' type anomaly should be detected with severity 'critical'

Given a complex graph with multiple potential cycles
When the detection algorithm runs
Then all cycles should be detected without infinite loops

Given a cycle is detected
When I view the anomaly details
Then I should see the full cycle path (A -> B -> C -> A)
```

**Technical Notes:**
- Implement DFS-based cycle detection in `detectCycles()`
- Build adjacency list from entity relationships
- Store cycle path in anomaly metadata
- Consider using Tarjan's algorithm for efficiency

---

#### Story 29.4: Client-side Anomaly Detection (Web Worker)

**Priority:** P1
**Story Points:** 5

**Description:**
As a developer,
I want client-side anomaly detection for instant feedback,
So that users see anomalies immediately without waiting for Cloud Function.

**Acceptance Criteria:**

```gherkin
Given data is loaded in Voxel
When the Web Worker completes analysis
Then client-detected anomalies should be merged with server anomalies

Given a node is modified in real-time
When the change could create an anomaly
Then the client should detect and display it within 500ms

Given client and server detect the same anomaly
When displaying to user
Then only one instance should be shown (deduplication)
```

**Technical Notes:**
- Create `src/workers/anomalyWorker.ts`
- Implement subset of rules (orphans, stale) for instant feedback
- Use `postMessage` to communicate with main thread
- Client anomalies have `source: 'client'`, server have `source: 'server'`

---

#### Story 29.5: Anomaly Visualization in 3D Scene

**Priority:** P0
**Story Points:** 5

**Description:**
As a RSSI,
I want to see anomalous nodes highlighted in the 3D scene,
So that I can quickly identify problems visually.

**Acceptance Criteria:**

```gherkin
Given a node has an active anomaly
When viewing the 3D scene
Then the node should have a pulsing red halo effect

Given multiple nodes have anomalies of different severities
When viewing the scene
Then critical anomalies should have larger/brighter halos than low severity

Given I toggle "Anomaly Mode" in the toolbar
When it is active
Then only nodes with anomalies should be fully visible (others dimmed)
```

**Technical Notes:**
- Create `AnomalyOverlay.tsx` component using Three.js postprocessing
- Use `OutlinePass` or custom shader for halo effect
- Pulse animation using `useFrame` with sin wave
- Severity colors: critical=red, high=orange, medium=yellow, low=blue

---

#### Story 29.6: Anomaly Panel UI

**Priority:** P0
**Story Points:** 5

**Description:**
As an auditor,
I want a sidebar panel listing all anomalies,
So that I can review and act on them systematically.

**Acceptance Criteria:**

```gherkin
Given I open the Anomaly Panel
When anomalies exist
Then I should see a list grouped by severity with counts

Given I click on an anomaly in the list
When the action completes
Then the camera should zoom to the affected node and highlight it

Given I filter anomalies by type or severity
When I select filters
Then only matching anomalies should be displayed
```

**Technical Notes:**
- Create `VoxelAnomalyPanel.tsx` component
- Display: severity icon, message, entity name, detected time
- Actions: "Zoom to", "Acknowledge", "Dismiss", "Create Task"
- Filter by: severity, type, entity type, date range
- Show Data Health Score at top: percentage based on anomaly count/severity

---

#### Story 29.7: Anomaly Quick Actions

**Priority:** P1
**Story Points:** 3

**Description:**
As a RSSI,
I want to quickly act on anomalies from Voxel,
So that I can address issues without leaving the visualization.

**Acceptance Criteria:**

```gherkin
Given I view an anomaly
When I click "Acknowledge"
Then the anomaly should be marked as acknowledged with my user ID and timestamp

Given I view a false positive anomaly
When I click "Dismiss"
Then I should be prompted for a reason and the anomaly marked as dismissed

Given I view an anomaly requiring action
When I click "Create Task"
Then a task should be created in the Tasks module linked to this anomaly
```

**Technical Notes:**
- Update Firestore anomaly document on actions
- Integrate with existing `tasksService.ts` for task creation
- Store dismissal reasons for reporting
- Show undo option for 5 seconds after action

---

#### Story 29.8: Alert Configuration UI

**Priority:** P1
**Story Points:** 5

**Description:**
As a user,
I want to configure my Voxel alert preferences,
So that I receive notifications through my preferred channels.

**Acceptance Criteria:**

```gherkin
Given I open Voxel settings
When I navigate to Alert Preferences
Then I should see toggles for each alert type and channel

Given I enable "Critical Anomaly" alerts via Email
When a critical anomaly is detected
Then I should receive an email notification

Given I configure alert thresholds
When I set "New Incident" to "Critique" severity only
Then I should only be alerted for critical incidents
```

**Technical Notes:**
- Create `VoxelUserSettings` document in Firestore
- Alert types: anomalyCritical, anomalyHigh, trendNegative, newIncident, blastRadiusHigh
- Channels: in_app, email, slack, teams
- Store per-organization webhook URLs for Slack/Teams

---

#### Story 29.9: Alert Cloud Functions

**Priority:** P1
**Story Points:** 5

**Description:**
As a system,
I want Cloud Functions to send alerts based on user preferences,
So that users are notified proactively of critical issues.

**Acceptance Criteria:**

```gherkin
Given a critical anomaly is created
When the Firestore trigger fires
Then users with 'anomalyCritical' enabled should receive alerts via their channels

Given multiple critical anomalies occur within 5 minutes
When alerts are processed
Then they should be batched into a digest (not individual emails)

Given an alert is sent
When it is processed
Then it should be logged in 'voxel_alerts' collection for history
```

**Technical Notes:**
- Create `alertOnCriticalAnomaly` Firestore trigger function
- Create `sendAnomalyDigest` scheduled function (every 5 min)
- Use existing `notificationService.ts` for in-app notifications
- Use SendGrid/Nodemailer for email
- Use `fetch` for Slack/Teams webhooks

---

## Epic 30: Simulation Blast Radius

### Description

Implementer la simulation visuelle de l'impact en cascade d'un incident ou risque, permettant aux utilisateurs de comprendre les dependances et l'effet domino potentiel.

### Objectif

Permettre aux utilisateurs de simuler et visualiser l'impact potentiel d'un incident sur l'ensemble de leur infrastructure en <1 seconde.

### FRs Couverts

- **FR-VOXEL-003:** Blast Radius Simulation
- **FR-VOXEL-006:** Root Cause Analysis

### Stories

---

#### Story 30.1: Blast Radius Algorithm (Web Worker)

**Priority:** P0
**Story Points:** 8

**Description:**
As a developer,
I want a weighted BFS algorithm for blast radius calculation,
So that impact simulation is fast and accurate.

**Acceptance Criteria:**

```gherkin
Given a starting node and graph data
When I run the blast radius algorithm
Then it should return impacted nodes with depth, probability, and path

Given a deep dependency chain (>10 hops)
When maxDepth is set to 5
Then nodes beyond depth 5 should not be included

Given propagation probability drops below 10%
When calculating impact
Then those low-probability paths should be excluded
```

**Technical Notes:**
- Create `src/workers/blastRadiusWorker.ts`
- Implement weighted BFS with priority queue (sorted by probability)
- Calculate propagation probability based on:
  - Edge weight
  - Source node severity
  - Target node type multiplier
- Return `BlastRadiusResult` with impactedNodes and totalImpact

---

#### Story 30.2: useBlastRadius Hook

**Priority:** P0
**Story Points:** 3

**Description:**
As a developer,
I want a React hook to trigger and receive blast radius simulations,
So that components can easily request impact analysis.

**Acceptance Criteria:**

```gherkin
Given I call simulate(nodeId)
When the worker processes the request
Then isSimulating should be true during processing

Given the worker completes
When results are returned
Then result state should contain impactedNodes and totalImpact

Given I trigger a new simulation while one is running
When the new request is made
Then the previous simulation should be cancelled
```

**Technical Notes:**
- Create `useBlastRadius.ts` hook
- Manage Worker lifecycle (create on mount, terminate on unmount)
- Expose: `simulate(config)`, `result`, `isSimulating`, `cancel()`
- Use AbortController pattern for cancellation

---

#### Story 30.3: Blast Radius Visualization

**Priority:** P0
**Story Points:** 8

**Description:**
As a RSSI,
I want to see the blast radius as animated waves in 3D,
So that I can visually understand impact propagation.

**Acceptance Criteria:**

```gherkin
Given I click "Simulate Impact" on a risk node
When the simulation runs
Then I should see animated concentric waves spreading from the source

Given nodes are impacted at different depths
When visualizing
Then direct impact (depth 1) should be red, indirect (depth 2) orange, potential (depth 3+) yellow

Given the simulation completes
When animation finishes
Then impacted nodes should remain highlighted with their impact level color
```

**Technical Notes:**
- Create `BlastRadiusOverlay.tsx` component
- Use Three.js RingGeometry for expanding waves
- Animate with `useFrame` - scale and opacity over time
- Color nodes based on impactLevel from result
- Use staggered timing based on depth (depth 1 at 0ms, depth 2 at 300ms, etc.)

---

#### Story 30.4: Blast Radius Stats Panel

**Priority:** P0
**Story Points:** 5

**Description:**
As a RSSI,
I want to see impact statistics alongside the visualization,
So that I can quantify the potential damage.

**Acceptance Criteria:**

```gherkin
Given a blast radius simulation completes
When viewing the stats panel
Then I should see: total impacted nodes, breakdown by type, estimated MTTR

Given impact is categorized by entity type
When viewing stats
Then I should see: "12 assets, 3 suppliers, 5 risks impacted"

Given business impact is calculated
When viewing stats
Then I should see a qualitative level: Low / Medium / High / Critical
```

**Technical Notes:**
- Create `BlastRadiusStatsPanel.tsx` component
- Display: impacted count by type, MTTR estimate, business impact level
- Calculate MTTR from historical incident data or use defaults
- Business impact based on critical asset count and supplier involvement

---

#### Story 30.5: What-If Simulation Mode

**Priority:** P1
**Story Points:** 5

**Description:**
As a RSSI,
I want to simulate "what if a control fails",
So that I can test the resilience of my security posture.

**Acceptance Criteria:**

```gherkin
Given I select a control node
When I click "What-If: Control Fails"
Then the simulation should run assuming that control provides no mitigation

Given I compare with/without control failure
When both simulations complete
Then I should see a comparison: "Without control: +5 assets impacted"

Given I want to simulate multiple failures
When I select multiple controls
Then the simulation should account for all being unavailable
```

**Technical Notes:**
- Add `simulateFailure: string[]` to BlastRadiusConfig
- When calculating propagation, ignore mitigation from failed controls
- Create comparison view component showing delta
- Store both results for side-by-side display

---

#### Story 30.6: Root Cause Analysis Algorithm

**Priority:** P1
**Story Points:** 5

**Description:**
As an auditor,
I want to trace back from an incident to find root causes,
So that I can understand the chain of events that led to an issue.

**Acceptance Criteria:**

```gherkin
Given I select an incident node
When I click "Analyze Root Cause"
Then the system should trace backwards through dependencies

Given a root cause chain is found
When displayed
Then the path should be highlighted: Root -> Intermediate -> Incident

Given multiple potential root causes exist
When analysis completes
Then all paths should be shown, sorted by probability
```

**Technical Notes:**
- Implement reverse BFS from incident to sources
- Identify "bottleneck" nodes (high in-degree in dependency graph)
- Calculate probability based on timeline and relationship strength
- Store in result: `rootCausePaths: Array<{path: string[], probability: number}>`

---

#### Story 30.7: Root Cause Visualization

**Priority:** P1
**Story Points:** 5

**Description:**
As an auditor,
I want to see the root cause chain visualized,
So that I can understand and document the incident origin.

**Acceptance Criteria:**

```gherkin
Given root cause analysis completes
When visualizing
Then the path from root to incident should be highlighted with directional arrows

Given multiple root causes are identified
When viewing
Then I should be able to cycle through different paths

Given I want to document findings
When I click "Export Root Cause Report"
Then a formatted report in 5 Whys style should be generated
```

**Technical Notes:**
- Reuse path highlighting from BlastRadiusOverlay
- Add directional arrows on edges using Three.js ArrowHelper
- Create `RootCauseReport.tsx` component with export to PDF
- 5 Whys format: "Why did X happen? Because of Y. Why Y? Because of Z..."

---

#### Story 30.8: Impact Report Export

**Priority:** P2
**Story Points:** 3

**Description:**
As a RSSI,
I want to export blast radius analysis as a PDF,
So that I can share findings with stakeholders.

**Acceptance Criteria:**

```gherkin
Given a blast radius simulation is complete
When I click "Export Report"
Then a PDF should be generated with: summary, impacted entities list, visualization snapshot

Given the report is generated
When I view it
Then it should include timestamp, source node, parameters used, and impact metrics

Given I want to share the simulation state
When I click "Share"
Then a URL should be generated that recreates this exact simulation view
```

**Technical Notes:**
- Use existing PDF generation (react-pdf or similar)
- Include screenshot of 3D visualization using `toDataURL`
- Format: Executive Summary, Impact Metrics, Entity List, Timeline, Recommendations
- URL sharing via encoded state params

---

## Epic 31: Vues par Role & Analytics

### Description

Implementer des vues predefinies optimisees pour chaque persona (Direction, RSSI, Auditeur, SOC) ainsi qu'un systeme d'analytics temporels avec mode "Time Machine".

### Objectif

Permettre a chaque role d'acceder instantanement a une vue pertinente et de comprendre l'evolution de la posture securite dans le temps.

### FRs Couverts

- **FR-VOXEL-004:** Vues Personnalisees par Role
- **FR-VOXEL-005:** Analytics Temporels

### Stories

---

#### Story 31.1: View Presets System

**Priority:** P0
**Story Points:** 5

**Description:**
As a developer,
I want a configurable view presets system,
So that different roles can have optimized visualizations.

**Acceptance Criteria:**

```gherkin
Given the VIEW_PRESETS object is defined
When I select a preset
Then layers, filters, camera position, and display settings should be applied

Given I switch from RSSI to Executive view
When the transition completes
Then the camera should animate to the new position and filters should apply

Given I create a custom view
When I save it
Then it should be persisted in my user settings
```

**Technical Notes:**
- Create `viewPresets.ts` with predefined presets:
  - Executive: KPIs, top risks only, simplified layout
  - RSSI: All critical layers, full connections
  - Auditor: Controls focus, hierarchical layout
  - SOC: Incidents timeline, last 24h filter
  - Compliance: Controls by framework, radial layout
- Store preset config: layers, filters, camera, display, layout

---

#### Story 31.2: View Selector UI

**Priority:** P0
**Story Points:** 3

**Description:**
As a user,
I want to easily switch between view presets,
So that I can quickly access the visualization I need.

**Acceptance Criteria:**

```gherkin
Given I click the View Selector dropdown
When the menu opens
Then I should see all available presets with icons and descriptions

Given I have custom saved views
When viewing the dropdown
Then my custom views should appear in a separate section

Given I press keyboard shortcut 1-5
When in Voxel
Then the corresponding preset should be activated
```

**Technical Notes:**
- Create `ViewSelector.tsx` dropdown component
- Display preset: icon, name, description, keyboard shortcut
- Group: "Standard Views" and "My Views"
- Keyboard shortcuts: 1=Executive, 2=RSSI, 3=Auditor, 4=SOC, 5=Compliance

---

#### Story 31.3: View Transition Animations

**Priority:** P1
**Story Points:** 3

**Description:**
As a user,
I want smooth animations when switching views,
So that the transition is not jarring.

**Acceptance Criteria:**

```gherkin
Given I switch from one view to another
When the transition starts
Then the camera should animate smoothly to the new position over 600ms

Given nodes are filtered out in the new view
When transitioning
Then they should fade out before camera moves

Given new nodes become visible in the new view
When transitioning
Then they should fade in after camera settles
```

**Technical Notes:**
- Use `@react-spring/three` for camera animation
- Sequence: 1) Fade out removed nodes, 2) Animate camera, 3) Fade in new nodes
- Easing: cubic-bezier(0.16, 1, 0.3, 1) for Apple-style spring

---

#### Story 31.4: Custom View Save/Load

**Priority:** P1
**Story Points:** 5

**Description:**
As a user,
I want to save my current view configuration as a custom preset,
So that I can quickly return to my preferred setup.

**Acceptance Criteria:**

```gherkin
Given I have configured a custom view
When I click "Save View"
Then I should be prompted to name the view

Given I save a custom view
When it is persisted
Then it should be stored in my user settings in Firestore

Given I delete a custom view
When I confirm
Then it should be removed from my saved views
```

**Technical Notes:**
- Store custom views in `voxel_user_settings.customViews[]`
- Capture current state: layers, filters, camera position, display settings
- Allow max 10 custom views per user
- Sync across devices via Firestore

---

#### Story 31.5: URL State Sharing

**Priority:** P1
**Story Points:** 3

**Description:**
As a user,
I want to share my current view via URL,
So that colleagues can see exactly what I'm seeing.

**Acceptance Criteria:**

```gherkin
Given I click "Share View"
When the URL is generated
Then it should contain encoded state for layers, filters, camera, and display

Given I receive a shared Voxel URL
When I open it
Then the view should be restored to the exact shared state

Given the shared state references a node
When I open the URL
Then that node should be selected and centered
```

**Technical Notes:**
- Encode view state as base64 JSON in URL param: `?view=eyJsYXllcnM...`
- Use `encodeViewState()` and `decodeViewState()` functions
- Apply state on component mount via `useSearchParams`
- Include optional `?node=<nodeId>` param

---

#### Story 31.6: Daily Snapshots Cloud Function

**Priority:** P0
**Story Points:** 5

**Description:**
As a system,
I want to capture daily metrics snapshots,
So that historical trends can be analyzed.

**Acceptance Criteria:**

```gherkin
Given the function runs at midnight daily
When it executes
Then it should create a snapshot for each organization

Given a snapshot is created
When stored
Then it should contain: date, totalRisks, criticalRisks, avgRiskScore, openIncidents, controlCoverage, dataHealthScore

Given snapshots exist for >1 year
When cleanup runs monthly
Then snapshots older than 1 year should be deleted
```

**Technical Notes:**
- Create `createDailySnapshot` Cloud Function with `onSchedule('0 0 * * *')`
- Store in `daily_snapshots` collection with doc ID: `{orgId}_{YYYY-MM-DD}`
- Calculate controlCoverage = assets with controls / total assets
- Calculate dataHealthScore from anomaly rules
- Create `cleanupOldSnapshots` function for monthly cleanup

---

#### Story 31.7: Time Machine UI

**Priority:** P0
**Story Points:** 8

**Description:**
As a RSSI,
I want a "Time Machine" slider to see my security posture at any past date,
So that I can understand how things have evolved.

**Acceptance Criteria:**

```gherkin
Given I open Time Machine mode
When I drag the slider to a past date
Then the 3D scene should update to show the state at that date

Given I am viewing a past date
When I see a node
Then its data should reflect the historical values (score, status, etc.)

Given I compare two dates
When using the comparison mode
Then I should see what was added, removed, and changed
```

**Technical Notes:**
- Create `VoxelTimelinePanel.tsx` with date slider
- Load historical data from `daily_snapshots` collection
- Show interpolated state for dates without snapshots
- "Compare" button opens side-by-side view
- Highlight: green=added since baseline, red=removed, orange=changed

---

#### Story 31.8: Trend Charts

**Priority:** P1
**Story Points:** 5

**Description:**
As a Direction user,
I want to see trend charts of key metrics,
So that I can understand if our security posture is improving or degrading.

**Acceptance Criteria:**

```gherkin
Given I view the Analytics panel
When metrics are loaded
Then I should see line charts for: Risk Score, Incident Count, Control Coverage

Given I select a time range (week, month, quarter)
When the chart updates
Then it should show data for that period

Given a trend is negative (>20% increase in risk)
When displayed
Then it should be highlighted with a warning indicator
```

**Technical Notes:**
- Use Recharts or Chart.js for visualizations
- Create `TrendChart.tsx` component
- Load data from `daily_snapshots` collection
- Calculate trend direction and percentage change
- Integrate with VoxelTimelinePanel

---

#### Story 31.9: Predictive Trends (Basic)

**Priority:** P2
**Story Points:** 5

**Description:**
As a RSSI,
I want to see predicted future trends,
So that I can anticipate problems before they occur.

**Acceptance Criteria:**

```gherkin
Given I have 30+ days of historical data
When viewing trend charts
Then I should see a dotted line showing predicted next 30 days

Given the prediction shows a critical risk increase
When displayed
Then I should see a warning: "Risk score predicted to reach Critical in 15 days"

Given I hover over the prediction line
When viewing details
Then I should see confidence interval (e.g., "70% confidence")
```

**Technical Notes:**
- Implement simple linear regression for predictions
- Require minimum 30 data points for prediction
- Display prediction with lower opacity and dashed line
- Show confidence interval as shaded area
- Cloud Function `predictTrends` can use more advanced ML (future enhancement)

---

#### Story 31.10: Calendar Heatmap

**Priority:** P2
**Story Points:** 3

**Description:**
As a SOC analyst,
I want a calendar heatmap showing incident intensity,
So that I can identify patterns in incident occurrence.

**Acceptance Criteria:**

```gherkin
Given I view the Calendar Heatmap
When displayed
Then each day should show color intensity based on incident count

Given I click on a high-intensity day
When the action completes
Then I should see a list of incidents from that day

Given I view multiple months
When analyzing patterns
Then I should be able to identify weekly/monthly patterns
```

**Technical Notes:**
- Create `CalendarHeatmap.tsx` component
- Color scale: white (0) -> yellow -> orange -> red (high)
- Load incident data grouped by date
- Click to filter 3D scene to that day's incidents

---

## Epic 32: Performance & Export

### Description

Optimiser les performances du moteur 3D pour supporter 5000+ noeuds a 30fps et implementer les fonctionnalites d'export et de partage.

### Objectif

Maintenir >30 FPS avec 5000 noeuds et permettre l'export en PNG, PDF, et formats 3D.

### FRs Couverts

- **FR-VOXEL-009:** Performance & Scalabilite
- **FR-VOXEL-008:** Export & Partage

### Stories

---

#### Story 32.1: Instanced Rendering

**Priority:** P0
**Story Points:** 8

**Description:**
As a developer,
I want instanced rendering for similar nodes,
So that thousands of nodes can be rendered in few draw calls.

**Acceptance Criteria:**

```gherkin
Given 1000 asset nodes need to be rendered
When using instanced mesh
Then they should be rendered in a single draw call

Given instanced nodes need different colors
When rendering
Then instance attributes should support per-instance color

Given an instance needs to animate (selection, hover)
When the animation runs
Then only that instance's matrix should update, not all instances
```

**Technical Notes:**
- Create `InstancedNodes.tsx` component for each node type
- Use `InstancedMesh` with `setMatrixAt()` and `setColorAt()`
- Group nodes by type (assets, risks, etc.) for separate instanced meshes
- Use `InstancedBufferAttribute` for custom per-instance data
- Update only changed instances each frame

---

#### Story 32.2: Level of Detail (LOD)

**Priority:** P0
**Story Points:** 5

**Description:**
As a developer,
I want level of detail switching based on camera distance,
So that distant nodes render faster.

**Acceptance Criteria:**

```gherkin
Given a node is close to the camera (<10 units)
When rendered
Then it should use high-detail geometry with labels

Given a node is medium distance (10-30 units)
When rendered
Then it should use simplified geometry without labels

Given a node is far from camera (>30 units)
When rendered
Then it should render as a simple sphere or point
```

**Technical Notes:**
- Create LOD manager using Three.js LOD object or custom solution
- Define distance thresholds: high (<10), medium (10-30), low (>30)
- High LOD: detailed mesh + label + glow
- Medium LOD: simple mesh, no label
- Low LOD: billboard sprite or point

---

#### Story 32.3: Frustum Culling Optimization

**Priority:** P1
**Story Points:** 3

**Description:**
As a developer,
I want efficient frustum culling,
So that nodes outside the viewport are not processed.

**Acceptance Criteria:**

```gherkin
Given 5000 nodes exist in the scene
When only 500 are visible
Then only those 500 should be processed for rendering

Given the camera moves quickly
When culling recalculates
Then there should be no visible popping or lag

Given spatial partitioning is used
When querying visible nodes
Then the query should complete in <1ms
```

**Technical Notes:**
- Verify `frustumCulled = true` on all meshes
- Implement octree spatial partitioning for large scenes
- Use BVH (Bounding Volume Hierarchy) for efficient culling
- Consider `drei`'s `BVH` component

---

#### Story 32.4: Web Workers for Layout

**Priority:** P0
**Story Points:** 5

**Description:**
As a developer,
I want layout calculations in a Web Worker,
So that the main thread stays responsive.

**Acceptance Criteria:**

```gherkin
Given 2000 nodes need layout calculation
When force-directed layout runs
Then it should execute in a Web Worker, not blocking UI

Given layout completes
When results are posted back
Then node positions should update smoothly

Given layout is running
When user interacts with scene
Then interaction should remain at 60fps
```

**Technical Notes:**
- Create `src/workers/layoutWorker.ts`
- Implement force-directed layout algorithm (e.g., d3-force)
- Post incremental updates (every 100 iterations)
- Support layout types: force-directed, hierarchical, radial, timeline
- Use transferable objects for large data

---

#### Story 32.5: Memory Management

**Priority:** P1
**Story Points:** 5

**Description:**
As a developer,
I want proactive memory management,
So that Voxel doesn't crash on large datasets.

**Acceptance Criteria:**

```gherkin
Given memory usage exceeds 1GB
When monitoring detects this
Then a warning should be shown to the user

Given nodes are removed from the scene
When cleanup runs
Then geometries, materials, and textures should be disposed

Given user views Voxel for extended period
When periodic cleanup runs
Then memory should stay stable (no leaks)
```

**Technical Notes:**
- Use `performance.memory` API (Chrome only) or estimate from node count
- Implement `dispose()` utility for Three.js resources
- Run garbage collection hint every 5 minutes: `renderer.dispose()`
- Show warning toast at 80% of 1.5GB threshold
- Implement node virtualization for extreme cases (>10K nodes)

---

#### Story 32.6: Performance Monitoring Dashboard

**Priority:** P1
**Story Points:** 3

**Description:**
As a developer,
I want a performance monitoring overlay,
So that I can identify bottlenecks.

**Acceptance Criteria:**

```gherkin
Given I enable "Debug Mode" (Shift+D)
When viewing
Then I should see FPS counter, draw calls, memory usage

Given FPS drops below 30
When monitoring
Then the overlay should turn red as warning

Given I want to benchmark
When I click "Run Benchmark"
Then a series of tests should run and report results
```

**Technical Notes:**
- Create `PerformanceOverlay.tsx` component
- Use `stats.js` or custom implementation
- Track: FPS, frame time, draw calls, triangles, textures, memory
- Position: top-right corner, toggle with Shift+D
- Log metrics to console for profiling

---

#### Story 32.7: Screenshot Export (PNG)

**Priority:** P1
**Story Points:** 3

**Description:**
As a user,
I want to take screenshots of the 3D view,
So that I can use them in reports and presentations.

**Acceptance Criteria:**

```gherkin
Given I click the Screenshot button
When the capture completes
Then a PNG should be downloaded with the current view

Given I press 'S' keyboard shortcut
When in Voxel
Then a screenshot should be taken

Given I want high resolution
When I select "HD Screenshot"
Then the image should be 4K resolution (3840x2160)
```

**Technical Notes:**
- Use `renderer.domElement.toDataURL('image/png')`
- For HD: temporarily resize renderer, capture, restore
- Include timestamp in filename: `voxel-screenshot-2026-01-17-143022.png`
- Option to include UI overlay or 3D only

---

#### Story 32.8: PDF Report Export

**Priority:** P1
**Story Points:** 5

**Description:**
As a RSSI,
I want to export a comprehensive Voxel report as PDF,
So that I can share insights with stakeholders.

**Acceptance Criteria:**

```gherkin
Given I click "Export PDF Report"
When the generation completes
Then a PDF should be downloaded with: summary, screenshots, metrics, anomalies

Given the report is generated
When viewing
Then it should have professional formatting with company branding

Given I select report sections
When customizing
Then I should be able to include/exclude: Executive Summary, Anomalies, Trends, Node List
```

**Technical Notes:**
- Use `@react-pdf/renderer` or `pdfmake`
- Sections: Cover, Executive Summary, 3D View Screenshots, Metrics Dashboard, Anomalies List, Node Inventory
- Multiple screenshots: overview, top risks zoomed, anomalies highlighted
- Include Data Health Score and trend indicators

---

#### Story 32.9: glTF 3D Export

**Priority:** P2
**Story Points:** 5

**Description:**
As a user,
I want to export the 3D scene as glTF,
So that I can view it in other 3D tools or share it.

**Acceptance Criteria:**

```gherkin
Given I click "Export 3D Model"
When the export completes
Then a .glb file should be downloaded with the current scene

Given I open the exported file in a 3D viewer
When viewing
Then node positions, colors, and connections should be preserved

Given I want to use in VR
When exporting
Then an optimized version for Quest/VisionPro should be available
```

**Technical Notes:**
- Use Three.js `GLTFExporter`
- Include: node meshes, edge lines, colors, positions
- Optimize for file size: compress textures, reduce geometry
- VR version: baked lighting, lower poly count

---

#### Story 32.10: Presentation Mode

**Priority:** P2
**Story Points:** 3

**Description:**
As a user,
I want a full-screen presentation mode,
So that I can present Voxel to an audience.

**Acceptance Criteria:**

```gherkin
Given I enter Presentation Mode
When activated
Then the view should go full-screen with hidden UI

Given I am in Presentation Mode
When I click/touch
Then a laser pointer effect should appear

Given I press Escape
When in Presentation Mode
Then it should exit and restore normal UI
```

**Technical Notes:**
- Use Fullscreen API: `document.documentElement.requestFullscreen()`
- Hide all UI except minimal controls (exit button)
- Laser pointer: red dot following cursor with trail effect
- Support presenter notes panel on secondary display (if available)

---

## Epic 33: Annotations & Collaboration

### Description

Implementer des outils d'annotation et de collaboration permettant aux utilisateurs de commenter et discuter directement sur les visualisations 3D.

### Objectif

Permettre aux equipes de collaborer sur l'analyse des risques directement dans Voxel avec des annotations persistantes.

### FRs Couverts

- **FR-VOXEL-010:** Annotations & Collaboration

### Stories

---

#### Story 33.1: Annotation Data Model

**Priority:** P0
**Story Points:** 3

**Description:**
As a developer,
I want a data model for annotations,
So that notes can be attached to nodes and persisted.

**Acceptance Criteria:**

```gherkin
Given an annotation is created
When stored
Then it should contain: id, nodeId, author, content, createdAt, mentions

Given an annotation mentions a user
When stored
Then the mention should be extracted and stored in mentions array

Given annotations exist for a node
When querying
Then they should be returned sorted by createdAt descending
```

**Technical Notes:**
- Create `annotations` collection in Firestore
- Fields: id, organizationId, nodeId, nodeType, author (userId), content, createdAt, updatedAt, mentions[], status (active/resolved), parentId (for threads)
- Add index on (nodeId, createdAt)
- Security rules: org members can read/write

---

#### Story 33.2: Annotation Creation UI

**Priority:** P0
**Story Points:** 5

**Description:**
As an auditor,
I want to add annotations to nodes,
So that I can document my findings.

**Acceptance Criteria:**

```gherkin
Given I right-click on a node
When the context menu appears
Then I should see "Add Annotation" option

Given I click "Add Annotation"
When the input appears
Then I should be able to type my note with @mentions support

Given I submit the annotation
When saved
Then it should appear as a floating label near the node
```

**Technical Notes:**
- Create `AnnotationPopover.tsx` component
- Use contentEditable or textarea with @mention detection
- Show author avatar and timestamp
- Position near node using 3D to screen projection

---

#### Story 33.3: Annotation Visualization in 3D

**Priority:** P0
**Story Points:** 5

**Description:**
As a user,
I want to see annotations as floating labels in 3D,
So that I can see where notes have been added.

**Acceptance Criteria:**

```gherkin
Given a node has annotations
When viewing the scene
Then an annotation icon should be visible near the node

Given I hover over the annotation icon
When displayed
Then the full annotation text should appear

Given multiple annotations exist on a node
When viewing
Then a badge should show the count, clicking opens thread view
```

**Technical Notes:**
- Create `AnnotationMarker.tsx` using `drei`'s Html component
- Use Three.js sprite or HTML overlay for marker
- Position offset from node to avoid occlusion
- Animate marker to draw attention (subtle pulse)

---

#### Story 33.4: Annotation Thread/Discussion

**Priority:** P1
**Story Points:** 5

**Description:**
As a team member,
I want to reply to annotations,
So that we can have discussions about findings.

**Acceptance Criteria:**

```gherkin
Given I view an annotation
When I click "Reply"
Then I should be able to add a response in a thread

Given a thread has multiple replies
When viewing
Then they should appear chronologically below the parent

Given a discussion is resolved
When I click "Mark Resolved"
Then the thread should be collapsed and marked as resolved
```

**Technical Notes:**
- Use `parentId` field for threading
- Create `AnnotationThread.tsx` component
- Show thread in slide-out panel or modal
- Status: active, resolved - resolved threads can be hidden/shown

---

#### Story 33.5: @Mention Notifications

**Priority:** P1
**Story Points:** 3

**Description:**
As a user,
I want to be notified when mentioned in an annotation,
So that I don't miss important discussions.

**Acceptance Criteria:**

```gherkin
Given I am mentioned in an annotation (@username)
When the annotation is saved
Then I should receive an in-app notification

Given I click the notification
When it opens
Then I should be taken to Voxel with that node selected and annotation visible

Given I am mentioned in multiple annotations
When viewing notifications
Then they should be grouped by thread
```

**Technical Notes:**
- Extract mentions using regex: `/@(\w+)/g`
- Lookup userId from username
- Create notification via `notificationService`
- Deep link: `/voxel?node=<nodeId>&annotation=<annotationId>`

---

#### Story 33.6: Annotation Export

**Priority:** P2
**Story Points:** 2

**Description:**
As an auditor,
I want to export annotations with reports,
So that documentation includes my findings.

**Acceptance Criteria:**

```gherkin
Given I export a PDF report
When annotations exist
Then they should be included in a dedicated section

Given I export node details
When that node has annotations
Then annotations should be listed below node data

Given I filter export by date range
When specified
Then only annotations in that range should be included
```

**Technical Notes:**
- Add "Include Annotations" checkbox in export options
- Format: Node Name -> Annotation -> Author, Date, Content
- Group by node in PDF section

---

## Epic 34: Fondation AR/VR

### Description

Preparer le module Voxel pour les experiences immersives futures en implementant la detection WebXR et une experience VR de base.

### Objectif

Poser les fondations pour l'immersif avec detection WebXR et navigation VR basique fonctionnelle.

### FRs Couverts

- **FR-VOXEL-011:** AR/VR Foundation (Future-Ready)

### Stories

---

#### Story 34.1: WebXR Detection & UI

**Priority:** P1
**Story Points:** 3

**Description:**
As a user,
I want to know if my device supports VR/AR,
So that I can access immersive features when available.

**Acceptance Criteria:**

```gherkin
Given I open Voxel on a VR-capable device
When WebXR is detected
Then I should see an "Enter VR" button

Given I open Voxel on a non-VR device
When WebXR is not available
Then the VR button should not be shown

Given I connect a VR headset mid-session
When detected
Then the VR button should appear dynamically
```

**Technical Notes:**
- Check `navigator.xr?.isSessionSupported('immersive-vr')`
- Create `VRButton.tsx` component that shows/hides based on support
- Use `@react-three/xr` for VR integration
- Detect changes using `devicechange` event

---

#### Story 34.2: Basic VR Navigation

**Priority:** P1
**Story Points:** 5

**Description:**
As a VR user,
I want to navigate the Voxel scene with controllers,
So that I can explore the 3D graph in immersive VR.

**Acceptance Criteria:**

```gherkin
Given I enter VR mode
When I use the thumbstick
Then I should move through the scene smoothly

Given I point at a node with the controller
When the ray intersects
Then the node should highlight

Given I press trigger while pointing at a node
When selected
Then the detail panel should appear in VR space
```

**Technical Notes:**
- Use `@react-three/xr` for VR session management
- Implement teleport or smooth locomotion
- Ray casting from controller for selection
- Floating UI panels using `drei`'s Html in VR

---

#### Story 34.3: VR-Optimized Scene

**Priority:** P2
**Story Points:** 5

**Description:**
As a developer,
I want a VR-optimized version of the scene,
So that it maintains 72fps in VR headsets.

**Acceptance Criteria:**

```gherkin
Given VR mode is active
When rendering
Then the scene should use lower LOD models

Given VR mode is active
When rendering
Then postprocessing effects should be disabled for performance

Given VR headset requires 72fps
When rendering
Then frame time should stay under 14ms
```

**Technical Notes:**
- Create VR-specific rendering path
- Disable: bloom, SSAO, antialiasing in VR
- Use lower LOD models automatically
- Reduce max visible nodes if needed
- Target: 72fps on Quest 2, 90fps on Quest Pro

---

#### Story 34.4: AR Mobile Preview (WebXR)

**Priority:** P3
**Story Points:** 5

**Description:**
As a mobile user,
I want to see the Voxel graph projected in my space,
So that I can view it in augmented reality on my phone.

**Acceptance Criteria:**

```gherkin
Given I open Voxel on an AR-capable mobile device
When I click "View in AR"
Then the camera should activate with the graph overlaid

Given the graph is in AR
When I move my phone
Then the graph should stay anchored in space

Given I tap on a node in AR
When selected
Then its details should appear as an AR card
```

**Technical Notes:**
- Check `navigator.xr?.isSessionSupported('immersive-ar')`
- Use WebXR hit-test for surface detection
- Anchor graph to detected surface
- Scale graph appropriately for room-scale viewing
- Works on ARCore (Android) and ARKit (iOS via Safari)

---

#### Story 34.5: glTF Export for VR Headsets

**Priority:** P3
**Story Points:** 3

**Description:**
As a user,
I want to export the scene optimized for VR viewers,
So that I can view it on standalone VR headsets.

**Acceptance Criteria:**

```gherkin
Given I click "Export for VR"
When the export completes
Then a glTF file optimized for Quest/VisionPro should be downloaded

Given I open the file on Quest
When viewing
Then performance should be acceptable (>72fps)

Given the export includes current state
When viewing
Then selections and highlights should be preserved
```

**Technical Notes:**
- Bake lighting into vertex colors or simple textures
- Reduce geometry complexity (target <100K triangles total)
- Include navigation hints (teleport targets)
- Use Draco compression for smaller file size

---

## Appendix: Story Points Summary

| Epic | Stories | Total Points | Estimated Sprints |
|------|---------|--------------|-------------------|
| 28 | 5 | 26 | 1.5 |
| 29 | 9 | 44 | 3.5 |
| 30 | 8 | 42 | 3.5 |
| 31 | 10 | 45 | 4 |
| 32 | 10 | 45 | 3.5 |
| 33 | 6 | 23 | 1.5 |
| 34 | 5 | 21 | 1 |
| **Total** | **53** | **246** | **~18.5** |

## Glossary

- **BFS:** Breadth-First Search algorithm
- **DFS:** Depth-First Search algorithm
- **FPS:** Frames Per Second
- **glTF:** GL Transmission Format (3D file format)
- **LOD:** Level of Detail
- **MTTR:** Mean Time To Recover
- **R3F:** React Three Fiber
- **WebXR:** Web API for VR/AR experiences

---

**Document cree par:** Claude (Architecte)
**Date:** 2026-01-17
**Statut:** Ready for Implementation
**Prochaine etape:** Sprint Planning - commencer par Epic 28 (Real-time Foundation)
