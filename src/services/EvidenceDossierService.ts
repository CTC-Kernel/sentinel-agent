/**
 * Evidence Dossier Service
 * Story 5.5: Automatic Evidence Dossier Generation
 * Generates PDF dossiers with all evidence organized by domain
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Control, Document, Framework } from '../types';
import { CONTROL_STATUS } from '../constants/complianceConfig';
import { ISO_DOMAINS } from '../data/complianceData';
import { getLocaleConfig, type SupportedLocale } from '../config/localeConfig';
import i18n from '../i18n';

interface DossierOptions {
 framework: Framework;
 organizationName?: string;
 generatedBy?: string;
}

interface DomainGroup {
 id: string;
 title: string;
 controls: ControlWithEvidence[];
}

interface ControlWithEvidence {
 control: Control;
 evidence: Document[];
}

/**
 * Get domain info from control code
 */
const getDomainFromCode = (code: string): { id: string; title: string } | null => {
 // Extract domain prefix (e.g., "A.5" from "A.5.1.1")
 const match = code.match(/^(A\.\d+)/);
 if (!match) return null;

 const domainId = match[1];
 const domain = ISO_DOMAINS.find(d => d.id === domainId);
 return domain ? { id: domain.id, title: domain.title } : null;
};

/**
 * Group controls by domain with their evidence
 */
const groupControlsByDomain = (
 controls: Control[],
 documents: Document[]
): DomainGroup[] => {
 const groups: Record<string, ControlWithEvidence[]> = {};

 // Sort controls by code
 const sortedControls = [...controls].sort((a, b) =>
 a.code.localeCompare(b.code, undefined, { numeric: true })
 );

 sortedControls.forEach(control => {
 const domain = getDomainFromCode(control.code);
 const domainId = domain?.id || 'Autre';

 if (!groups[domainId]) {
 groups[domainId] = [];
 }

 // Find evidence documents for this control
 const evidence = control.evidenceIds
 ? documents.filter(doc => control.evidenceIds?.includes(doc.id))
 : [];

 groups[domainId].push({ control, evidence });
 });

 // Convert to array and add domain titles
 return Object.entries(groups).map(([id, controls]) => {
 const domain = ISO_DOMAINS.find(d => d.id === id);
 return {
 id,
 title: domain?.title || 'Autres Contrôles',
 controls
 };
 }).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
};

/**
 * Format date for display
 */
const formatDate = (dateStr?: string): string => {
 if (!dateStr) return '-';
 try {
 return new Date(dateStr).toLocaleDateString(getLocaleConfig(i18n.language as SupportedLocale).intlLocale, {
 day: 'numeric',
 month: 'long',
 year: 'numeric'
 });
 } catch {
 return dateStr;
 }
};

/**
 * Get status badge text
 */
const getStatusText = (status: string): string => {
 const statusMap: Record<string, string> = {
 [CONTROL_STATUS.IMPLEMENTED]: '✓ Implémenté',
 [CONTROL_STATUS.PARTIAL]: '◐ Partiel',
 [CONTROL_STATUS.IN_PROGRESS]: '→ En cours',
 [CONTROL_STATUS.NOT_STARTED]: '○ Non commencé',
 [CONTROL_STATUS.PLANNED]: '◇ Planifié',
 [CONTROL_STATUS.OVERDUE]: '⚠ En retard',
 [CONTROL_STATUS.NOT_APPLICABLE]: '— N/A',
 [CONTROL_STATUS.EXCLUDED]: '✗ Exclu'
 };
 return statusMap[status] || status;
};

/**
 * Generate Evidence Dossier PDF
 */
