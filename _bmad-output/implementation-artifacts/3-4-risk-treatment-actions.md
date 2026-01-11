# Story 3.4: Risk Treatment Actions

Status: done

## Story

As a **RSSI**,
I want **to assign treatment actions for risks**,
So that **risks are addressed and tracked**.

## Acceptance Criteria

1. **Given** the user is viewing a risk
   **When** they click "Add Treatment Action"
   **Then** they can create an action with: Title, Description, Owner, Deadline
   **And** the action is linked to the risk

2. **Given** a risk has treatment actions
   **When** viewing the risk treatment plan
   **Then** all actions are displayed with their status
   **And** each action shows owner, deadline, and progress

3. **Given** treatment actions exist
   **When** the user updates an action
   **Then** action status (À faire, En cours, Terminé) is trackable
   **And** status changes are persisted

4. **Given** an action is assigned to an owner
   **When** the action is created or deadline approaches
   **Then** notifications are sent to the owner (future enhancement)

## Tasks / Subtasks

- [x] **Task 1: Add TreatmentAction Type** (AC: 1, 2)
  - [x] 1.1 Define TreatmentAction interface in types/risks.ts
  - [x] 1.2 Add treatmentActions field to Risk interface
  - [x] 1.3 Define action status type (À faire, En cours, Terminé)

- [x] **Task 2: Create TreatmentActionForm Component** (AC: 1)
  - [x] 2.1 Create inline action form with title, description fields
  - [x] 2.2 Add owner selector dropdown
  - [x] 2.3 Add deadline date picker
  - [x] 2.4 Implement form validation

- [x] **Task 3: Create TreatmentActionsList Component** (AC: 2, 3)
  - [x] 3.1 Display actions in collapsible list
  - [x] 3.2 Show status badge, owner name, deadline
  - [x] 3.3 Add progress indicator based on action status
  - [x] 3.4 Enable inline status toggle

- [x] **Task 4: Integrate into RiskTreatmentPlan** (AC: all)
  - [x] 4.1 Add "Ajouter une action" button
  - [x] 4.2 Integrate TreatmentActionsList below plan
  - [x] 4.3 Wire up add/update/delete action handlers
  - [x] 4.4 Propagate changes via onRiskUpdate

- [x] **Task 5: Write Unit Tests** (AC: all)
  - [x] 5.1 Test TreatmentAction type validation
  - [x] 5.2 Test TreatmentActionForm component
  - [x] 5.3 Test TreatmentActionsList component
  - [x] 5.4 Test action CRUD operations

## Dev Notes

### Existing Infrastructure

The codebase already has:
- `RiskTreatment` interface with overall treatment plan (`src/types/risks.ts:100`)
- `RiskTreatmentPlan.tsx` component for treatment plan editing
- User selection dropdown already implemented in treatment plan
- SLA status calculation utilities

### New TreatmentAction Type

```typescript
export interface TreatmentAction {
    id: string;
    title: string;
    description?: string;
    ownerId?: string;
    deadline?: string;
    status: 'À faire' | 'En cours' | 'Terminé';
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
}

// Add to Risk interface:
export interface Risk {
    // ... existing fields
    treatmentActions?: TreatmentAction[];
}
```

### Action Status Flow

```
À faire → En cours → Terminé
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/risks.ts` | Add TreatmentAction interface, update Risk |
| `src/components/risks/RiskTreatmentPlan.tsx` | Integrate action management |

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/risks/TreatmentActionForm.tsx` | Form for adding/editing actions |
| `src/components/risks/TreatmentActionsList.tsx` | Display and manage actions |
| `src/components/risks/__tests__/TreatmentActions.test.tsx` | Component tests |

### i18n Keys

```json
{
  "risk": {
    "treatment": {
      "actions": {
        "title": "Actions de traitement",
        "add": "Ajouter une action",
        "edit": "Modifier",
        "delete": "Supprimer",
        "status": {
          "todo": "À faire",
          "inProgress": "En cours",
          "done": "Terminé"
        },
        "noActions": "Aucune action définie",
        "deadline": "Échéance",
        "owner": "Responsable"
      }
    }
  }
}
```

## References

- [Source: epics.md#Story-3.4] - Story requirements
- [Existing: src/components/risks/RiskTreatmentPlan.tsx] - Treatment plan component
- [Existing: src/types/risks.ts] - Risk types

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Added TreatmentAction type** with TreatmentActionStatus type alias
2. **Created TreatmentActionForm component** with:
   - Title, description, owner, deadline, and status fields
   - Form validation (title required)
   - Edit mode support for existing actions
3. **Created TreatmentActionsList component** with:
   - Actions list display with status badges
   - Progress indicator showing completed/total
   - Inline status toggle (click icon to cycle through statuses)
   - Overdue/today deadline indicators
   - Edit and delete actions
   - Read-only mode support
4. **Integrated into RiskTreatmentPlan**:
   - Added handlers for add/update/delete actions
   - TreatmentActionsList rendered below controls section
   - Changes propagated via onRiskUpdate callback
5. **18 unit tests** covering all functionality

### File List

| File | Action |
|------|--------|
| `src/types/risks.ts` | Modified - Added TreatmentAction interface and TreatmentActionStatus type |
| `src/components/risks/TreatmentActionForm.tsx` | Created - Form component for adding/editing actions |
| `src/components/risks/TreatmentActionsList.tsx` | Created - List component for displaying and managing actions |
| `src/components/risks/RiskTreatmentPlan.tsx` | Modified - Integrated TreatmentActionsList with handlers |
| `src/components/risks/__tests__/TreatmentActions.test.tsx` | Created - 18 unit tests |
