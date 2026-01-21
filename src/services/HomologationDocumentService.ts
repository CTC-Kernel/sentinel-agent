/**
 * HomologationDocumentService
 *
 * Service for generating and managing ANSSI homologation documents.
 * Implements ADR-011: ANSSI Homologation Templates for Public Sector.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type {
  HomologationDossier,
  HomologationDocumentType
} from '../types/homologation';
import { LEVEL_INFO, REQUIRED_DOCUMENTS } from '../types/homologation';
import {
  getDocumentTemplate
} from '../data/homologationTemplates';

// ============================================================================
// Types
// ============================================================================

export interface GeneratedDocument {
  id: string;
  dossierId: string;
  type: HomologationDocumentType;
  title: string;
  content: string; // Markdown content
  sections: GeneratedSection[];
  version: number;
  status: 'draft' | 'completed' | 'validated';
  generatedAt: string;
  generatedBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface GeneratedSection {
  id: string;
  title: string;
  content: string;
  isModified: boolean;
}

export interface DocumentGenerationContext {
  organization: {
    name: string;
    address?: string;
    sector?: string;
    logo?: string;
  };
  dossier: HomologationDossier;
  ebiosData?: EbiosDocumentData;
  controlsData?: ControlsDocumentData;
  locale: 'fr' | 'en';
}

export interface EbiosDocumentData {
  fearedEvents: string[];
  riskSources: string[];
  strategicScenarios: string[];
  operationalScenarios: string[];
  treatmentPlan: string[];
  residualRisks: string[];
}

export interface ControlsDocumentData {
  implemented: string[];
  planned: string[];
  gaps: string[];
}

// ============================================================================
// Placeholder Replacement
// ============================================================================

/**
 * Replace placeholders in content with actual values
 */
function replacePlaceholders(content: string, context: DocumentGenerationContext): string {
  let result = content;

  // Organization placeholders
  result = result.replace(/\{\{organization\.name\}\}/g, context.organization.name);
  result = result.replace(/\{\{organization\.address\}\}/g, context.organization.address || '[Adresse]');
  result = result.replace(/\{\{organization\.sector\}\}/g, context.organization.sector || '[Secteur]');

  // Dossier placeholders
  result = result.replace(/\{\{dossier\.name\}\}/g, context.dossier.name);
  result = result.replace(/\{\{dossier\.systemScope\}\}/g, context.dossier.systemScope);
  result = result.replace(/\{\{dossier\.description\}\}/g, context.dossier.description || '');
  result = result.replace(
    /\{\{dossier\.level\}\}/g,
    LEVEL_INFO[context.dossier.level].label
  );
  result = result.replace(/\{\{dossier\.levelJustification\}\}/g, context.dossier.levelJustification);
  result = result.replace(/\{\{dossier\.validityYears\}\}/g, String(context.dossier.validityYears));
  result = result.replace(/\{\{dossier\.responsibleName\}\}/g, '[Responsable SSI]');
  result = result.replace(
    /\{\{dossier\.authorityName\}\}/g,
    context.dossier.authorityName || '[Autorité d\'homologation]'
  );

  // Date placeholders
  const currentDate = format(new Date(), 'PPP', { locale: fr });
  result = result.replace(/\{\{date\.current\}\}/g, currentDate);
  result = result.replace(
    /\{\{date\.validityStart\}\}/g,
    context.dossier.validityStartDate
      ? format(new Date(context.dossier.validityStartDate), 'PPP', { locale: fr })
      : '[Date de début]'
  );
  result = result.replace(
    /\{\{date\.validityEnd\}\}/g,
    context.dossier.validityEndDate
      ? format(new Date(context.dossier.validityEndDate), 'PPP', { locale: fr })
      : '[Date de fin]'
  );

  // EBIOS placeholders
  if (context.ebiosData) {
    result = result.replace(
      /\{\{ebios\.fearedEvents\}\}/g,
      formatList(context.ebiosData.fearedEvents, 'Aucun événement redouté identifié')
    );
    result = result.replace(
      /\{\{ebios\.riskSources\}\}/g,
      formatList(context.ebiosData.riskSources, 'Aucune source de risque identifiée')
    );
    result = result.replace(
      /\{\{ebios\.strategicScenarios\}\}/g,
      formatList(context.ebiosData.strategicScenarios, 'Aucun scénario stratégique identifié')
    );
    result = result.replace(
      /\{\{ebios\.operationalScenarios\}\}/g,
      formatList(context.ebiosData.operationalScenarios, 'Aucun scénario opérationnel identifié')
    );
    result = result.replace(
      /\{\{ebios\.treatmentPlan\}\}/g,
      formatList(context.ebiosData.treatmentPlan, 'Aucun plan de traitement défini')
    );
    result = result.replace(
      /\{\{ebios\.residualRisks\}\}/g,
      formatList(context.ebiosData.residualRisks, 'Risques résiduels à évaluer')
    );
  } else {
    // No EBIOS data - use placeholders
    result = result.replace(
      /\{\{ebios\.fearedEvents\}\}/g,
      '*Aucune analyse EBIOS liée. Compléter manuellement.*'
    );
    result = result.replace(
      /\{\{ebios\.riskSources\}\}/g,
      '*Aucune analyse EBIOS liée. Compléter manuellement.*'
    );
    result = result.replace(
      /\{\{ebios\.strategicScenarios\}\}/g,
      '*Aucune analyse EBIOS liée. Compléter manuellement.*'
    );
    result = result.replace(
      /\{\{ebios\.operationalScenarios\}\}/g,
      '*Aucune analyse EBIOS liée. Compléter manuellement.*'
    );
    result = result.replace(
      /\{\{ebios\.treatmentPlan\}\}/g,
      '*Aucune analyse EBIOS liée. Compléter manuellement.*'
    );
    result = result.replace(
      /\{\{ebios\.residualRisks\}\}/g,
      '*Aucune analyse EBIOS liée. Compléter manuellement.*'
    );
  }

  // Controls placeholders
  if (context.controlsData) {
    result = result.replace(
      /\{\{controls\.implemented\}\}/g,
      formatList(context.controlsData.implemented, 'Aucun contrôle implémenté recensé')
    );
    result = result.replace(
      /\{\{controls\.planned\}\}/g,
      formatList(context.controlsData.planned, 'Aucun contrôle planifié')
    );
    result = result.replace(
      /\{\{controls\.gaps\}\}/g,
      formatList(context.controlsData.gaps, 'Aucun écart identifié')
    );
  } else {
    result = result.replace(
      /\{\{controls\.implemented\}\}/g,
      '*Compléter avec les contrôles implémentés.*'
    );
    result = result.replace(/\{\{controls\.planned\}\}/g, '*Compléter avec les contrôles planifiés.*');
    result = result.replace(/\{\{controls\.gaps\}\}/g, '*Compléter avec les écarts identifiés.*');
  }

  return result;
}

