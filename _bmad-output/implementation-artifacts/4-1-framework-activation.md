# Story 4.1: Framework Activation

Status: done

## Story

As an **administrator**,
I want **to activate multiple compliance frameworks**,
So that **my organization tracks all required standards**.

## Acceptance Criteria

1. **Given** the user is in Organization Settings
   **When** they access Framework Configuration
   **Then** they can enable/disable: ISO 27001, NIS2, DORA, RGPD

2. **Given** the user enables frameworks
   **When** they save the settings
   **Then** enabled frameworks appear in the compliance module

3. **Given** the user views the compliance module
   **When** frameworks are enabled
   **Then** relevant controls are available for each framework

4. **Given** the subscription tier has limits
   **When** the user tries to enable more frameworks
   **Then** the system respects subscription tier limits

## Tasks / Subtasks

- [x] **Task 1: Update Organization Type** (AC: 1, 2)
  - [x] 1.1 Add `enabledFrameworks: Framework[]` field to Organization interface
  - [x] 1.2 Add `maxFrameworks` to PlanLimits interface

- [x] **Task 2: Create Framework Settings Component** (AC: 1, 4)
  - [x] 2.1 Create FrameworkSettings.tsx component
  - [x] 2.2 Display available frameworks with toggle/checkbox
  - [x] 2.3 Show framework descriptions and types (grouped by Compliance/Risk/Governance)
  - [x] 2.4 Implement subscription tier limit validation (discovery: 1, professional: 6, enterprise: unlimited)

- [x] **Task 3: Integrate into Organization Settings** (AC: 1)
  - [x] 3.1 Add "Frameworks" tab to settings layout (with Layers icon)
  - [x] 3.2 Wire up save functionality via useSettingsData hook
  - [x] 3.3 Show loading and success states with toast messages

- [x] **Task 4: Update Compliance Module** (AC: 2, 3)
  - [x] 4.1 Filter framework tabs based on enabled frameworks
  - [x] 4.2 Auto-select first enabled framework when current becomes invalid

- [x] **Task 5: Write Unit Tests** (AC: all)
  - [x] 5.1 Test FrameworkSettings component (16 tests)
  - [x] 5.2 Test plan limits enforcement
  - [x] 5.3 Test permission handling

## Dev Notes

### Existing Infrastructure

The codebase already has:
- `Framework` type with 14 frameworks: ISO27001, NIS2, DORA, GDPR, etc.
- `FRAMEWORKS` array in `src/data/frameworks.ts` with labels and types
- `Organization` interface in `src/types/subscriptions.ts`
- `OrganizationSettings` component in `src/components/settings/`
- `useSettingsData` hook for settings persistence
- Per-entity framework fields on Controls, Risks, Audits, Projects

### Framework Type Values

```typescript
type Framework = 'ISO27001' | 'ISO22301' | 'ISO27005' | 'NIS2' | 'DORA' |
                 'GDPR' | 'SOC2' | 'HDS' | 'PCI_DSS' | 'NIST_CSF' |
                 'OWASP' | 'EBIOS' | 'COBIT' | 'ITIL';
```

### Framework Categories

- Compliance: ISO27001, ISO22301, NIS2, DORA, GDPR, SOC2, HDS, PCI_DSS
- Risk: ISO27005, EBIOS, NIST_CSF
- Governance: COBIT, ITIL

### Subscription Tier Limits (Suggested)

| Tier | Max Frameworks |
|------|---------------|
| Free | 1 |
| Starter | 3 |
| Professional | 6 |
| Enterprise | Unlimited |

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/subscriptions.ts` | Add enabledFrameworks to Organization |
| `src/components/settings/OrganizationSettings.tsx` | Add framework tab |
| `src/hooks/settings/useSettingsData.ts` | Add framework update logic |
| `src/views/Compliance.tsx` | Filter by enabled frameworks |

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/settings/FrameworkSettings.tsx` | Framework selection UI |
| `src/components/settings/__tests__/FrameworkSettings.test.tsx` | Unit tests |

## References

- [Source: epics.md#Story-4.1] - Story requirements
- [ADR-005: Multi-Framework Mapping] - Architecture decision
- [Existing: src/types/common.ts] - Framework type
- [Existing: src/data/frameworks.ts] - Framework metadata

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Added `enabledFrameworks?: Framework[]` to Organization interface in subscriptions.ts
2. Added `maxFrameworks` to PlanLimits interface for subscription tier limits
3. Created FrameworkSettings.tsx component with:
   - Framework grouped by type (Compliance, Risk, Governance)
   - Toggle selection with visual feedback (checkmark, border color)
   - Plan-based limits (discovery: 1, professional: 6, enterprise: unlimited)
   - Save/Cancel buttons with change tracking
   - Activity logging on save
4. Added "Référentiels" tab to SettingsLayout with Layers icon
5. Updated Settings.tsx to render FrameworkSettings for frameworks tab
6. Updated Compliance.tsx to filter framework tabs by organization's enabledFrameworks
7. Added effect to auto-select valid framework when current selection becomes invalid
8. All 1434 tests pass including 16 new FrameworkSettings tests

### File List

| File | Action |
|------|--------|
| `src/types/subscriptions.ts` | Modified - Added Framework import, maxFrameworks, enabledFrameworks |
| `src/components/settings/FrameworkSettings.tsx` | Created - Framework selection UI component |
| `src/components/settings/SettingsLayout.tsx` | Modified - Added frameworks tab |
| `src/views/Settings.tsx` | Modified - Added FrameworkSettings rendering |
| `src/views/Compliance.tsx` | Modified - Filter by enabled frameworks |
| `src/components/settings/__tests__/FrameworkSettings.test.tsx` | Created - 16 unit tests |
