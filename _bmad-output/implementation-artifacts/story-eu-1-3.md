---
story_id: EU-1.3
epic_id: EU-1
title: Créer le composant FrameworkSelector
status: done
priority: P0
points: 3
sprint: 1
assignee: dev
created: 2026-01-23
completed: 2026-01-23
source: epics-european-leader-2026-01-22.md
---

# Story EU-1.3: Créer le composant FrameworkSelector

## User Story

**As a** compliance manager,
**I want** to select and activate regulatory frameworks for my organization,
**So that** I can track compliance against relevant regulations.

## Acceptance Criteria

### AC1: Framework List Display
**Given** the FrameworkSelector component
**When** I open the selector
**Then** I see all available frameworks (NIS2, DORA, RGPD, AI Act, ISO27001, etc.)
**And** each framework shows name, jurisdiction, and effective date

### AC2: Active Framework Indication
**Given** the FrameworkSelector component
**When** I view the list
**Then** already activated frameworks are visually marked
**And** I can see the activation date

### AC3: Activate Framework
**Given** an inactive framework
**When** I click to activate it
**Then** a confirmation modal appears with options (target date, notes)
**And** on confirm, the framework is activated for my organization

### AC4: Deactivate Framework
**Given** an active framework
**When** I click to deactivate it
**Then** a warning modal appears explaining impact
**And** on confirm, the framework is deactivated

### AC5: Real-time Updates
**Given** the FrameworkSelector component
**When** another user activates/deactivates a framework
**Then** the UI updates in real-time without refresh

## Technical Notes

- Use `useFrameworks()` and `useActiveFrameworks()` hooks
- Use `useFrameworkActivation()` mutation hook
- Follow Apple design system (glass morphism, smooth animations)
- Component location: `src/components/frameworks/FrameworkSelector.tsx`
- Include confirmation modals with Framer Motion animations

## Dependencies

- Story EU-1.1 (Framework types) - COMPLETED
- Story EU-1.2 (FrameworkService) - COMPLETED

## Design Reference

- Use card-based layout similar to existing control cards
- Active frameworks have colored border (green)
- Hover state shows "Activate" or "Deactivate" action
- Use existing i18n patterns for translations

## Tasks

- [x] Create `src/components/frameworks/FrameworkSelector.tsx`
- [x] Create `FrameworkCard` sub-component
- [x] Create `ActivateFrameworkModal.tsx`
- [x] Create `DeactivateFrameworkModal.tsx`
- [x] Add translations to `public/locales/*/translation.json`
- [x] Write component tests

## Definition of Done

- [x] Component renders framework list correctly
- [x] Activation/deactivation works with modals
- [x] Real-time updates via subscription
- [x] Animations are smooth (60fps)
- [x] Accessible (keyboard navigation, ARIA)
- [x] i18n support (FR/EN)
- [x] Tests passing
