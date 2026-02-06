
import { BusinessProcess, BcpDrill } from '../types';
import { getLocaleConfig, type SupportedLocale } from '../config/localeConfig';
import i18n from '../i18n';
import { ErrorLogger } from '../services/errorLogger';

// Type for jsPDF with autoTable plugin
interface AutoTableJsPDF {
  lastAutoTable: { finalY: number };
}

/**
 * Generate a Business Continuity Plan (BCP) Report
 * Fixed: Proper layout positioning to prevent element overlap
 */
export const generateContinuityReport = async (processes: BusinessProcess[], drills: BcpDrill[]) => {
 try {
 // 1. Calculate Metrics
 const totalProcesses = processes.length;
 const criticalProcesses = processes.filter(p => p.priority === 'Critique').length;
 const protectedProcesses = processes.filter(p => p.rto && p.rpo).length;

 const successfulDrills = drills.filter(d => d.result === 'Succès').length;
 const drillSuccessRate = drills.length > 0 ? Math.round((successfulDrills / drills.length) * 100) : 0;

 const summary = `
Synthèse de Continuité d'Activité

État de Préparation : ${drillSuccessRate > 80 ? 'Optimisé' : 'En développement'}

Vue d'ensemble :
L'organisation a identifié ${totalProcesses} processus métier critiques. Parmi eux, ${criticalProcesses} sont classés comme vitaux pour la survie de l'entreprise. À ce jour, ${protectedProcesses} processus disposent de stratégies de continuité définies (RTO/RPO).

Résilience Opérationnelle :
Le programme d'exercices affiche un taux de succès de ${drillSuccessRate}%. ${drills.length} tests ont été réalisés pour valider les procédures de secours.
 `.trim();

 const { PdfService } = await import('../services/PdfService');

 PdfService.generateExecutiveReport(
 {
 title: "Rapport de Continuité d'Activité (BCP)",
 subtitle: "Analyse d'Impact Métier (BIA) et Résilience",
 filename: "rapport_continuite_activite.pdf",
 orientation: 'portrait',
 organizationName: 'Sentinel GRC',
 summary: summary,
 metrics: [
 { label: 'Processus', value: totalProcesses, subtext: 'Périmètre total' },
 { label: 'Critiques', value: criticalProcesses, subtext: 'Priorité absolue' },
 { label: 'Succès Tests', value: `${drillSuccessRate}%`, subtext: 'Validation Plan' }
 ],
 stats: [
 { label: 'Critique', value: criticalProcesses, color: '#EF4444' },
 { label: 'Majeur', value: processes.filter(p => p.priority === 'Élevée').length, color: '#F97316' },
 { label: 'Standard', value: processes.filter(p => p.priority === 'Moyenne' || p.priority === 'Faible').length, color: '#3B82F6' },
 ]
 },
 (doc, startY) => {
 let currentY = startY;
 const pageWidth = doc.internal.pageSize.width;
 const pageHeight = doc.internal.pageSize.height;
 const marginLeft = 14;
 const marginRight = 14;
 const contentWidth = pageWidth - marginLeft - marginRight;
 const bottomMargin = 30;

 // === SECTION 1: BIA Table ===
 doc.setFontSize(14);
 doc.setTextColor('#334155');
 doc.setFont('helvetica', 'bold');
 doc.text("Analyse d'Impact Métier (BIA)", marginLeft, currentY);
 currentY += 8;

 const biaData = processes.map(p => [
 p.name || 'N/A',
 p.priority || 'N/A',
 p.rto || 'N/A',
 p.rpo || 'N/A',
 p.priority || 'N/A'
 ]);

 if (biaData.length > 0) {
 doc.autoTable({
  startY: currentY,
  head: [['Processus', 'Priorité', 'RTO', 'RPO', 'Niveau']],
  body: biaData,
  headStyles: { fillColor: '#0F172A', textColor: '#FFFFFF' },
  theme: 'striped',
  styles: { fontSize: 9 },
  margin: { left: marginLeft, right: marginRight, bottom: bottomMargin }
 });
 currentY = (doc as unknown as AutoTableJsPDF).lastAutoTable.finalY + 15;
 } else {
 doc.setFontSize(10);
 doc.setTextColor('#64748B');
 doc.setFont('helvetica', 'italic');
 doc.text("Aucun processus métier défini.", marginLeft, currentY + 5);
 currentY += 15;
 }

 // === SECTION 2: Drills Section with Donut Chart ===
 // Check if we need a new page
 const drillSectionHeight = 80; // Approximate height needed
 if (currentY + drillSectionHeight > pageHeight - bottomMargin) {
 doc.addPage();
 currentY = 35;
 }

 doc.setFontSize(14);
 doc.setTextColor('#334155');
 doc.setFont('helvetica', 'bold');
 doc.text("Exercices & Tests de Continuité", marginLeft, currentY);

 // Draw Donut Chart to the RIGHT of the title (properly positioned)
 // Layout assumptions: The donut chart is placed in the top-right area of
 // the drills section. The drills table below reduces its width by
 // (DONUT_RADIUS * 2 + 40) to avoid overlapping with the chart.
 // If the donut radius changes, the table margin must be updated accordingly.
 const DONUT_RADIUS = 18;
 const donutX = pageWidth - marginRight - DONUT_RADIUS * 2 - 30; // Position from right edge
 const donutY = currentY + 5; // Below title line

 if (drills.length > 0) {
 PdfService.drawDonutChart(
  doc,
  donutX,
  donutY,
  DONUT_RADIUS,
  [
  { label: 'Succès', value: successfulDrills, color: '#10B981' },
  { label: 'Échec', value: drills.length - successfulDrills, color: '#EF4444' }
  ],
  `${drillSuccessRate}%`,
  false
 );
 }

 currentY += 10;

 // Drills Table - positioned below title but with reduced width to not overlap donut
 const drillData = drills.map(d => [
 d.date ? new Date(d.date).toLocaleDateString(getLocaleConfig(i18n.language as SupportedLocale).intlLocale) : 'N/A',
 d.type || 'N/A',
 d.notes ? (d.notes.length > 30 ? d.notes.substring(0, 27) + '...' : d.notes) : '-',
 d.result || 'N/A'
 ]);

 if (drillData.length > 0) {
 doc.autoTable({
  startY: currentY,
  head: [['Date', 'Type', 'Notes', 'Résultat']],
  body: drillData,
  headStyles: { fillColor: '#10B981', textColor: '#FFFFFF' },
  theme: 'striped',
  styles: { fontSize: 9 },
  tableWidth: contentWidth - (DONUT_RADIUS * 2 + 40), // Reduce width to avoid donut
  margin: { left: marginLeft, right: marginRight + DONUT_RADIUS * 2 + 40, bottom: bottomMargin }
 });
 } else {
 doc.setFontSize(10);
 doc.setTextColor('#64748B');
 doc.setFont('helvetica', 'italic');
 doc.text("Aucun exercice de continuité enregistré.", marginLeft, currentY + 5);
 }
 }
 );
 } catch (error) {
 ErrorLogger.error('Failed to generate continuity report', 'pdfGenerator', { error });
 throw error;
 }
};
