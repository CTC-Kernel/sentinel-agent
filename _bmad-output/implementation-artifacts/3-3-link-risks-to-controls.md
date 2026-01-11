# Story 3.3: Link Risks to Controls

Status: done

## Story

As a **RSSI**,
I want **to link risks to security controls**,
So that **I can track mitigation**.

## Acceptance Criteria

1. **Given** the user is editing a risk
   **When** they add a control link
   **Then** they can search and select from existing controls
   **And** multiple controls can be linked

2. **Given** a risk has linked controls
   **When** viewing the risk detail page
   **Then** linked controls are displayed with their status
   **And** control effectiveness is visible

3. **Given** controls are linked to a risk
   **When** the risk is displayed
   **Then** residual risk can be calculated based on control effectiveness
   **And** the calculation considers control implementation status

4. **Given** the user is in the risk list
   **When** viewing risks
   **Then** the number of linked controls is visible
   **And** a visual indicator shows mitigation coverage

## Tasks / Subtasks

- [x] **Task 1: Enhance Control Linking UI** (AC: 1)
  - [x] 1.1 Add search/filter functionality to control selection
  - [x] 1.2 Add framework filter for controls
  - [x] 1.3 Show control status badge in selection list
  - [x] 1.4 Add scrollable list with status indicators

- [x] **Task 2: Display Controls in Risk Details** (AC: 2)
  - [x] 2.1 Create RiskLinkedControls component for inspector
  - [x] 2.2 Display control status, framework, and effectiveness
  - [x] 2.3 Add link to navigate to control details
  - [x] 2.4 Show aggregate mitigation coverage percentage

- [x] **Task 3: Residual Risk Calculation** (AC: 3)
  - [x] 3.1 Create calculateMitigationPercentage utility
  - [x] 3.2 Create calculateSuggestedResidualRisk utility
  - [x] 3.3 Factor in control implementation status with weights
  - [x] 3.4 Include explanation text in calculation result

- [x] **Task 4: Risk List Enhancements** (AC: 4)
  - [x] 4.1 Add control count column to risk list
  - [x] 4.2 Add mitigation coverage progress bar
  - [x] 4.3 Color-coded coverage indicator (red/amber/green)

- [x] **Task 5: Write Unit Tests** (AC: all)
  - [x] 5.1 Test control status weights (31 tests in riskUtils.test.ts)
  - [x] 5.2 Test mitigation calculation utilities
  - [x] 5.3 Test RiskLinkedControls component (10 tests)
  - [x] 5.4 Test suggested residual calculation

## Dev Notes

### Existing Infrastructure

The codebase already has:
- `mitigationControlIds` field on Risk type (`src/types/risks.ts:81`)
- Control linking in `RiskTreatmentPlan.tsx` (lines 255-310)
- Control checkboxes in RiskForm treatment tab (lines 821-833)
- `RiskRemediationService.suggestMitigationControls()` for AI suggestions

### Current Control Linking Flow

```typescript
// RiskTreatmentPlan.tsx - toggleControl function
const toggleControl = (controlId: string) => {
    const currentIds = risk.mitigationControlIds || [];
    const newIds = currentIds.includes(controlId)
        ? currentIds.filter(id => id !== controlId)
        : [...currentIds, controlId];
    onRiskUpdate({ mitigationControlIds: newIds });
};
```

### Residual Risk Calculation Formula

```typescript
// Proposed calculation based on control effectiveness
function calculateResidualRisk(
    initialScore: number,
    controls: Control[],
    linkedControlIds: string[]
): { residualScore: number; mitigationPercentage: number } {
    const linkedControls = controls.filter(c => linkedControlIds.includes(c.id));

    // Weight by implementation status
    const effectiveReduction = linkedControls.reduce((sum, ctrl) => {
        const statusWeight = {
            'Implémenté': 1.0,
            'Partiellement implémenté': 0.5,
            'Planifié': 0.1,
            'Non applicable': 0,
            'Non implémenté': 0
        }[ctrl.status] || 0;

        return sum + (ctrl.effectiveness || 0.2) * statusWeight;
    }, 0);

    const mitigationPercentage = Math.min(effectiveReduction * 100, 80); // Cap at 80%
    const residualScore = Math.max(1, Math.round(initialScore * (1 - mitigationPercentage / 100)));

    return { residualScore, mitigationPercentage };
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/risks/RiskTreatmentPlan.tsx` | Add search/filter to control selection |
| `src/components/risks/inspector/RiskGeneralDetails.tsx` | Add linked controls summary |
| `src/components/risks/list/RiskColumns.tsx` | Add control count and coverage indicator |
| `src/utils/riskUtils.ts` | Add residual calculation utility |

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/risks/inspector/RiskLinkedControls.tsx` | Linked controls display component |
| `src/components/risks/MitigationCoverageIndicator.tsx` | Visual coverage indicator |
| `src/utils/__tests__/riskResidualCalculation.test.ts` | Calculation tests |

### i18n Keys

```json
{
  "risk": {
    "controls": {
      "linked": "Contrôles Liés",
      "search": "Rechercher un contrôle...",
      "noLinked": "Aucun contrôle lié",
      "addControl": "Lier un contrôle",
      "coverage": "Couverture",
      "effectiveness": "Efficacité",
      "mitigationScore": "Score de Mitigation"
    }
  }
}
```

## References

- [Source: prd.md#FR14] - Liaison risques-contrôles
- [Source: architecture.md] - Control domain model
- [Source: epics.md#Story-3.3] - Story requirements
- [Existing: src/components/risks/RiskTreatmentPlan.tsx] - Current control linking
- [Existing: src/types/risks.ts] - mitigationControlIds field

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Enhanced RiskTreatmentPlan** with search/filter functionality for control selection
2. Added framework filter dropdown when multiple frameworks exist
3. Status badges on all control items with color coding
4. **Created RiskLinkedControls** component for risk inspector details tab
5. Shows aggregate mitigation coverage percentage with progress bar
6. Implemented/En attente count summary cards
7. **Added residual risk calculation utilities** in riskUtils.ts:
   - `CONTROL_STATUS_WEIGHTS` constant for status-based weighting
   - `calculateMitigationPercentage()` function
   - `calculateSuggestedResidualRisk()` function with explanation
8. **Enhanced RiskColumns** with controls column showing:
   - Control count with shield icon
   - Mitigation coverage progress bar (color-coded)
9. **41 unit tests** covering all functionality

### File List

| File | Action |
|------|--------|
| `src/components/risks/RiskTreatmentPlan.tsx` | Modified - Added search/filter, status badges, coverage indicator |
| `src/components/risks/inspector/RiskLinkedControls.tsx` | Created - Inspector component for linked controls display |
| `src/components/risks/RiskInspector.tsx` | Modified - Added RiskLinkedControls to details tab |
| `src/components/risks/list/RiskColumns.tsx` | Modified - Added controls column with coverage indicator |
| `src/utils/riskUtils.ts` | Modified - Added mitigation calculation utilities |
| `src/utils/__tests__/riskUtils.test.ts` | Modified - Added 12 new tests for mitigation calculations |
| `src/components/risks/inspector/__tests__/RiskLinkedControls.test.tsx` | Created - 10 component tests |
