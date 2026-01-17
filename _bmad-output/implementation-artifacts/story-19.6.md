# Story 19.6: Export du Dossier EBIOS en PDF

Status: ready-for-dev

## Story

As a RSSI,
I want to export the complete EBIOS dossier as PDF,
so that I can share with auditors.

## Acceptance Criteria

1. Bouton "Exporter PDF" dans l'analyse EBIOS complète
2. PDF professionnel généré avec tous les diagrammes et matrices
3. Formatage adapté pour revue par auditeur
4. Choix des sections à inclure
5. Personnalisation: logo, en-tête, pied de page
6. Téléchargement direct et envoi par email

## Tasks / Subtasks

- [ ] Task 1: Étendre le service PDF (AC: 2, 3)
  - [ ] Template PDF professionnel
  - [ ] Conversion diagramme ReactFlow → Image
  - [ ] Conversion matrices → Tables PDF
  - [ ] Mise en page A4 avec marges

- [ ] Task 2: Créer le composant ExportPDFModal (AC: 1, 4)
  - [ ] `src/components/ebios/shared/ExportPDFModal.tsx`
  - [ ] Checkboxes pour sections
  - [ ] Preview miniature
  - [ ] Progress indicator

- [ ] Task 3: Implémenter la personnalisation (AC: 5)
  - [ ] Upload logo organisation
  - [ ] Champs: en-tête, pied de page, numéro de document
  - [ ] Couleurs corporate (optionnel)

- [ ] Task 4: Créer le composant DiagramToImage (AC: 2)
  - [ ] Export ReactFlow vers PNG/SVG
  - [ ] Haute résolution pour impression
  - [ ] Légende incluse

- [ ] Task 5: Implémenter téléchargement et email (AC: 6)
  - [ ] Téléchargement direct navigateur
  - [ ] Option "Envoyer par email"
  - [ ] Sélection destinataires

## Dev Notes

### PDF Template Structure

```typescript
interface PDFConfig {
  pageSize: 'A4' | 'Letter';
  margins: { top: number; right: number; bottom: number; left: number };
  header: {
    logo?: string; // Base64 or URL
    title: string;
    documentNumber?: string;
  };
  footer: {
    text: string;
    showPageNumbers: boolean;
    classification?: 'public' | 'internal' | 'confidential';
  };
  styles: {
    primaryColor: string;
    fontFamily: string;
  };
}
```

### Diagram Export

```typescript
import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, getViewportForBounds } from 'reactflow';

const exportDiagramToImage = async (
  flowRef: React.RefObject<HTMLDivElement>,
  options: { format: 'png' | 'svg'; quality: number }
): Promise<string> => {
  if (!flowRef.current) throw new Error('Flow ref not available');

  const exportFn = options.format === 'png' ? toPng : toSvg;

  return exportFn(flowRef.current, {
    quality: options.quality,
    backgroundColor: '#ffffff',
  });
};
```

### PDF Generation with Images

```typescript
const generateAuditReadyPDF = async (
  analysis: EbiosAnalysis,
  config: PDFConfig
): Promise<Blob> => {
  // 1. Export diagrams
  const ecosystemDiagram = await exportDiagramToImage(ecosystemRef, { format: 'png', quality: 0.95 });
  const riskMatrix = await exportDiagramToImage(matrixRef, { format: 'png', quality: 0.95 });

  // 2. Build document structure
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: config.pageSize,
  });

  // 3. Add header
  if (config.header.logo) {
    doc.addImage(config.header.logo, 'PNG', 10, 10, 30, 15);
  }
  doc.setFontSize(24);
  doc.text(config.header.title, 50, 20);

  // 4. Add content sections
  addSection(doc, 'Périmètre', analysis.workshop1);
  addImage(doc, ecosystemDiagram, 'Cartographie de l\'écosystème');
  addTable(doc, 'Scénarios', formatScenariosTable(analysis.workshop4));
  addImage(doc, riskMatrix, 'Matrice de risques');
  // ...

  // 5. Add footer to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(doc, config.footer, i, pageCount);
  }

  return doc.output('blob');
};
```

### Email Integration

```typescript
const sendReportByEmail = async (
  reportUrl: string,
  recipients: string[],
  message: string
): Promise<void> => {
  // Call Cloud Function
  await functions.httpsCallable('sendEbiosReport')({
    reportUrl,
    recipients,
    message,
    analysisName: analysis.name,
  });
};
```

### Auditor-Friendly Features

- Table of contents with page numbers
- Section cross-references
- Glossary of terms
- Document version control
- Sign-off section (optional)
- Appendix numbering

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-17.6]
- [Source: src/services/pdfService.ts]
- [Source: jspdf documentation]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
