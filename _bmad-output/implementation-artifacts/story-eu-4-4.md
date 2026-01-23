---
story_id: EU-4.4
epic_id: EU-4
title: Seed Sector Templates
status: done
priority: P1
points: 5
sprint: 2
assignee: dev
created: 2026-01-23
completed: 2026-01-23
source: epics-european-leader-2026-01-22.md
---

# Story EU-4.4: Seed Sector Templates

## User Story

**As a** RSSI starting onboarding,
**I want** pre-configured frameworks and controls for my industry,
**So that** I can quickly get started with relevant compliance requirements.

## Acceptance Criteria

### AC1: Industry-Specific Framework Recommendations ✅
**Given** I select my industry during onboarding
**When** I reach the standards selection step
**Then** I see frameworks recommended for my sector
**And** mandatory frameworks are pre-selected

### AC2: Mandatory Framework Indication ✅
**Given** frameworks are displayed
**When** a framework is mandatory for my sector
**Then** it shows "Obligatoire/Mandatory" label
**And** it is pre-selected by default

### AC3: Sector Coverage ✅
**Given** the system supports sector templates
**When** I check available sectors
**Then** I find: Finance, Santé, Tech/SaaS, Industrie/OT, Public, Retail, Other

### AC4: Control Prioritization ✅
**Given** a sector template
**When** I view its control priorities
**Then** controls are marked as critical/high/medium/low
**And** reasons are provided (i18n keys)

## Technical Notes

- Data file: `src/data/sectorTemplates.ts`
- Integration: `src/views/Onboarding.tsx` step 3
- Types: `IndustryType`, `SectorTemplate`, `SectorControlPriority`
- i18n keys in `sectors.*` namespace

## Dependencies

- Existing onboarding flow (step 1 captures industry)
- Framework definitions in `src/data/complianceData.ts`

## Tasks

- [x] Create sectorTemplates.ts data file
- [x] Define templates for all sectors (Finance, Health, Tech, Industrie, Public, Retail, Other)
- [x] Add control priorities with reasons
- [x] Add specific requirements per sector
- [x] Add regulatory context with URLs
- [x] Add translations (FR/EN)
- [x] Add "industrie" option to onboarding
- [x] Integrate with onboarding step 3
- [x] Pre-select mandatory frameworks
- [x] Write tests (41 tests)

## Definition of Done

- [x] 7 sector templates defined
- [x] Each template has recommended + mandatory frameworks
- [x] Control priorities with criticality levels
- [x] Specific requirements documented
- [x] Regulatory context with URLs
- [x] FR/EN translations complete
- [x] Onboarding displays sector-specific frameworks
- [x] Mandatory frameworks pre-selected
- [x] Tests passing (41 tests)

## Implementation Summary

### Files Created/Modified

1. **`src/data/sectorTemplates.ts`** (NEW)
   - 7 sector templates (finance, health, tech, industrie, public, retail, other)
   - `SectorTemplate` type with: id, nameKey, descriptionKey, recommendedFrameworks, mandatoryFrameworks, controlPriorities, specificRequirements, regulatoryContext
   - `SectorControlPriority` with: code, priority (critical/high/medium/low), reason
   - Utility functions: `getSectorTemplate()`, `getRecommendedFrameworks()`, `getMandatoryFrameworks()`, `getPrioritizedControls()`, `isControlCritical()`, `getIndustriesRequiringFramework()`

2. **`src/data/__tests__/sectorTemplates.test.ts`** (NEW)
   - 41 comprehensive tests covering:
     - Template data integrity (all industries, required fields)
     - Sector-specific frameworks (DORA for finance, HDS for health, etc.)
     - Mandatory vs recommended framework distinction
     - Control prioritization and sorting
     - Specific requirements per sector
     - Regulatory context validation

3. **`src/views/Onboarding.tsx`** (MODIFIED)
   - Added import for sector templates
   - Added "industrie" option to industry select
   - Added `frameworkDisplayNames` mapping (Framework ID → display name)
   - Added `getIndustryFrameworks()` callback
   - Added useEffect to pre-select mandatory frameworks on step 3
   - Updated step 3 UI to show sector-specific frameworks with mandatory labels

4. **`public/locales/fr/translation.json`** (MODIFIED)
   - Added "industrie" to onboarding.industries
   - Added comprehensive `sectors` namespace with translations for all sectors

5. **`public/locales/en/translation.json`** (MODIFIED)
   - Added "industrie" to onboarding.industries
   - Added comprehensive `sectors` namespace with English translations

### Sector Template Summary

| Sector | Mandatory Frameworks | Key Focus |
|--------|---------------------|-----------|
| Finance | DORA, NIS2 | ICT risk, incident reporting, TLPT |
| Health | HDS, GDPR | Patient data, encryption, consent |
| Tech | ISO27001 | DevSecOps, SOC2, secure SDLC |
| Industrie | NIS2 | OT/IT segmentation, continuity |
| Public | GDPR | RGS, ANSSI homologation, EBIOS |
| Retail | PCI_DSS, GDPR | Payment security, customer consent |
| Other | - | Basic ISO 27001 + GDPR baseline |
