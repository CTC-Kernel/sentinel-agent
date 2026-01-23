---
story_id: EU-1.2
epic_id: EU-1
title: Implémenter FrameworkService
status: ready-for-dev
priority: P0
points: 5
sprint: 1
assignee: null
created: 2026-01-23
source: epics-european-leader-2026-01-22.md
---

# Story EU-1.2: Implémenter FrameworkService

## User Story

**As a** developer,
**I want** a FrameworkService with CRUD operations,
**So that** components can interact with framework data.

## Acceptance Criteria

### AC1: getFrameworks
**Given** the FrameworkService class
**When** I call `getFrameworks()`
**Then** it returns all available frameworks with metadata
**And** results are cached via TanStack Query

### AC2: getRequirements
**Given** the FrameworkService class
**When** I call `getRequirements(frameworkId)`
**Then** it returns all requirements for that framework
**And** requirements are grouped by category

### AC3: getMappings
**Given** the FrameworkService class
**When** I call `getMappings(controlId)`
**Then** it returns all framework mappings for that control

### AC4: Real-time Subscription
**Given** the FrameworkService class
**When** I call `subscribeToFrameworks(callback)`
**Then** it returns an unsubscribe function
**And** callback is invoked when framework data changes

### AC5: Error Handling
**Given** any FrameworkService method
**When** a Firestore error occurs
**Then** it uses `ErrorLogger.handleErrorWithToast()` for errors
**And** returns appropriate error state

## Technical Notes

- Follow static method pattern per project-context.md
- Use `ErrorLogger.handleErrorWithToast()` for errors
- Implement in `src/services/FrameworkService.ts`
- Create corresponding hook `src/hooks/useFrameworks.ts` with TanStack Query

## Dependencies

- Story EU-1.1 (Framework types) - COMPLETED

## Tasks

- [ ] Create `src/services/FrameworkService.ts` with static methods
- [ ] Implement `getFrameworks()` with Firestore query
- [ ] Implement `getRequirements(frameworkId)` with category grouping
- [ ] Implement `getMappings(controlId)` for cross-framework queries
- [ ] Implement `subscribeToFrameworks()` for real-time updates
- [ ] Create `src/hooks/useFrameworks.ts` hook
- [ ] Write unit tests for FrameworkService
- [ ] Write unit tests for useFrameworks hook

## Definition of Done

- [ ] All CRUD methods implemented
- [ ] TanStack Query integration working
- [ ] Real-time subscriptions working
- [ ] Error handling with ErrorLogger
- [ ] Unit tests passing (>80% coverage)
- [ ] Code passes linting
