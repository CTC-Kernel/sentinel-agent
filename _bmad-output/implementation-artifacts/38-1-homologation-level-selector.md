# Story 38-1: Homologation Level Selector

## Story

**As a** RSSI Collectivité,
**I want** to determine the appropriate homologation level,
**So that** I follow ANSSI guidelines.

## Status

**Current Status:** dev-complete
**Epic:** Epic 38 - ANSSI Homologation (P0 - Public Sector)
**Priority:** P0 - Strong demand from public sector
**ADR:** ADR-011
**Dependency:** None (Foundation story)

## Context

### Business Context
French public sector entities must homologate their information systems according to ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information) guidelines. The homologation process requires determining the appropriate level based on system sensitivity and security requirements. ANSSI defines 4 levels: Étoile (simplest), Simple, Standard, and Renforcé (most comprehensive).

### Persona: Marie-Claire, RSSI Collectivité Territoriale
- Manages IT security for a regional government
- Must homologate multiple systems (email, HR, finance, citizen services)
- Needs guidance on which level to apply per system
- Reports to elected officials who need simple explanations
- Time-constrained, needs efficient workflows

### Regulatory Requirements (ANSSI RGS)
- RGS (Référentiel Général de Sécurité) mandates homologation for public sector
- Homologation levels determine required security measures
- Authority decision required for each homologation
- Validity period typically 3-5 years depending on level

### ANSSI Homologation Levels

| Level | Description | Typical Use Case | Documents Required |
|-------|-------------|------------------|-------------------|
| Étoile | Minimal process for non-sensitive systems | Internal tools, static websites | Strategy only |
| Simple | Lightweight for limited sensitivity | Basic office tools, archives | Strategy + Simplified risk analysis |
| Standard | Full process for sensitive systems | HR systems, financial data | All 5 documents |
| Renforcé | Enhanced for critical/classified systems | Critical infrastructure, defense | All docs + penetration tests |

## Acceptance Criteria

### AC1: Level Determination Questions
**Given** the user starts a new homologation dossier
**When** they begin the level determination wizard
**Then** the system asks qualifying questions:
- System classification (public/sensitive/classified)
- Data types processed (personal, financial, health, etc.)
- Number of users (internal, external)
- Interconnection with other systems
- Previous security incidents
- Regulatory requirements (RGPD, sectoral)

### AC2: Automatic Level Recommendation
**Given** the user answers all determination questions
**When** the questionnaire is completed
**Then** the system recommends: Étoile, Simple, Standard, or Renforcé
**And** a justification explains why this level is recommended
**And** key factors influencing the decision are highlighted
**And** the recommendation score is displayed (0-100)

### AC3: Level Override with Justification
**Given** the system has recommended a level
**When** the user chooses to override
**Then** they can select a different level (higher or lower)
**And** they must provide a written justification
**And** the override is logged in the audit trail
**And** a warning is displayed if choosing a lower level

### AC4: Required Documents Display
**Given** a homologation level is selected
**When** the user confirms the level
**Then** the required documents for that level are displayed:
- Étoile: Stratégie d'homologation
- Simple: + Analyse de risques simplifiée
- Standard: + Plan d'action, Décision d'homologation, Attestation
- Renforcé: + Tests d'intrusion, Audit technique
**And** each document shows completion status (not started/in progress/complete)

### AC5: Dossier Creation
**Given** the user has selected and confirmed a level
**When** they click "Create Dossier"
**Then** a new HomologationDossier is created in Firestore
**And** the dossier is linked to the selected system/scope
**And** required documents are initialized with empty templates
**And** the user is redirected to the dossier management view

## Tasks

### Task 1: Homologation Types ✓
**File:** `src/types/homologation.ts`

**Subtasks:**
- [x] Define HomologationLevel enum (etoile, simple, standard, renforce)
- [x] Define HomologationDossier interface
- [x] Define LevelDeterminationQuestion interface
- [x] Define LevelRecommendation interface
- [x] Define HomologationDocument types
- [x] Export types from `src/types/index.ts`

### Task 2: Level Determination Questions Data ✓
**File:** `src/data/homologationQuestions.ts`

**Subtasks:**
- [x] Create LEVEL_DETERMINATION_QUESTIONS array
- [x] Define scoring weights for each question
- [x] Create level thresholds mapping
- [x] Add ANSSI guidance references

### Task 3: HomologationService ✓
**File:** `src/services/HomologationService.ts`

**Subtasks:**
- [x] Create `calculateLevelRecommendation()` method
- [x] Create `getRequiredDocuments()` method
- [x] Create `createDossier()` method
- [x] Create `getDossiers()` and `getDossier()` methods
- [x] Add validation for level override

### Task 4: Homologation Firestore Hook ✓
**File:** `src/hooks/useHomologation.ts`

**Subtasks:**
- [x] Create `useHomologation()` hook with dossier list
- [x] Create `useLevelDetermination()` hook for wizard
- [x] Create `createDossier()` mutation
- [x] Create `updateDossier()` mutation

### Task 5: Level Selector Component ✓
**File:** `src/components/homologation/LevelDeterminationWizard.tsx`

**Subtasks:**
- [x] Create wizard with step-by-step questions
- [x] Display progress indicator
- [x] Show level recommendation with justification
- [x] Allow level override with justification input
- [x] Display required documents for selected level

### Task 6: Homologation Views ✓
**Files:** `src/views/Homologation.tsx`, `src/components/homologation/HomologationDossierList.tsx`

