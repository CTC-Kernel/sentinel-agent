---
story_id: EU-1.4
epic_id: EU-1
title: Créer la vue RequirementsList
status: done
priority: P0
points: 8
sprint: 1
assignee: dev
created: 2026-01-23
completed: 2026-01-23
source: epics-european-leader-2026-01-22.md
---

# Story EU-1.4: Créer la vue RequirementsList

## User Story

**As a** RSSI,
**I want** to browse requirements by framework,
**So that** I understand what I need to comply with.

## Acceptance Criteria

### AC1: Requirements Display by Framework
**Given** I select a framework (e.g., NIS2)
**When** the requirements list loads
**Then** I see all requirements grouped by category
**And** each requirement shows article reference, title, and criticality

### AC2: Requirement Detail View
**Given** I am viewing requirements
**When** I click on a requirement
**Then** I see the full description and linked controls
**And** I can navigate to each linked control

### AC3: Filtering
**Given** I am viewing requirements
**When** I use the filter controls
**Then** I can filter by category, criticality, and compliance status

### AC4: Performance
**Given** a framework with 500+ requirements
**When** I view the requirements list
**Then** the list renders smoothly without lag
**And** uses virtualization for performance

## Technical Notes

- Component: `src/components/frameworks/RequirementsList.tsx`
- Use virtualized list for performance (react-window or @tanstack/react-virtual)
- Implement category accordion pattern
- Use `useRequirements()` hook from EU-1.2
- Follow Apple design system (glass morphism, smooth animations)

## Dependencies

- Story EU-1.1 (Framework types) - COMPLETED
- Story EU-1.2 (FrameworkService) - COMPLETED
- Story EU-1.3 (FrameworkSelector) - COMPLETED

## Tasks

- [x] Create `RequirementCard.tsx` component
- [x] Create `RequirementsList.tsx` with category accordion
- [x] Create `RequirementInspector.tsx` for detail view
- [x] Add filtering UI (category, criticality, status)
- [x] Implement virtualization for large lists
- [x] Add translations to `public/locales/*/translation.json`
- [x] Write component tests

## Definition of Done

- [x] Requirements display grouped by category
- [x] Click opens detail inspector with linked controls
- [x] Filtering works correctly
- [x] Virtualization enabled for performance
- [x] Animations are smooth (60fps)
- [x] i18n support (FR/EN)
- [x] Tests passing