/**
 * Format a list of items as markdown bullet points
 */
function formatList(items: string[], emptyMessage: string): string {
  if (!items || items.length === 0) {
    return `*${emptyMessage}*`;
  }
  return items.map((item) => `- ${item}`).join('\n');
}

// ============================================================================
// Document Generation
// ============================================================================

/**
 * Generate a document from template
 */
export function generateDocumentContent(
  type: HomologationDocumentType,
  context: DocumentGenerationContext
): GeneratedDocument {
  const template = getDocumentTemplate(type);
  const isEnglish = context.locale === 'en';

  const sections: GeneratedSection[] = template.sections.map((section) => {
    const rawContent = isEnglish ? section.contentEn : section.content;
    const processedContent = replacePlaceholders(rawContent, context);

    return {
      id: section.id,
      title: isEnglish ? section.titleEn : section.title,
      content: processedContent,
      isModified: false
    };
  });

  // Combine all sections into full content
  const fullContent = sections.map((s) => `${s.content}\n\n`).join('');

  const now = new Date().toISOString();

  return {
    id: '', // Will be set when saved
    dossierId: context.dossier.id,
    type,
    title: isEnglish ? template.titleEn : template.title,
    content: fullContent,
    sections,
    version: 1,
    status: 'draft',
    generatedAt: now,
    generatedBy: '',
    updatedAt: now,
    updatedBy: ''
  };
}

/**
 * Generate all required documents for a dossier
 */
export function generateAllDocuments(
  context: DocumentGenerationContext
): GeneratedDocument[] {
  const requiredTypes = REQUIRED_DOCUMENTS[context.dossier.level];
  return requiredTypes.map((type) => generateDocumentContent(type, context));
}

// ============================================================================
// Firestore Operations
// ============================================================================

/**
 * Get documents collection reference
 */
function getDocumentsCollection(organizationId: string, dossierId: string) {
  return collection(
    db,
    'organizations',
    organizationId,
    'homologations',
    dossierId,
    'documents'
  );
}

/**
 * Save a generated document
 */