**Subtasks:**
- [x] Create main Homologation view with dossier list
- [x] Create dossier card component
- [x] Add "New Dossier" button to launch wizard
- [ ] Add routing in `App.tsx` (deferred - view created but routing not added)
- [ ] Add sidebar navigation item (deferred)

### Task 7: i18n Translations ✓
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add `homologation.*` namespace
- [x] Add level names and descriptions
- [x] Add wizard question texts (in homologationQuestions.ts with bilingual options)
- [x] Add document type labels
- [x] Add validation messages

### Task 8: Unit Tests ✓
**File:** `src/services/__tests__/HomologationService.test.ts`

**Subtasks:**
- [x] Test level calculation algorithm (calculateTotalScore, getLevelFromScore)
- [x] Test required documents by level (getRequiredDocuments, initializeDocuments)
- [x] Test dossier CRUD operations (mocked)
- [x] Test override validation (validateLevelOverride, canSubmitForDecision)
- [x] Test edge cases (areAllDocumentsCompleted, threshold boundaries)

**Test Coverage:** 47 tests passing

## Technical Notes

### Architecture References
- **ADR-011:** ANSSI Homologation templates for public sector
- **Existing Pattern:** EBIOS RM wizard structure (Workshop progression)
- **Existing Pattern:** ICT Provider CRUD from Story 35-1

### Data Model

```typescript
// HomologationLevel - ANSSI defined levels
export type HomologationLevel = 'etoile' | 'simple' | 'standard' | 'renforce';

// HomologationDossier - Main entity
export interface HomologationDossier {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  systemScope: string;                    // What system/scope is being homologated
  level: HomologationLevel;
  levelJustification: string;             // Why this level was selected
  levelOverridden: boolean;               // Was ANSSI recommendation overridden?
  originalRecommendation?: HomologationLevel;
  determinationAnswers: LevelDeterminationAnswer[];
  recommendationScore: number;            // 0-100

  // Status tracking
  status: 'draft' | 'in_progress' | 'pending_decision' | 'homologated' | 'expired';

  // Validity
  validityStartDate?: string;             // ISO date
  validityEndDate?: string;               // ISO date
  validityYears: number;                  // Typically 3-5

  // Links
  linkedEbiosAnalysisId?: string;         // For Story 38-4
  responsibleId: string;                  // User ID of responsible person
  authorityId?: string;                   // Homologation authority (decision maker)

  // Documents (populated in Story 38-2)
  documents: HomologationDocumentRef[];

  // Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// Level determination question
export interface LevelDeterminationQuestion {
  id: string;
  category: 'classification' | 'data' | 'users' | 'interconnection' | 'incidents' | 'regulatory';
  question: string;
  helpText?: string;
  answerType: 'single' | 'multiple' | 'scale';
  options: {
    value: string;
    label: string;
    score: number;        // Points toward higher level
  }[];
  weight: number;         // Importance multiplier
}

// User's answers
export interface LevelDeterminationAnswer {
  questionId: string;
  value: string | string[];
  score: number;
}

// Level recommendation result
export interface LevelRecommendation {
  recommendedLevel: HomologationLevel;
  score: number;
  justification: string;
  keyFactors: string[];
  requiredDocuments: HomologationDocumentType[];
}
```

### Firestore Structure
```
organizations/{orgId}/homologations/{dossierId}
  - Core dossier data
  - Documents stored in subcollection or linked documents collection
```

### Level Calculation Algorithm
```typescript
// Score thresholds for level determination
const LEVEL_THRESHOLDS = {
  etoile: { min: 0, max: 25 },
  simple: { min: 26, max: 50 },
  standard: { min: 51, max: 75 },
  renforce: { min: 76, max: 100 }
};

// Automatic escalation rules (certain answers force higher levels)
const ESCALATION_RULES = [
  { condition: 'classification === "diffusion_restreinte"', minLevel: 'standard' },
  { condition: 'classification === "secret"', minLevel: 'renforce' },
  { condition: 'dataTypes.includes("health")', minLevel: 'standard' },
  { condition: 'criticalInfrastructure === true', minLevel: 'renforce' }
];
```

### Security
- Only users with `manage_compliance` permission can create/edit dossiers
- Homologation decisions require authority approval
- Audit trail for all changes
- Override of recommended level logged with justification

### Performance
- Dossier list paginated
- Questions loaded on wizard open (not on page load)
- Documents lazy-loaded when dossier opened

## Definition of Done

- [ ] All acceptance criteria passing (AC1-AC5)
- [ ] Unit tests for level calculation (>70% coverage)
- [ ] French and English translations complete
- [ ] Level determination wizard working
- [ ] Dossier CRUD operations functional
- [ ] Code review approved
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Manual QA on staging environment

## Dependencies

### Requires
- None (foundation story)

### Enables
- Story 38-2: Homologation Document Generation
- Story 38-3: Homologation Validity Tracking
- Story 38-4: EBIOS-Homologation Link

## Test Scenarios

### Unit Tests
1. Score calculation returns correct level for various answer combinations
2. Escalation rules override score-based level when triggered
3. Required documents match selected level
4. Override validation rejects lower level without justification

### Integration Tests
1. Creating dossier persists to Firestore correctly
2. Wizard state preserved across question navigation
3. Level change updates required documents

### E2E Tests
1. Complete wizard flow from start to dossier creation
2. Override level with justification
3. View dossier list with status indicators

---

**Story File Created:** 2026-01-21
**Author:** Claude (BMAD Workflow)
**Version:** 1.0
