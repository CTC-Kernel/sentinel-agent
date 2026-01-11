# Story 6.4: Regulatory Document Templates

Status: done

## Story

As a **user**,
I want **to generate documents from regulatory templates**,
So that **I have compliant starting points**.

## Acceptance Criteria

1. **Given** the user clicks "Create from Template"
   **When** they select a template type (Policy, Procedure, etc.)
   **Then** a pre-filled document is created with regulatory structure

2. **Given** a template is selected
   **When** the document is created
   **Then** placeholders indicate required customization

3. **Given** ISO 27001 compliance is needed
   **When** the user views templates
   **Then** templates are available for ISO 27001 required documents

## Tasks / Subtasks

- [x] **Task 1: Create Document Templates Data** (AC: 1, 3)
  - [x] 1.1 Create documentTemplates.ts with ISO 27001 required documents
  - [x] 1.2 Include Policy templates (Info Security, Access Control, etc.)
  - [x] 1.3 Include Procedure templates (Incident Response, Backup, etc.)

- [x] **Task 2: Create Template Selection Modal** (AC: 1, 2)
  - [x] 2.1 Create DocumentTemplateModal.tsx component
  - [x] 2.2 Display templates by category (Policy, Procedure, etc.)
  - [x] 2.3 Preview template structure before creation

- [x] **Task 3: Integrate with Documents View** (AC: 1)
  - [x] 3.1 Add "Create from Template" button to Documents view
  - [x] 3.2 Pre-populate DocumentForm with template content
  - [x] 3.3 Mark template placeholders for customization

## Dev Notes

### ISO 27001 Required Documents

Key mandatory/recommended documents:
1. Information Security Policy (A.5.1)
2. Access Control Policy (A.5.15-A.5.18)
3. Acceptable Use Policy (A.5.10)
4. Incident Response Procedure (A.5.24-A.5.27)
5. Backup & Recovery Procedure (A.8.13)
6. Risk Assessment Methodology
7. Statement of Applicability (already in Compliance module)

### Template Structure

```typescript
interface DocumentTemplate {
    id: string;
    title: string;
    type: 'Politique' | 'Procédure' | 'Preuve' | 'Rapport' | 'Autre';
    category: string; // e.g., 'ISO 27001', 'RGPD'
    description: string;
    controlReference?: string; // e.g., 'A.5.1'
    content: string; // Rich HTML with placeholders
}
```

### Files to Create

| File | Purpose |
|------|---------|
| `src/data/documentTemplates.ts` | Template definitions |
| `src/components/documents/DocumentTemplateModal.tsx` | Template selection UI |

### Files to Modify

| File | Changes |
|------|---------|
| `src/views/Documents.tsx` | Add "Create from Template" button |

## References

- [Source: epics.md#Story-6.4] - Story requirements
- [FR29: Templates réglementaires] - PRD requirement
- [ISO 27001:2022] - Document requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created 7 ISO 27001/RGPD document templates with full HTML content:
   - Information Security Policy (A.5.1)
   - Access Control Policy (A.5.15-A.5.18)
   - Acceptable Use Policy (A.5.10)
   - Incident Response Procedure (A.5.24-A.5.27)
   - Backup & Recovery Procedure (A.8.13)
   - Change Management Procedure (A.8.32)
   - Data Protection Policy (RGPD/A.5.34)

2. Templates include customizable placeholders like [NOM_ORGANISATION], [DATE], [À_PERSONNALISER]

3. DocumentTemplateModal features:
   - Category sidebar for filtering (ISO 27001, RGPD)
   - Search functionality
   - Preview panel with template details
   - Visual distinction between Policy (blue) and Procedure (purple) types

4. Integration in Documents.tsx:
   - "Modèles" button next to "New Document" button
   - Opens template modal for selection
   - Pre-populates DocumentForm with template title, type, description, and content
   - Drawer title reflects template-based creation

### File List

| File | Action | Purpose |
|------|--------|---------|
| `src/data/documentTemplates.ts` | Created | 7 ISO 27001/RGPD document templates with HTML content |
| `src/components/documents/DocumentTemplateModal.tsx` | Created | Modal for browsing and selecting templates |
| `src/views/Documents.tsx` | Modified | Added template modal integration and "Modèles" button |
