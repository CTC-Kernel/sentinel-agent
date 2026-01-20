# Story 35-1: ICT Provider Management

## Story

**As a** RSSI Finance,
**I want** to manage my ICT providers inventory,
**So that** I maintain a complete DORA-compliant register.

## Status

**Current Status:** ready-for-dev
**Epic:** Epic 35 - DORA ICT Register (P0 - Finance)
**Priority:** P0 - Deadline 30 avril 2025
**ADR:** ADR-008

## Context

### Business Context
DORA (Digital Operational Resilience Act) entered into force on January 17, 2025. Financial institutions must maintain a comprehensive ICT (Information and Communication Technology) provider register and report to ESA (European Supervisory Authorities) by April 30, 2025.

### Persona: Jean-Marc, RSSI Banque Regionale
- Banque regionale (5Mrd actifs, 800 employes)
- 3 ETP securite, 88+ fournisseurs ICT
- Frustration: "Je passe plus de temps a remplir des registres qu'a securiser."

### Regulatory Requirements (DORA Art. 28)
- Complete inventory of all ICT third-party providers
- Classification by criticality (critical/important/standard)
- Contract information with exit strategies
- Risk assessment for concentration and substitutability
- Location tracking for EU data sovereignty

## Acceptance Criteria

### AC1: ICT Provider CRUD
**Given** the user has DORA framework enabled
**When** they access the ICT Providers module
**Then** they can create, read, update, and delete ICT providers

### AC2: Provider Information Capture
**Given** the user creates or edits an ICT provider
**When** they fill the provider form
**Then** they capture:
- Name (required)
- Category: critical / important / standard (required)
- Services provided (multi-select)
- Description

### AC3: Contract Information
**Given** the user edits an ICT provider
**When** they access the Contract tab
**Then** they capture:
- Contract start date
- Contract end date
- Exit strategy description (required for critical providers)
- Audit rights (boolean)
- Contract value (optional)

### AC4: Compliance Information
**Given** the user edits an ICT provider
**When** they access the Compliance tab
**Then** they track:
- DORA-compliant (boolean)
- Certifications (multi-select: ISO 27001, SOC 2, etc.)
- Location EU (boolean - for data sovereignty)
- Subcontractors (list)

### AC5: Provider List View
**Given** the user accesses ICT Providers
**When** the list loads
**Then** providers display in a sortable, filterable table with:
- Name, Category, Services count, Contract end date, DORA status
- Filters: Category, DORA status, Contract expiring soon
- Search by name

### AC6: Import from CSV/Excel
**Given** the user has existing provider data
**When** they click "Import Providers"
**Then** they can upload CSV/Excel with mapping wizard
**And** validation errors are shown before import
**And** duplicate detection by name is performed

## Tasks

### Task 1: Data Model & TypeScript Types
**File:** `src/types/dora.ts`

Create the ICTProvider interface following ADR-008:

```typescript
interface ICTProvider {
  id: string;
  tenantId: string;
  name: string;
  category: 'critical' | 'important' | 'standard';
  description?: string;
  services: ICTService[];
  contractInfo: {
    startDate: Timestamp;
    endDate: Timestamp;
    exitStrategy: string;
    auditRights: boolean;
    contractValue?: number;
    currency?: string;
  };
  riskAssessment: {
    concentration: number;     // 0-100
    substitutability: 'low' | 'medium' | 'high';
    lastAssessment: Timestamp;
  };
  compliance: {
    doraCompliant: boolean;
    certifications: string[];
    locationEU: boolean;
    subcontractors?: string[];
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

interface ICTService {
  id: string;
  name: string;
  type: 'cloud' | 'software' | 'infrastructure' | 'security' | 'telecom' | 'other';
  criticality: 'critical' | 'important' | 'standard';
  businessFunctions: string[]; // Which business functions depend on this
}
```

**Subtasks:**
- [ ] Create `src/types/dora.ts` with ICTProvider, ICTService interfaces
- [ ] Create Zod validation schemas in `src/schemas/doraSchema.ts`
- [ ] Add i18n keys for DORA module in `public/locales/fr/dora.json` and `en/dora.json`

### Task 2: Firestore Collection & Rules
**Files:** `firestore.rules`, `src/services/ictProviderService.ts`

```
organizations/{orgId}/ictProviders/{providerId}
```

**Subtasks:**
- [ ] Add Firestore rules for `ictProviders` collection with RBAC (direction, rssi, admin can write)
- [ ] Create `ictProviderService.ts` with CRUD operations
- [ ] Implement tenant isolation via `tenantId` field

### Task 3: ICT Provider Form Component
**Files:** `src/components/dora/ICTProviderForm.tsx`, `src/components/dora/ICTProviderDrawer.tsx`

**Subtasks:**
- [ ] Create tabbed form (General, Contract, Compliance)
- [ ] Implement react-hook-form with Zod validation
- [ ] Add draft/auto-save per ADR-002
- [ ] Create category selector with color badges
- [ ] Add services multi-select with type filtering