export const generateEvidenceDossier = (
 controls: Control[],
 documents: Document[],
 options: DossierOptions
): void => {
 const doc = new jsPDF();
 const pageWidth = doc.internal.pageSize.getWidth();
 const pageHeight = doc.internal.pageSize.getHeight();
 const margin = 14;
 let yPos = 20;

 // Group controls by domain
 const domainGroups = groupControlsByDomain(controls, documents);

 // Calculate statistics
 const totalControls = controls.length;
 const implementedControls = controls.filter(c => c.status === CONTROL_STATUS.IMPLEMENTED).length;
 const withEvidence = controls.filter(c => c.evidenceIds && c.evidenceIds.length > 0).length;
 const totalEvidence = controls.reduce((sum, c) => sum + (c.evidenceIds?.length || 0), 0);

 // ===== TITLE PAGE =====
 doc.setFontSize(24);
 doc.setFont('helvetica', 'bold');
 doc.text('Dossier de Preuves', pageWidth / 2, 60, { align: 'center' });

 doc.setFontSize(16);
 doc.setFont('helvetica', 'normal');
 doc.text(`Référentiel: ${options.framework}`, pageWidth / 2, 80, { align: 'center' });

 if (options.organizationName) {
 doc.setFontSize(14);
 doc.text(options.organizationName, pageWidth / 2, 95, { align: 'center' });
 }

 doc.setFontSize(12);
 doc.text(`Généré le: ${formatDate(new Date().toISOString())}`, pageWidth / 2, 115, { align: 'center' });
 if (options.generatedBy) {
 doc.text(`Par: ${options.generatedBy}`, pageWidth / 2, 125, { align: 'center' });
 }

 // Summary box
 doc.setFillColor(245, 247, 250);
 doc.roundedRect(margin, 145, pageWidth - 2 * margin, 50, 3, 3, 'F');

 doc.setFontSize(11);
 doc.setFont('helvetica', 'bold');
 doc.text('Résumé', margin + 10, 158);

 doc.setFont('helvetica', 'normal');
 doc.setFontSize(10);
 doc.text(`Contrôles totaux: ${totalControls}`, margin + 10, 172);
 doc.text(`Contrôles implémentés: ${implementedControls} (${totalControls > 0 ? Math.round(implementedControls / totalControls * 100) : 0}%)`, margin + 10, 182);
 doc.text(`Contrôles avec preuves: ${withEvidence} (${totalControls > 0 ? Math.round(withEvidence / totalControls * 100) : 0}%)`, pageWidth / 2, 172);
 doc.text(`Documents de preuves: ${totalEvidence}`, pageWidth / 2, 182);

 // ===== TABLE OF CONTENTS =====
 doc.addPage();
 yPos = 20;

 doc.setFontSize(18);
 doc.setFont('helvetica', 'bold');
 doc.text('Table des Matières', margin, yPos);
 yPos += 15;

 doc.setFontSize(11);
 doc.setFont('helvetica', 'normal');

 // We'll track page numbers as we go
 let pageNum = 3; // Start after title and TOC
 const tocEntries: { title: string; page: number }[] = [];

 domainGroups.forEach(group => {
 tocEntries.push({ title: `${group.id} - ${group.title}`, page: pageNum });
 // Estimate pages per domain (rough calculation)
 const controlsInDomain = group.controls.length;
 pageNum += Math.ceil(controlsInDomain / 3); // ~3 controls per page
 });

 tocEntries.forEach((entry, idx) => {
 if (yPos > pageHeight - 20) {
 doc.addPage();
 yPos = 20;
 }
 const dots = '.'.repeat(Math.max(1, 60 - entry.title.length));
 doc.text(`${idx + 1}. ${entry.title} ${dots} p.${entry.page}`, margin, yPos);
 yPos += 8;
 });

 // ===== DOMAIN SECTIONS =====
 domainGroups.forEach(group => {
 doc.addPage();
 yPos = 20;

 // Domain Header
 doc.setFillColor(99, 102, 241); // Indigo
 doc.rect(0, 0, pageWidth, 35, 'F');

 doc.setTextColor(255, 255, 255);
 doc.setFontSize(16);
 doc.setFont('helvetica', 'bold');
 doc.text(`${group.id} - ${group.title}`, margin, 22);

 doc.setFontSize(10);
 doc.setFont('helvetica', 'normal');
 doc.text(`${group.controls.length} contrôles`, margin, 30);

 doc.setTextColor(0, 0, 0);
 yPos = 50;

 // Controls in this domain
 group.controls.forEach(({ control, evidence }) => {
 // Check if we need a new page
 const estimatedHeight = 40 + (evidence.length * 8);
 if (yPos + estimatedHeight > pageHeight - 20) {
 doc.addPage();
 yPos = 20;
 }

 // Control box
 doc.setFillColor(249, 250, 251);
 doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30 + (evidence.length * 7), 2, 2, 'F');

 // Control code and name
 doc.setFontSize(11);
 doc.setFont('helvetica', 'bold');
 doc.text(`${control.code}`, margin + 5, yPos + 8);

 doc.setFontSize(10);
 doc.setFont('helvetica', 'normal');
 const nameText = doc.splitTextToSize(control.name, pageWidth - 100);
 doc.text(nameText[0], margin + 35, yPos + 8);

 // Status
 doc.setFontSize(9);
 const statusText = getStatusText(control.status);
 doc.text(statusText, pageWidth - margin - 40, yPos + 8);

 // Evidence section
 yPos += 15;
 doc.setFontSize(9);
 doc.setFont('helvetica', 'bold');
 doc.text('Preuves:', margin + 5, yPos);

 yPos += 6;
 doc.setFont('helvetica', 'normal');

 if (evidence.length === 0) {
 doc.setTextColor(220, 38, 38); // Red
 doc.text('⚠ Aucune preuve liée', margin + 10, yPos);
 doc.setTextColor(0, 0, 0);
 yPos += 10;
 } else {
 evidence.forEach(evDoc => {
  doc.setTextColor(59, 130, 246); // Blue for links
  const evidenceText = `• ${evDoc.title} (${evDoc.type})`;
  doc.text(evidenceText, margin + 10, yPos);
  doc.setTextColor(100, 100, 100);
  doc.text(` - ${formatDate(evDoc.createdAt)}`, margin + 10 + doc.getTextWidth(evidenceText), yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 7;
 });
 }

 yPos += 15; // Space between controls
 });
 });

 // ===== SUMMARY TABLE (Last page) =====
 doc.addPage();
 yPos = 20;

 doc.setFontSize(16);
 doc.setFont('helvetica', 'bold');
 doc.text('Récapitulatif des Preuves', margin, yPos);
 yPos += 15;

 // Create summary table data
 const tableData = controls.map(control => {
 const evidenceCount = control.evidenceIds?.length || 0;
 return [
 control.code,
 control.name.substring(0, 40) + (control.name.length > 40 ? '...' : ''),
 control.status,
 evidenceCount > 0 ? `${evidenceCount} doc(s)` : '⚠ Aucune'
 ];
 });

 autoTable(doc, {
 startY: yPos,
 head: [['Code', 'Contrôle', 'Statut', 'Preuves']],
 body: tableData,
 theme: 'striped',
 headStyles: { fillColor: [99, 102, 241] },
 columnStyles: {
 0: { cellWidth: 25 },
 1: { cellWidth: 80 },
 2: { cellWidth: 30 },
 3: { cellWidth: 30 }
 },
 styles: { fontSize: 8 },
 didParseCell: (data) => {
 // Highlight missing evidence in red
 if (data.column.index === 3 && data.cell.raw === '⚠ Aucune') {
 data.cell.styles.textColor = [220, 38, 38];
 }
 }
 });

 // Footer on all pages
 const totalPages = doc.getNumberOfPages();
 for (let i = 1; i <= totalPages; i++) {
 doc.setPage(i);
 doc.setFontSize(8);
 doc.setTextColor(150, 150, 150);
 doc.text(
 `Dossier de Preuves - ${options.framework} - Page ${i}/${totalPages}`,
 pageWidth / 2,
 pageHeight - 10,
 { align: 'center' }
 );
 doc.text(
 'Généré par Sentinel GRC',
 pageWidth - margin,
 pageHeight - 10,
 { align: 'right' }
 );
 }

 // Save the PDF
 const filename = `Evidence_Dossier_${options.framework}_${new Date().toISOString().split('T')[0]}.pdf`;
 doc.save(filename);
};

export const EvidenceDossierService = {
 generateEvidenceDossier
};
