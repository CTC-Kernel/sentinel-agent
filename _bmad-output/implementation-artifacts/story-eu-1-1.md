---
story_id: EU-1.1
epic_id: EU-1
title: Créer le data model Framework
status: done
priority: P0
points: 5
sprint: 1
assignee: dev
created: 2026-01-23
source: epics-european-leader-2026-01-22.md
---

# Story EU-1.1: Créer le data model Framework

## User Story

**As a** developer,
**I want** a Firestore data model for frameworks and requirements,
**So that** we can store and query regulatory data efficiently.

## Acceptance Criteria

### AC1: Framework Types
**Given** the TypeScript codebase
**When** I import from `src/types/framework.ts`
**Then** I have access to Framework, Requirement, and ControlMapping types
**And** types are strictly typed with enums for codes and categories

### AC2: Firestore Collections
**Given** the Firestore database
**When** I query the framework collections
**Then** I can access `frameworks`, `requirements`, and `controlMappings` collections
**And** data is properly typed

### AC3: Composite Indexes
**Given** the firestore.indexes.json configuration
**When** indexes are deployed
**Then** cross-framework queries are optimized
**And** organization-scoped queries perform efficiently

### AC4: Security Rules
**Given** the Firestore security rules
**When** a user queries framework data
**Then** they can only read (frameworks are read-only for users)
**And** organization-specific mappings are isolated

## Technical Notes

- Implement types in `src/types/framework.ts`
- Create Firestore collections schema documentation
- Add composite indexes for common queries:
  - `controlMappings` by `frameworkId` + `controlId`
  - `requirements` by `frameworkId` + `category`
  - `complianceScores` by `organizationId` + `calculatedAt`
- Security rules enforce organization isolation

## Architecture Reference

See ADR-001 in `architecture-european-leader-2026-01-22.md`:
- Normalized data model with separate mapping tables
- Types: Framework, Requirement, ControlMapping
- Support for cross-framework queries

## Tasks

- [x] Create `src/types/framework.ts` with all types
- [x] Create `src/types/compliance.ts` for scoring types
- [x] Update `firestore.indexes.json` with new indexes
- [x] Export types from `src/types/index.ts` barrel file
- [x] Write unit tests for types validation (31 tests passing)

## Definition of Done

- [x] Types compile without errors
- [x] Indexes are configured
- [x] Types are exported from barrel file
- [x] Code passes linting
- [x] Unit tests pass (31/31)