### Task 4: ICT Provider List View
**File:** `src/components/dora/ICTProviderList.tsx`

**Subtasks:**
- [ ] Create DataTable with columns: Name, Category, Services, Contract End, DORA Status
- [ ] Implement filters: Category, DORA compliance, Contract expiring (<90 days)
- [ ] Add search functionality
- [ ] Add contextual actions (Edit, Delete, Duplicate)
- [ ] Add "Add Provider" button

### Task 5: ICT Provider Detail/Inspector
**File:** `src/components/dora/ICTProviderInspector.tsx`

**Subtasks:**
- [ ] Create inspector panel with provider details
- [ ] Display linked services
- [ ] Show risk assessment summary
- [ ] Add quick edit actions

### Task 6: Import Wizard
**Files:** `src/components/dora/ImportICTProvidersModal.tsx`

**Subtasks:**
- [ ] Create CSV/Excel upload component
- [ ] Implement column mapping wizard
- [ ] Add validation preview with error highlighting
- [ ] Handle duplicate detection by provider name
- [ ] Create import progress indicator

### Task 7: DORA Module Route & Navigation
**Files:** `src/App.tsx`, `src/components/layout/Sidebar.tsx`

**Subtasks:**
- [ ] Add `/dora/providers` route
- [ ] Add DORA section to sidebar (conditionally shown when DORA framework enabled)
- [ ] Add ICT Providers menu item with icon

### Task 8: useICTProviders Hook
**File:** `src/hooks/useICTProviders.ts`

**Subtasks:**
- [ ] Create hook with Firestore real-time listener
- [ ] Implement CRUD operations wrapper
- [ ] Add filtering and sorting logic
- [ ] Handle loading and error states

## Technical Notes

### Architecture References
- **ADR-001:** Use `localeConfig.ts` for date formats (FR: dd/MM/yyyy)
- **ADR-002:** Implement draft/auto-save for provider form
- **ADR-008:** Follow ICTProvider data model exactly

### Existing Patterns to Follow
- **Form Pattern:** Follow `RiskForm.tsx` structure with tabs
- **List Pattern:** Follow `RiskList.tsx` for DataTable implementation
- **Inspector Pattern:** Follow `ComplianceInspector.tsx` for detail panel
- **Import Pattern:** Follow existing CSV import in `ImportService.ts`
- **Service Pattern:** Follow `riskService.ts` for Firestore operations

### File Locations
```
src/
  types/
    dora.ts                    # New: ICTProvider, ICTService types
  schemas/
    doraSchema.ts              # New: Zod schemas
  services/
    ictProviderService.ts      # New: Firestore CRUD
  hooks/
    useICTProviders.ts         # New: React hook
  components/
    dora/
      ICTProviderList.tsx      # New: List view
      ICTProviderForm.tsx      # New: Form component
      ICTProviderDrawer.tsx    # New: Drawer wrapper
      ICTProviderInspector.tsx # New: Detail panel
      ImportICTProvidersModal.tsx # New: Import wizard
  views/
    DORAProviders.tsx          # New: Page view
public/
  locales/
    fr/dora.json               # New: French translations
    en/dora.json               # New: English translations
```

### UI/UX Guidelines
- Use Apple-style design per CLAUDE.md
- Category badges: critical (red), important (orange), standard (gray)
- Contract expiration warning: <90 days (yellow), <30 days (red)
- DORA compliance badge: green checkmark or red warning

### Performance Considerations
- Paginate provider list (20 items per page)
- Use skeleton loading states
- Debounce search input (300ms)

### Security
- RBAC: direction, rssi, admin roles can create/edit
- consultant, auditor roles can view only
- Tenant isolation mandatory

## Definition of Done

- [ ] All acceptance criteria passing
- [ ] Unit tests for ICTProviderService (>70% coverage)
- [ ] Integration tests for form validation
- [ ] French and English translations complete
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Code review approved
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Manual QA on staging environment

## Dependencies

### Blockers
- None - this is foundation story for Epic 35

### Enables
- Story 35-2: ICT Risk Assessment (uses ICTProvider)
- Story 35-3: DORA Register Export (uses ICTProvider data)
- Story 35-4: Contract Expiration Alerts (uses contractInfo.endDate)

## Test Scenarios

### Unit Tests
1. ICTProviderService.create() creates provider with all fields
2. ICTProviderService.update() updates provider and sets updatedAt
3. ICTProviderService.delete() removes provider
4. Zod schema validates category enum
5. Zod schema requires name field
6. Zod schema validates date fields

### Integration Tests
1. Form submits and creates provider in Firestore
2. List displays providers from Firestore
3. Filter by category returns correct results
4. Import wizard parses CSV correctly
5. Duplicate detection prevents duplicate provider names

### E2E Tests
1. User creates ICT provider end-to-end
2. User imports CSV with 10 providers
3. User filters and searches providers

---

**Story File Created:** 2026-01-20
**Author:** Claude (BMAD Workflow)
**Version:** 1.0
