---
story_id: EU-1.2
epic_id: EU-1
title: Implémenter FrameworkService
status: done
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

- [x] Create `src/services/FrameworkService.ts` with static methods
- [x] Implement `getFrameworks()` with Firestore query
- [x] Implement `getRequirements(frameworkId)` with category grouping
- [x] Implement `getMappings(controlId)` for cross-framework queries
- [x] Implement `subscribeToFrameworks()` for real-time updates
- [x] Create `src/hooks/useFrameworks.ts` hook with TanStack Query
- [x] Write unit tests for FrameworkService (15 tests)
- [x] Write unit tests for useFrameworks hook (11 tests)

## Definition of Done

- [x] All CRUD methods implemented
- [x] TanStack Query integration working
- [x] Real-time subscriptions working
- [x] Error handling with ErrorLogger
- [x] Unit tests passing (26/26)
- [x] Code passes linting
