---
story_id: EU-5.3
epic_id: EU-5
title: German Translation
status: done
priority: P1
points: 5
sprint: 2
assignee: dev
created: 2026-01-23
completed: 2026-01-23
source: epics-european-leader-2026-01-22.md
---

# Story EU-5.3: German Translation

## User Story

**As a** German-speaking RSSI or compliance officer,
**I want** the application interface in German,
**So that** I can use Sentinel GRC in my native language for the DACH market.

## Acceptance Criteria

### AC1: German Translation File ✅
**Given** the i18n infrastructure exists
**When** I switch to German language
**Then** all UI text displays in German
**And** all sections are translated (common, sidebar, settings, risks, etc.)

### AC2: Language Selector Updated ✅
**Given** I access profile settings
**When** I view the language dropdown
**Then** I see "Deutsch" as an option alongside Français and English

### AC3: Store Type Support ✅
**Given** the application state management
**When** German is selected
**Then** the language persists in localStorage
**And** the type system supports 'de' as a valid language

### AC4: Comprehensive Coverage ✅
**Given** the German translation file
**When** I compare to English/French translations
**Then** all major namespaces are covered:
  - common, validation, tour, sidebar
  - frameworks, settings, commandPalette
  - risks, assets, compliance, audits
  - incidents, suppliers, documents, projects
  - continuity, privacy, dashboard, notifications
  - auth, onboarding, actions, sectors, voxel

## Technical Notes

- Translation file: `public/locales/de/translation.json`
- Store type: `src/store.ts` - language union type updated
- Settings UI: `src/components/settings/ProfileSettings.tsx` - Deutsch option added
- i18n backend automatically loads German locale via HttpBackend

## Dependencies

- Existing i18n infrastructure (react-i18next)
- HttpBackend for dynamic locale loading
- FR/EN translation files as reference

## Tasks

- [x] Create German translation file with all namespaces
- [x] Update store.ts language type to include 'de'
- [x] Add Deutsch option to ProfileSettings language selector
- [x] Verify i18n backend loads German locale

## Definition of Done

- [x] German translation file created at public/locales/de/translation.json
- [x] Store type updated: 'fr' | 'en' | 'de'
- [x] ProfileSettings shows Deutsch option
- [x] Language selection persists correctly

## Implementation Summary

### Files Created/Modified

1. **`public/locales/de/translation.json`** (NEW)
   - Comprehensive German translations covering all namespaces
   - 25+ top-level sections translated
   - Professional German terminology for GRC domain
   - Industry-specific terms (DSGVO for GDPR, etc.)

2. **`src/store.ts`** (MODIFIED)
   - Line 28: `language: 'fr' | 'en' | 'de';`
   - Line 29: `setLanguage: (lang: 'fr' | 'en' | 'de') => void;`
   - Line 52: `language: (safeGetItem('language') as 'fr' | 'en' | 'de') || 'fr',`

3. **`src/components/settings/ProfileSettings.tsx`** (MODIFIED)
   - Added `{ value: 'de', label: 'Deutsch' }` to language options
   - Updated onChange type to include 'de'

### Translation Coverage

| Namespace | Status | Key Sections |
|-----------|--------|--------------|
| common | ✅ | save, cancel, delete, edit, create, search, etc. |
| validation | ✅ | required, email, minLength, maxLength, etc. |
| tour | ✅ | welcome, dashboard, risks, assets, etc. |
| sidebar | ✅ | dashboard, risks, assets, compliance, etc. |
| frameworks | ✅ | all, select, searchPlaceholder, etc. |
| settings | ✅ | profile, security, team, organization, etc. |
| risks | ✅ | title, create, impact, probability, etc. |
| assets | ✅ | title, create, type, criticality, etc. |
| compliance | ✅ | title, controls, score, progress, etc. |
| audits | ✅ | title, create, status, findings, etc. |
| incidents | ✅ | title, create, severity, status, etc. |
| suppliers | ✅ | title, create, category, criticality, etc. |
| documents | ✅ | title, create, version, status, etc. |
| projects | ✅ | title, create, status, progress, etc. |
| continuity | ✅ | title, bcp, rto, rpo, etc. |
| privacy | ✅ | title, dpia, processing, etc. |
| dashboard | ✅ | welcome, stats, widgets, etc. |
| notifications | ✅ | title, markRead, settings, etc. |
| auth | ✅ | login, logout, email, password, etc. |
| onboarding | ✅ | welcome, steps, industries, etc. |
| sectors | ✅ | finance, health, tech, industrie, etc. |
| voxel | ✅ | title, nodes, edges, filters, etc. |

### DACH Market Terminology

- GDPR → DSGVO (Datenschutz-Grundverordnung)
- Privacy → Datenschutz
- Compliance → Compliance (German IT uses English term)
- Risk → Risiko
- Asset → Vermögenswert / Asset
- Control → Kontrolle / Maßnahme
- Audit → Audit / Prüfung
