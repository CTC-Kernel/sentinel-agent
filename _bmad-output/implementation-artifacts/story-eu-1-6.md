---
story_id: EU-1.6
epic_id: EU-1
title: Seed NIS2 Framework Data
status: done
priority: P0
points: 8
sprint: 1
assignee: dev
created: 2026-01-23
completed: 2026-01-23
source: epics-european-leader-2026-01-22.md
---

# Story EU-1.6: Seed NIS2 Framework Data

## User Story

**As a** product owner,
**I want** NIS2 framework data pre-loaded,
**So that** users can immediately start their NIS2 compliance journey.

## Acceptance Criteria

### AC1: NIS2 Requirements Available
**Given** a new organization activates NIS2
**When** they view NIS2 requirements
**Then** they see all 21 articles with sub-requirements
**And** requirements are categorized (governance, risk, incident, etc.)
**And** each has criticality assigned (high/medium/low)

### AC2: Control Mapping Templates
**Given** the NIS2 data
**When** I check the control mappings
**Then** each requirement has suggested control templates

### AC3: Bilingual Support
**Given** the NIS2 data
**When** I view requirements
**Then** content is available in both French and English

## Technical Notes

- Create seed script: `scripts/seed-nis2.ts`
- Source: Official NIS2 directive (Directive (EU) 2022/2555)
- Include French and English translations
- Run via Cloud Function or admin script
- Categories: governance, risk_management, incident_response, supply_chain, security_measures, continuity, cryptography, access_control, reporting

## Dependencies

- Story EU-1.1 (Framework types) - COMPLETED
- Story EU-1.2 (FrameworkService) - COMPLETED

## Tasks

- [x] Create NIS2 seed data file with all articles (`scripts/nis2-seed-data.ts`)
- [x] Include bilingual content (FR/EN)
- [x] Add category and criticality assignments
- [x] Create seed script (`scripts/seed-nis2.ts`)
- [x] Add control mapping templates (ISO 27001 mappings)
- [x] Create Cloud Function (`functions/callable/seedNIS2Framework.js`)
- [x] Add FrameworkService.seedNIS2Framework() method

## Definition of Done

- [x] All NIS2 articles seeded (21 requirements from Articles 20, 21, 22, 23)
- [x] Bilingual content (FR/EN)
- [x] Categories assigned (governance, risk_management, incident_response, supply_chain, security_measures, continuity, cryptography, access_control, reporting, training)
- [x] Criticality levels assigned (high/medium/low)
- [x] Control templates linked (ISO 27001:2022 A.5-A.8)
- [x] Data accessible via FrameworkService.seedNIS2Framework()
