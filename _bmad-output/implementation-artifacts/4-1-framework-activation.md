# Story 4.1: Framework Activation

Status: in-progress

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

- [ ] **Task 1: Update Organization Type** (AC: 1, 2)
  - [ ] 1.1 Add `enabledFrameworks: Framework[]` field to Organization interface
  - [ ] 1.2 Add default frameworks for new organizations

- [ ] **Task 2: Create Framework Settings Component** (AC: 1, 4)
  - [ ] 2.1 Create FrameworkSettings.tsx component
  - [ ] 2.2 Display available frameworks with toggle/checkbox
  - [ ] 2.3 Show framework descriptions and types
  - [ ] 2.4 Implement subscription tier limit validation

- [ ] **Task 3: Integrate into Organization Settings** (AC: 1)
  - [ ] 3.1 Add "Frameworks" tab to settings layout
  - [ ] 3.2 Wire up save functionality via useSettingsData hook
  - [ ] 3.3 Show loading and success states

- [ ] **Task 4: Update Compliance Module** (AC: 2, 3)
  - [ ] 4.1 Filter framework tabs based on enabled frameworks
  - [ ] 4.2 Update useComplianceData to respect org frameworks

- [ ] **Task 5: Write Unit Tests** (AC: all)
  - [ ] 5.1 Test FrameworkSettings component
  - [ ] 5.2 Test framework filtering logic

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

(To be filled upon completion)

### File List

(To be filled upon completion)
