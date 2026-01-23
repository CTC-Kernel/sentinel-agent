---
story_id: EU-2.4
epic_id: EU-2
title: Créer le composant ActionsList
status: done
priority: P1
points: 5
sprint: 2
assignee: dev
created: 2026-01-23
completed: 2026-01-23
source: epics-european-leader-2026-01-22.md
---

# Story EU-2.4: Créer le composant ActionsList

## User Story

**As a** RSSI,
**I want** prioritized action recommendations,
**So that** I know where to focus my efforts.

## Acceptance Criteria

### AC1: Display Priority Actions ✅
**Given** I am on the dashboard
**When** I view the ActionsList
**Then** I see 3-5 recommended actions sorted by impact
**And** each action shows potential score improvement

### AC2: Action Navigation ✅
**Given** an action is displayed
**When** I click on it
**Then** I navigate to the relevant control or requirement

### AC3: Action Completion ✅
**Given** I complete an action
**When** I return to the dashboard
**Then** the action is removed and replaced with the next priority

## Technical Notes

- Component: `src/components/compliance/dashboard/PriorityActionsList.tsx`
- Algorithm: prioritize by (criticality × gap_size)
- Link to control assessment flow
- Use existing score data from useComplianceScore hook

## Dependencies

- Story EU-2.1 (ScoringEngine) - BROWNFIELD DONE
- Story EU-2.5 (Compliance Store) - BROWNFIELD DONE

## Tasks

- [x] Create PriorityActionsList component
- [x] Implement action prioritization algorithm
- [x] Add navigation to controls
- [x] Add translations (FR/EN)
- [x] Write tests (28 tests)

## Definition of Done

- [x] Component displays 3-5 priority actions
- [x] Actions sorted by impact (criticality × gap)
- [x] Click navigates to relevant control
- [x] i18n support (FR/EN)
- [x] Tests passing (28 tests)

## Implementation Summary

### Files Created/Modified

1. **`src/components/compliance/dashboard/PriorityActionsList.tsx`** (NEW)
   - Priority action generation algorithm
   - Criticality calculation by control code domain (A.5, A.8, A.12 = high)
   - Gap score calculation by status
   - Action types: implement, complete, add_evidence
   - Apple design system styling (glass-premium, rounded corners)
   - Framer Motion animations

2. **`src/components/compliance/ComplianceDashboard.tsx`** (MODIFIED)
   - Integrated PriorityActionsList in sidebar layout

3. **`public/locales/fr/translation.json`** (MODIFIED)
   - Added `actions` section translations

4. **`public/locales/en/translation.json`** (MODIFIED)
   - Added `actions` section translations

5. **`src/components/compliance/dashboard/__tests__/PriorityActionsList.test.tsx`** (NEW)
   - 28 comprehensive tests covering:
     - Rendering (title, subtitle, empty state, count, hint)
     - Priority sorting (impact score, gap scores)
     - Action types (implement, complete, add_evidence)
     - Control display (code, name, status)
     - maxActions prop (limits, defaults)
     - Navigation (click, callback)
     - Criticality calculation (A.5, A.8, A.12, A.6, NIS2)
     - Filtering (implemented controls)
     - Potential improvement display
     - Priority numbering