export async function saveDocument(
  organizationId: string,
  dossierId: string,
  userId: string,
  document: GeneratedDocument
): Promise<string> {
  const collectionRef = getDocumentsCollection(organizationId, dossierId);
  const docRef = doc(collectionRef);

  const documentData = {
    ...document,
    id: docRef.id,
    dossierId,
    generatedBy: userId,
    updatedBy: userId,
    generatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(docRef, documentData);
  return docRef.id;
}

/**
 * Get all documents for a dossier
 */
export async function getDocuments(
  organizationId: string,
  dossierId: string
): Promise<GeneratedDocument[]> {
  const collectionRef = getDocumentsCollection(organizationId, dossierId);
  const snapshot = await getDocs(collectionRef);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      generatedAt:
        data.generatedAt instanceof Timestamp
          ? data.generatedAt.toDate().toISOString()
          : data.generatedAt,
      updatedAt:
        data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
    } as GeneratedDocument;
  });
}

/**
 * Get a single document
 */
export async function getDocument(
  organizationId: string,
  dossierId: string,
  documentId: string
): Promise<GeneratedDocument | null> {
  const docRef = doc(
    db,
    'organizations',
    organizationId,
    'homologations',
    dossierId,
    'documents',
    documentId
  );
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    generatedAt:
      data.generatedAt instanceof Timestamp
        ? data.generatedAt.toDate().toISOString()
        : data.generatedAt,
    updatedAt:
      data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
  } as GeneratedDocument;
}

/**
 * Update document content
 */
export async function updateDocumentContent(
  organizationId: string,
  dossierId: string,
  documentId: string,
  userId: string,
  content: string,
  sections: GeneratedSection[]
): Promise<void> {
  const docRef = doc(
    db,
    'organizations',
    organizationId,
    'homologations',
    dossierId,
    'documents',
    documentId
  );

  await updateDoc(docRef, {
    content,
    sections,
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  organizationId: string,
  dossierId: string,
  documentId: string,
  userId: string,
  status: 'draft' | 'completed' | 'validated'
): Promise<void> {
  const docRef = doc(
    db,
    'organizations',
    organizationId,
    'homologations',
    dossierId,
    'documents',
    documentId
  );

  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });
}

// ============================================================================
// PDF Export
// ============================================================================

/**
 * Export document to PDF
 */
export function exportToPDF(
  document: GeneratedDocument,
  context: DocumentGenerationContext
): Blob {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Helper function to add page if needed
  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin - 15) {
      pdf.addPage();
      yPosition = margin;
      addHeader();
    }
  };

  // Add header
  const addHeader = () => {
    pdf.setFontSize(8);
    pdf.setTextColor(128);
    pdf.text(context.organization.name, margin, 10);
    pdf.text(document.title, pageWidth - margin, 10, { align: 'right' });
    pdf.setDrawColor(200);
    pdf.line(margin, 12, pageWidth - margin, 12);
  };

  // Add footer
  const addFooter = (pageNum: number, totalPages: number) => {
    pdf.setFontSize(8);
    pdf.setTextColor(128);
    pdf.text(
      `${document.status === 'draft' ? 'BROUILLON - ' : ''}Page ${pageNum}/${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    pdf.text(
      format(new Date(), 'dd/MM/yyyy'),
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  };

  // Add watermark for draft
  const addWatermark = () => {
    if (document.status === 'draft') {
      pdf.setFontSize(60);
      pdf.setTextColor(230);
      pdf.text('BROUILLON', pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45
      });
    }
  };

  addHeader();
  addWatermark();

  // Title
  pdf.setFontSize(18);
  pdf.setTextColor(0);
  pdf.setFont('helvetica', 'bold');
  yPosition += 10;
  pdf.text(document.title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Dossier info
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Système : ${context.dossier.name}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 7;
  pdf.text(
    `Niveau : ${LEVEL_INFO[context.dossier.level].label}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 15;

  // Content - simple text rendering (markdown not parsed for simplicity)
  pdf.setFontSize(10);
  const lines = document.content.split('\n');

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // H2 heading
      checkPageBreak(15);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      yPosition += 8;
      pdf.text(line.replace('## ', ''), margin, yPosition);
      yPosition += 7;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
    } else if (line.startsWith('### ')) {
      // H3 heading
      checkPageBreak(12);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      yPosition += 6;
      pdf.text(line.replace('### ', ''), margin, yPosition);
      yPosition += 5;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
    } else if (line.startsWith('# ')) {
      // H1 heading
      checkPageBreak(18);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      yPosition += 10;
      pdf.text(line.replace('# ', ''), margin, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
    } else if (line.startsWith('- ')) {
      // Bullet point
      checkPageBreak(6);
      const bulletText = line.replace('- ', '');
      const wrappedLines = pdf.splitTextToSize(`• ${bulletText}`, contentWidth - 5);
      for (const wrappedLine of wrappedLines) {
        checkPageBreak(5);
        pdf.text(wrappedLine, margin + 5, yPosition);
        yPosition += 5;
      }
    } else if (line.trim() === '') {
      // Empty line
      yPosition += 3;
    } else if (line.startsWith('|')) {
      // Table row (simplified - just render as text)
      checkPageBreak(6);
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    } else {
      // Regular paragraph
      checkPageBreak(6);
      const wrappedLines = pdf.splitTextToSize(line, contentWidth);
      for (const wrappedLine of wrappedLines) {
        checkPageBreak(5);
        pdf.text(wrappedLine, margin, yPosition);
        yPosition += 5;
      }
    }
  }

  // Add footers to all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(i, totalPages);
  }

  return pdf.output('blob');
}

