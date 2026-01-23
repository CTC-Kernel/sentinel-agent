---
story_id: EU-1.5
epic_id: EU-1
title: Implémenter le Cross-Framework Mapping
status: in-progress
priority: P0
points: 8
sprint: 1
assignee: dev
created: 2026-01-23
source: epics-european-leader-2026-01-22.md
---

# Story EU-1.5: Implémenter le Cross-Framework Mapping

## User Story

**As a** RSSI,
**I want** to see which controls satisfy multiple frameworks,
**So that** I can optimize my compliance efforts.

## Acceptance Criteria

### AC1: Control Mappings View
**Given** I am on the Mapping page
**When** I view a control
**Then** I see all frameworks it maps to with coverage percentage

### AC2: Mapping Matrix View
**Given** I am viewing the mapping matrix
**When** I select "View by Control"
**Then** I see a table with controls as rows and frameworks as columns
**And** cells indicate mapping status (full, partial, none)

### AC3: Requirement Details on Hover
**Given** I am viewing the mapping matrix
**When** I hover over a mapped cell
**Then** I see the specific requirements covered

### AC4: Filter and Search
**Given** the mapping matrix
**When** I use search or filters
**Then** I can find controls by name or filter by framework

## Technical Notes

- Component: `src/components/frameworks/MappingMatrix.tsx`
- Use intersection logic for cross-framework coverage
- Use `useMappingsByFramework()` hook
- Use `useControlWithMappings()` hook
- Follow Apple design system

## Dependencies

- Story EU-1.1 (Framework types) - COMPLETED
- Story EU-1.2 (FrameworkService) - COMPLETED
- Story EU-1.3 (FrameworkSelector) - COMPLETED
- Story EU-1.4 (RequirementsList) - COMPLETED

## Tasks

- [ ] Create `MappingMatrix.tsx` component
- [ ] Create `MappingCell.tsx` for matrix cells
- [ ] Create `MappingTooltip.tsx` for hover details
- [ ] Create `ControlMappingCard.tsx` for control view
- [ ] Add search and filter functionality
- [ ] Add translations
- [ ] Write component tests

## Definition of Done

- [ ] Matrix displays controls vs frameworks
- [ ] Coverage status shown (full/partial/none)
- [ ] Hover shows requirement details
- [ ] Search and filter work correctly
- [ ] i18n support (FR/EN)
- [ ] Tests passing
