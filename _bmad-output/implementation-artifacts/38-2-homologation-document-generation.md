# Story 38-2: Homologation Document Generation

## Story

**As a** RSSI Collectivité,
**I want** to generate required homologation documents,
**So that** I have ANSSI-compliant dossiers.

## Status

**Current Status:** dev-complete
**Epic:** Epic 38 - ANSSI Homologation (P0 - Public Sector)
**Priority:** P0 - Strong demand from public sector
**ADR:** ADR-011
**Dependency:** Requires Story 38-1 (Homologation Level Selector) ✓

## Context

### Business Context
Once a homologation level is determined, the RSSI must prepare the required documents according to ANSSI guidelines. Each level requires a specific set of documents, from the simple "Stratégie d'homologation" for the Étoile level to the complete dossier including penetration test reports for the Renforcé level.

### Persona: Marie-Claire, RSSI Collectivité Territoriale
- Needs to generate ANSSI-compliant documents quickly
- Wants documents pre-filled with existing Sentinel data
- Must be able to customize and review before finalizing
- Needs PDF export for official submission

### Required Documents by Level

| Document | Étoile | Simple | Standard | Renforcé |
|----------|--------|--------|----------|----------|
| Stratégie d'homologation | ✓ | ✓ | ✓ | ✓ |
| Analyse de risques | | ✓ | ✓ | ✓ |
| Plan d'action | | | ✓ | ✓ |
| Décision d'homologation | | | ✓ | ✓ |
| Attestation | | | ✓ | ✓ |
| Tests d'intrusion | | | | ✓ |
| Audit technique | | | | ✓ |

## Acceptance Criteria

### AC1: Document Generation from Templates
**Given** a homologation dossier exists with a defined level
**When** the user clicks "Generate Documents"
**Then** the system generates all required documents for that level
**And** documents are pre-filled with:
- Organization information
- System scope and description
- Risk analysis data (from EBIOS if linked)
- Existing controls and measures

### AC2: Document Customization
**Given** a document has been generated
**When** the user opens the document editor
**Then** they can edit all sections
**And** formatting is preserved
**And** changes are auto-saved
**And** version history is maintained

### AC3: PDF Export
**Given** a document is complete
**When** the user clicks "Export PDF"
**Then** a professionally formatted PDF is generated
**And** it includes ANSSI-compliant headers/footers
**And** organization logo is included
**And** document metadata (version, date, author) is embedded

### AC4: Document Status Tracking
**Given** documents are being prepared
**When** the user views the dossier
**Then** each document shows its status:
- not_started: Grey, "À rédiger"
- in_progress: Blue, "En cours"
- completed: Green, "Terminé"
- validated: Purple, "Validé"
**And** overall completion percentage is displayed

### AC5: EBIOS Data Integration
**Given** a dossier is linked to an EBIOS analysis
**When** the "Analyse de risques" document is generated
**Then** it pulls data from the linked EBIOS:
- Feared events from Workshop 1
- Risk sources from Workshop 2
- Strategic scenarios from Workshop 3
- Operational scenarios from Workshop 4
- Treatment plan from Workshop 5

## Tasks

### Task 1: Document Templates Data ✓
**File:** `src/data/homologationTemplates.ts`

**Subtasks:**
- [x] Create template structure for each document type
- [x] Define sections with placeholders
- [x] Add ANSSI-compliant formatting guidelines
- [x] Include bilingual support (FR/EN)

### Task 2: HomologationDocumentService ✓
**File:** `src/services/HomologationDocumentService.ts`

**Subtasks:**
- [x] Create `generateDocument()` method
- [x] Create `getDocumentContent()` method
- [x] Create `updateDocumentContent()` method
- [x] Create `exportToPDF()` method
- [x] Implement EBIOS data integration

### Task 3: Document Editor Component ✓
**File:** `src/components/homologation/DocumentEditor.tsx`

**Subtasks:**
- [x] Create rich text editor for document content
- [x] Add section navigation sidebar
- [x] Implement auto-save functionality
- [x] Add version history panel

### Task 4: Document Generation Panel ✓
**File:** `src/components/homologation/DocumentGenerationPanel.tsx`

**Subtasks:**
- [x] Create document list with status indicators
- [x] Add "Generate" button per document
- [x] Add "Generate All" bulk action
- [x] Show progress during generation
- [x] Add PDF export button

### Task 5: Dossier Detail View ✓
**File:** `src/components/homologation/HomologationDossierDetail.tsx`

**Subtasks:**
- [x] Create main dossier detail view
- [x] Integrate document generation panel
- [x] Add dossier info sidebar
- [x] Add status change actions

### Task 6: i18n Translations ✓
**Files:** `public/locales/fr/translation.json`, `public/locales/en/translation.json`

**Subtasks:**
- [x] Add document type labels
- [x] Add generation messages
- [x] Add editor labels
- [x] Add status labels

### Task 7: Unit Tests ✓
**File:** `src/services/__tests__/HomologationDocumentService.test.ts`

**Subtasks:**
- [x] Test document generation
- [x] Test content population
- [x] Test PDF export
- [x] Test EBIOS integration

## Technical Notes

### Architecture References
- **ADR-011:** ANSSI Homologation templates
- **Existing Pattern:** EbiosReportService for PDF generation
- **Existing Pattern:** RichTextEditor component

### Document Template Structure
```typescript
interface DocumentTemplate {
  type: HomologationDocumentType;
  title: string;
  titleEn: string;
  sections: DocumentSection[];
}

interface DocumentSection {
  id: string;
  title: string;
  titleEn: string;
  content: string;        // Markdown with placeholders
  contentEn: string;
  required: boolean;
  dataSource?: 'organization' | 'dossier' | 'ebios' | 'controls';
}
```

### Placeholder System
```typescript
// Placeholders replaced during generation
const PLACEHOLDERS = {
  '{{organization.name}}': 'Nom de l\'organisation',
  '{{dossier.name}}': 'Nom du dossier',
  '{{dossier.systemScope}}': 'Périmètre du système',
  '{{dossier.level}}': 'Niveau d\'homologation',
  '{{date.current}}': 'Date actuelle',
  '{{ebios.fearedEvents}}': 'Liste des événements redoutés',
  '{{ebios.riskSources}}': 'Sources de risque identifiées',
  '{{ebios.treatmentPlan}}': 'Plan de traitement',
};
```

### PDF Generation
- Use jsPDF with custom ANSSI header/footer
- Include organization logo
- Add watermark for draft documents
- Embed metadata (author, version, date)

### File Locations
```
src/
  data/
    homologationTemplates.ts      # Document templates
  services/
    HomologationDocumentService.ts # Generation logic
  components/
    homologation/
      DocumentEditor.tsx          # Rich text editor
      DocumentGenerationPanel.tsx # Generation UI
      HomologationDossierDetail.tsx # Dossier view
```

## Definition of Done

- [x] All acceptance criteria passing (AC1-AC5)
- [x] Unit tests for document service
- [x] French and English translations
- [x] Document generation working
- [x] PDF export functional
- [ ] Code review approved
- [x] No TypeScript errors
- [x] No ESLint warnings
- [ ] Manual QA on staging

## Dependencies

### Requires (Completed)
- Story 38-1: Homologation Level Selector ✓

### Enables
- Story 38-3: Homologation Validity Tracking
- Story 38-4: EBIOS-Homologation Link

---

**Story File Created:** 2026-01-21
**Author:** Claude (BMAD Workflow)
**Version:** 1.0