/**
 * Download document as PDF
 */
export function downloadDocumentPDF(
  document: GeneratedDocument,
  context: DocumentGenerationContext
): void {
  const blob = exportToPDF(document, context);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `${document.title.replace(/\s+/g, '_')}_${context.dossier.name.replace(/\s+/g, '_')}.pdf`;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// EBIOS Integration
// ============================================================================

/**
 * Fetch EBIOS data for document generation
 */
export async function fetchEbiosData(
  organizationId: string,
  ebiosAnalysisId: string
): Promise<EbiosDocumentData | null> {
  try {
    const analysisRef = doc(db, 'organizations', organizationId, 'ebiosAnalyses', ebiosAnalysisId);
    const analysisSnap = await getDoc(analysisRef);

    if (!analysisSnap.exists()) return null;

    const analysis = analysisSnap.data();

    // Extract feared events from Workshop 1
    const fearedEvents: string[] = (analysis.fearedEvents || []).map(
      (fe: { name: string; gravity: number }) => `${fe.name} (Gravité: ${fe.gravity}/4)`
    );

    // Extract risk sources from Workshop 2
    const riskSources: string[] = (analysis.retainedPairs || []).map(
      (pair: { riskSource: { name: string }; targetedObjective: { name: string } }) =>
        `${pair.riskSource?.name} → ${pair.targetedObjective?.name}`
    );

    // Extract strategic scenarios from Workshop 3
    const strategicScenarios: string[] = (analysis.strategicScenarios || []).map(
      (sc: { name: string; gravity: number }) => `${sc.name} (Gravité: ${sc.gravity}/4)`
    );

    // Extract operational scenarios from Workshop 4
    const operationalScenarios: string[] = (analysis.operationalScenarios || []).map(
      (sc: { name: string; likelihood: number; riskLevel: string }) =>
        `${sc.name} (Vraisemblance: ${sc.likelihood}/4, Risque: ${sc.riskLevel})`
    );

    // Extract treatment plan from Workshop 5
    const treatmentPlan: string[] = (analysis.treatmentPlanItems || []).map(
      (item: { scenarioName: string; strategy: string; status: string }) =>
        `${item.scenarioName}: ${item.strategy} (${item.status})`
    );

    // Residual risks
    const residualRisks: string[] = (analysis.treatmentPlanItems || [])
      .filter((item: { strategy: string }) => item.strategy === 'accept')
      .map(
        (item: { scenarioName: string; residualRiskLevel: string }) =>
          `${item.scenarioName}: Risque résiduel ${item.residualRiskLevel || 'à évaluer'}`
      );

    return {
      fearedEvents,
      riskSources,
      strategicScenarios,
      operationalScenarios,
      treatmentPlan,
      residualRisks
    };
  } catch (error) {
    console.error('Error fetching EBIOS data:', error);
    return null;
  }
}

// ============================================================================
// Export Service
// ============================================================================

export const HomologationDocumentService = {
  // Generation
  generateDocumentContent,
  generateAllDocuments,

  // Firestore
  saveDocument,
  getDocuments,
  getDocument,
  updateDocumentContent,
  updateDocumentStatus,

  // PDF
  exportToPDF,
  downloadDocumentPDF,

  // EBIOS
  fetchEbiosData,

  // Utilities
  replacePlaceholders
};

export default HomologationDocumentService;
