/**
 * EBIOS Report Generation Service
 * Generates PDF reports for EBIOS RM workshops
 *
 * Story 15.6: Génération de la Note de Cadrage
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Apply the plugin to jsPDF
(jsPDF.API as unknown as { autoTable: typeof autoTable }).autoTable = autoTable;
import { format } from 'date-fns';
import { getDateFnsLocale } from '../config/localeConfig';
import { PdfService, ReportOptions } from './PdfService';
import type {
 EbiosAnalysis,
 Workshop1Data,
 Workshop2Data,
 Workshop3Data,
 Workshop4Data,
 Workshop5Data,
 SMSIProgram,
 Milestone,
 PDCAPhase,
} from '../types/ebios';
import { GRAVITY_SCALE } from '../data/ebiosLibrary';
import { ISO_SEED_CONTROLS } from '../data/complianceData';
import { RISK_THRESHOLDS } from '../constants/complianceConfig';

interface Workshop1ReportOptions extends Partial<ReportOptions> {
 organizationName?: string;
 author?: string;
 includeBaselineDetails?: boolean;
}

/**
 * Full EBIOS RM Synthesis Report Options
 * Story 19.5 & 19.6
 */
interface FullEbiosReportOptions extends Partial<ReportOptions> {
 organizationName?: string;
 author?: string;
 logoUrl?: string;
 includeWorkshops?: {
 workshop1?: boolean;
 workshop2?: boolean;
 workshop3?: boolean;
 workshop4?: boolean;
 workshop5?: boolean;
 };
 includeRiskMatrix?: boolean;
 includeControlMappings?: boolean;
 includeResidualRiskSummary?: boolean;
}

/**
 * Service for generating EBIOS RM reports
 */
export class EbiosReportService {
 // Layout constants
 private static readonly MARGIN_LEFT = 14;
 private static readonly MARGIN_RIGHT = 14;
 private static readonly SECTION_SPACING = 12;

 // Colors
 private static readonly BRAND_PRIMARY = '#0F172A';
 private static readonly TEXT_SECONDARY = '#64748B';

 /**
 * Get gravity label in French
 */
 private static getGravityLabel(level: number): string {
 const scale = GRAVITY_SCALE.find((s) => s.level === level);
 return scale?.fr || `Niveau ${level}`;
 }

 /**
 * Get impact type label in French
 */
 private static getImpactTypeLabel(type: string): string {
 const labels: Record<string, string> = {
 confidentiality: 'Confidentialité',
 integrity: 'Intégrité',
 availability: 'Disponibilité',
 };
 return labels[type] || type;
 }

 /**
 * Get supporting asset type label in French
 */
 private static getAssetTypeLabel(type: string): string {
 const labels: Record<string, string> = {
 hardware: 'Matériel',
 software: 'Logiciel',
 network: 'Réseau',
 personnel: 'Personnel',
 site: 'Site',
 organization: 'Organisation',
 information: 'Information',
 process: 'Processus',
 function: 'Fonction',
 };
 return labels[type] || type;
 }

 /**
 * Calculate Workshop 1 completion status
 */
 static isWorkshop1Complete(data: Workshop1Data): boolean {
 const hasMissions = data.scope.missions.length > 0;
 const hasAssets = data.scope.essentialAssets.length > 0 || data.scope.supportingAssets.length > 0;
 const hasFearedEvents = data.fearedEvents.length > 0;
 const hasBaseline = data.securityBaseline.totalMeasures > 0;

 return hasMissions && hasAssets && hasFearedEvents && hasBaseline;
 }

 /**
 * Get Workshop 1 completion details
 */
 static getWorkshop1CompletionDetails(data: Workshop1Data): {
 missions: boolean;
 essentialAssets: boolean;
 supportingAssets: boolean;
 fearedEvents: boolean;
 securityBaseline: boolean;
 overall: boolean;
 } {
 const missions = data.scope.missions.length > 0;
 const essentialAssets = data.scope.essentialAssets.length > 0;
 const supportingAssets = data.scope.supportingAssets.length > 0;
 const fearedEvents = data.fearedEvents.length > 0;
 const securityBaseline = data.securityBaseline.totalMeasures > 0;

 return {
 missions,
 essentialAssets,
 supportingAssets,
 fearedEvents,
 securityBaseline,
 overall: missions && (essentialAssets || supportingAssets) && fearedEvents && securityBaseline,
 };
 }

 /**
 * Generate Workshop 1 "Note de Cadrage" PDF report
 */
 static generateWorkshop1Report(
 analysis: EbiosAnalysis,
 options: Workshop1ReportOptions = {}
 ): jsPDF {
 const workshop1Data = analysis.workshops[1].data;

 // Calculate stats for the summary
 const missionsCount = workshop1Data.scope.missions.length;
 const essentialAssetsCount = workshop1Data.scope.essentialAssets.length;
 const supportingAssetsCount = workshop1Data.scope.supportingAssets.length;
 const fearedEventsCount = workshop1Data.fearedEvents.length;
 const maturityScore = workshop1Data.securityBaseline.maturityScore || 0;

 // Build summary text
 const summaryText = `Cette note de cadrage présente les résultats de l'Atelier 1 de l'analyse EBIOS RM "${analysis.name}".
L'analyse a identifié ${missionsCount} mission(s) essentielle(s), ${essentialAssetsCount} bien(s) essentiel(s),
${supportingAssetsCount} bien(s) support(s) et ${fearedEventsCount} événement(s) redouté(s).
Le score de maturité du socle de sécurité est de ${maturityScore}%.`;

 // Generate using PdfService executive report pattern
 return PdfService.generateExecutiveReport(
 {
 title: 'Note de Cadrage EBIOS RM',
 subtitle: `${analysis.name} - Atelier 1`,
 orientation: 'portrait',
 filename: `note-cadrage-${analysis.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
 organizationName: options.organizationName || 'Sentinel GRC',
 author: options.author,
 summary: summaryText,
 includeCover: true,
 footerText: 'Document Confidentiel - Généré par Sentinel GRC',
 metrics: [
 { label: 'Missions', value: missionsCount, subtext: 'essentielles' },
 { label: 'Biens Supports', value: supportingAssetsCount, subtext: 'identifiés' },
 { label: 'Événements', value: fearedEventsCount, subtext: 'redoutés' },
 { label: 'Maturité', value: `${maturityScore}%`, subtext: 'socle sécurité' },
 ],
 ...options,
 },
 (doc, startY) => {
 let currentY = startY;
 const pageHeight = doc.internal.pageSize.height;

 // ===== Section 1: Informations Générales =====
 currentY = this.addSectionTitle(doc, 'Informations Générales', currentY);

 // Analysis info table
 doc.autoTable({
 startY: currentY,
 head: [['Propriété', 'Valeur']],
 body: [
 ['Nom de l\'analyse', analysis.name],
 ['Description', analysis.description || 'Non renseignée'],
 ['Date de création', format(new Date(analysis.createdAt), 'dd/MM/yyyy', { locale: getDateFnsLocale() })],
 ['Date cible de certification', analysis.targetCertificationDate
 ? format(new Date(analysis.targetCertificationDate), 'dd/MM/yyyy', { locale: getDateFnsLocale() })
 : 'Non définie'],
 ['Secteur d\'activité', analysis.sector || 'Non spécifié'],
 ['Statut', this.getStatusLabel(analysis.status)],
 ],
 theme: 'striped',
 styles: { fontSize: 9, cellPadding: 3 },
 headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
 columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;

 // ===== Section 2: Missions Essentielles =====
 currentY = this.checkPageBreak(doc, currentY, 60, pageHeight);
 currentY = this.addSectionTitle(doc, 'Missions Essentielles', currentY);

 if (workshop1Data.scope.missions.length > 0) {
 doc.autoTable({
 startY: currentY,
 head: [['Mission', 'Description', 'Criticité']],
 body: workshop1Data.scope.missions.map((m) => [
 m.name,
 m.description || '-',
 `${m.criticality}/4 - ${this.getGravityLabel(m.criticality)}`,
 ]),
 theme: 'striped',
 styles: { fontSize: 9, cellPadding: 3 },
 headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
 columnStyles: { 0: { cellWidth: 50 }, 2: { cellWidth: 35 } },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 } else {
 currentY = this.addEmptyStateText(doc, 'Aucune mission définie', currentY);
 }

 // ===== Section 3: Biens Essentiels =====
 if (workshop1Data.scope.essentialAssets.length > 0) {
 currentY = this.checkPageBreak(doc, currentY, 60, pageHeight);
 currentY = this.addSectionTitle(doc, 'Biens Essentiels', currentY);

 doc.autoTable({
 startY: currentY,
 head: [['Bien', 'Type', 'Criticité', 'Missions liées']],
 body: workshop1Data.scope.essentialAssets.map((a) => [
 a.name,
 this.getAssetTypeLabel(a.type),
 `${a.criticality}/4`,
 a.linkedMissionIds.length > 0
 ? a.linkedMissionIds
  .map((id) => workshop1Data.scope.missions.find((m) => m.id === id)?.name || id)
  .join(', ')
 : '-',
 ]),
 theme: 'striped',
 styles: { fontSize: 9, cellPadding: 3 },
 headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 }

 // ===== Section 4: Biens Supports =====
 if (workshop1Data.scope.supportingAssets.length > 0) {
 currentY = this.checkPageBreak(doc, currentY, 60, pageHeight);
 currentY = this.addSectionTitle(doc, 'Biens Supports', currentY);

 doc.autoTable({
 startY: currentY,
 head: [['Bien Support', 'Type', 'Biens Essentiels liés']],
 body: workshop1Data.scope.supportingAssets.map((a) => [
 a.name,
 this.getAssetTypeLabel(a.type),
 a.linkedEssentialAssetIds.length > 0
 ? a.linkedEssentialAssetIds
  .map((id) => workshop1Data.scope.essentialAssets.find((ea) => ea.id === id)?.name || id)
  .join(', ')
 : '-',
 ]),
 theme: 'striped',
 styles: { fontSize: 9, cellPadding: 3 },
 headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 }

 // ===== Section 5: Événements Redoutés =====
 currentY = this.checkPageBreak(doc, currentY, 60, pageHeight);
 currentY = this.addSectionTitle(doc, 'Événements Redoutés', currentY);

 if (workshop1Data.fearedEvents.length > 0) {
 doc.autoTable({
 startY: currentY,
 head: [['Événement', 'Impact', 'Gravité', 'Missions concernées']],
 body: workshop1Data.fearedEvents.map((e) => [
 e.name,
 this.getImpactTypeLabel(e.impactType),
 `${e.gravity}/4 - ${this.getGravityLabel(e.gravity)}`,
 e.linkedMissionIds.length > 0
 ? e.linkedMissionIds
  .map((id) => workshop1Data.scope.missions.find((m) => m.id === id)?.name || id)
  .join(', ')
 : '-',
 ]),
 theme: 'striped',
 styles: { fontSize: 9, cellPadding: 3 },
 headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
 columnStyles: { 2: { cellWidth: 35 } },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 } else {
 currentY = this.addEmptyStateText(doc, 'Aucun événement redouté défini', currentY);
 }

 // ===== Section 6: Socle de Sécurité =====
 currentY = this.checkPageBreak(doc, currentY, 80, pageHeight);
 currentY = this.addSectionTitle(doc, 'Socle de Sécurité', currentY);

 const baseline = workshop1Data.securityBaseline;

 // Summary stats
 doc.autoTable({
 startY: currentY,
 head: [['Indicateur', 'Valeur']],
 body: [
 ['Score de maturité global', `${baseline.maturityScore}%`],
 ['Mesures totales', String(baseline.totalMeasures)],
 ['Mesures implémentées', String(baseline.implementedMeasures)],
 ['Mesures partielles', String(baseline.partialMeasures)],
 ['Mesures non implémentées', String(baseline.notImplementedMeasures)],
 ],
 theme: 'striped',
 styles: { fontSize: 9, cellPadding: 3 },
 headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
 columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;

 // Detailed measures if requested
 if (options.includeBaselineDetails && baseline.measures.length > 0) {
 currentY = this.checkPageBreak(doc, currentY, 60, pageHeight);
 doc.setFontSize(11);
 doc.setTextColor(this.TEXT_SECONDARY);
 doc.text('Détail des mesures', this.MARGIN_LEFT, currentY);
 currentY += 8;

 doc.autoTable({
 startY: currentY,
 head: [['Catégorie', 'Mesure', 'Statut']],
 body: baseline.measures.map((m) => [
 m.category,
 m.name,
 this.getMeasureStatusLabel(m.status),
 ]),
 theme: 'striped',
 styles: { fontSize: 8, cellPadding: 2 },
 headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 }
 }
 );
 }

 /**
 * Add a section title
 */
 private static addSectionTitle(doc: jsPDF, title: string, y: number): number {
 doc.setFontSize(14);
 doc.setTextColor(this.BRAND_PRIMARY);
 doc.setFont('helvetica', 'bold');
 doc.text(title, this.MARGIN_LEFT, y);

 // Decorative underline
 doc.setDrawColor(this.BRAND_PRIMARY);
 doc.setLineWidth(0.5);
 doc.line(this.MARGIN_LEFT, y + 2, this.MARGIN_LEFT + 30, y + 2);

 doc.setFont('helvetica', 'normal');
 return y + 10;
 }

 /**
 * Add empty state text
 */
 private static addEmptyStateText(doc: jsPDF, text: string, y: number): number {
 doc.setFontSize(10);
 doc.setTextColor(this.TEXT_SECONDARY);
 doc.setFont('helvetica', 'italic');
 doc.text(text, this.MARGIN_LEFT, y);
 doc.setFont('helvetica', 'normal');
 return y + this.SECTION_SPACING;
 }

 /**
 * Check if we need a page break
 */
 private static checkPageBreak(
 doc: jsPDF,
 currentY: number,
 requiredSpace: number,
 pageHeight: number
 ): number {
 const bottomMargin = 30;
 if (currentY + requiredSpace > pageHeight - bottomMargin) {
 doc.addPage();
 return 35; // Reset to top margin
 }
 return currentY;
 }

 /**
 * Get status label in French
 */
 private static getStatusLabel(status: string): string {
 const labels: Record<string, string> = {
 draft: 'Brouillon',
 in_progress: 'En cours',
 completed: 'Terminé',
 archived: 'Archivé',
 };
 return labels[status] || status;
 }

 /**
 * Get measure status label in French
 */
 private static getMeasureStatusLabel(status: string): string {
 const labels: Record<string, string> = {
 implemented: 'Implémenté',
 partial: 'Partiel',
 not_implemented: 'Non implémenté',
 };
 return labels[status] || status;
 }

 /**
 * Download the generated PDF
 */
 static downloadWorkshop1Report(
 analysis: EbiosAnalysis,
 options: Workshop1ReportOptions = {}
 ): void {
 this.generateWorkshop1Report(analysis, {
 ...options,
 save: true,
 autoDownload: true,
 });
 }

 /**
 * Get the PDF as a blob for further processing (e.g., upload to storage)
 */
 static getWorkshop1ReportBlob(
 analysis: EbiosAnalysis,
 options: Workshop1ReportOptions = {}
 ): Blob {
 const doc = this.generateWorkshop1Report(analysis, {
 ...options,
 save: false,
 autoDownload: false,
 });
 return doc.output('blob');
 }

 // ===========================================================================
 // Full EBIOS RM Synthesis Report - Story 19.5 & 19.6
 // ===========================================================================

 /**
 * Get control name by code
 */
 private static getControlName(code: string): string {
 const control = ISO_SEED_CONTROLS.find((c) => c.code === code);
 return control?.name || code;
 }

 /**
 * Get risk level label
 */
 private static getRiskLevelLabel(level: number): string {
 if (level >= RISK_THRESHOLDS.CRITICAL) return 'Critique';
 if (level >= RISK_THRESHOLDS.HIGH) return 'Élevé';
 if (level >= RISK_THRESHOLDS.MEDIUM) return 'Modéré';
 return 'Faible';
 }

 /**
 * Get treatment strategy label
 */
 private static getTreatmentStrategyLabel(strategy: string): string {
 const labels: Record<string, string> = {
 mitigate: 'Réduire',
 transfer: 'Transférer',
 avoid: 'Éviter',
 accept: 'Accepter',
 };
 return labels[strategy] || strategy;
 }

 /**
 * Calculate overall analysis completion percentage
 */
 static getAnalysisCompletion(analysis: EbiosAnalysis): {
 overall: number;
 workshops: Record<number, number>;
 } {
 const workshops: Record<number, number> = {};

 // Workshop 1
 const w1 = analysis.workshops[1]?.data;
 if (w1) {
 const w1Scores = [
 w1.scope.missions.length > 0 ? 20 : 0,
 w1.scope.essentialAssets.length > 0 ? 20 : 0,
 w1.scope.supportingAssets.length > 0 ? 20 : 0,
 w1.fearedEvents.length > 0 ? 20 : 0,
 w1.securityBaseline.totalMeasures > 0 ? 20 : 0,
 ];
 workshops[1] = w1Scores.reduce((a, b) => a + b, 0);
 }

 // Workshop 2
 const w2 = analysis.workshops[2]?.data as Workshop2Data | undefined;
 if (w2) {
 const w2Data = w2 as Workshop2Data & { riskSources?: unknown[]; targetedObjectives?: unknown[] };
 const w2Scores = [
 w2Data.riskSources?.length ? 50 : 0,
 w2Data.targetedObjectives?.length ? 50 : 0,
 ];
 workshops[2] = w2Scores.reduce((a, b) => a + b, 0);
 }

 // Workshop 3
 const w3 = analysis.workshops[3]?.data as Workshop3Data | undefined;
 if (w3) {
 const w3Data = w3 as Workshop3Data & { stakeholders?: unknown[] };
 const w3Scores = [
 w3Data.stakeholders?.length ? 50 : 0,
 w3.strategicScenarios?.length > 0 ? 50 : 0,
 ];
 workshops[3] = w3Scores.reduce((a, b) => a + b, 0);
 }

 // Workshop 4
 const w4 = analysis.workshops[4]?.data as Workshop4Data | undefined;
 if (w4) {
 const hasScenarios = w4.operationalScenarios?.length > 0;
 const hasLikelihood = w4.operationalScenarios?.some((s) => s.likelihood > 0);
 workshops[4] = (hasScenarios ? 50 : 0) + (hasLikelihood ? 50 : 0);
 }

 // Workshop 5
 const w5 = analysis.workshops[5]?.data as Workshop5Data | undefined;
 if (w5) {
 const hasTreatment = w5.treatmentPlan?.length > 0;
 const hasResidual = w5.residualRisks?.length > 0;
 workshops[5] = (hasTreatment ? 50 : 0) + (hasResidual ? 50 : 0);
 }

 const overall = Object.values(workshops).reduce((a, b) => a + b, 0) / 5;
 return { overall: Math.round(overall), workshops };
 }

 /**
 * Generate Full EBIOS RM Synthesis Report
 * Covers all 5 workshops with complete analysis
 */
 static generateFullEbiosReport(
 analysis: EbiosAnalysis,
 options: FullEbiosReportOptions = {}
 ): jsPDF {
 const includeWorkshops = {
 workshop1: true,
 workshop2: true,
 workshop3: true,
 workshop4: true,
 workshop5: true,
 ...options.includeWorkshops,
 };

 // Get workshop data
 const w1 = analysis.workshops[1]?.data;
 const w2 = analysis.workshops[2]?.data as Workshop2Data | undefined;
 const w3 = analysis.workshops[3]?.data as Workshop3Data | undefined;
 const w4 = analysis.workshops[4]?.data as Workshop4Data | undefined;
 const w5 = analysis.workshops[5]?.data as Workshop5Data | undefined;
 // Calculate stats
 const completion = this.getAnalysisCompletion(analysis);
 const w2Extended = w2 as Workshop2Data & { riskSources?: unknown[] } | undefined;
 const riskSourcesCount = w2Extended?.riskSources?.length || 0;
 const strategicScenariosCount = w3?.strategicScenarios?.length || 0;
 const operationalScenariosCount = w4?.operationalScenarios?.length || 0;
 const treatedRisksCount = w5?.treatmentPlan?.length || 0;
 const acceptedRisksCount = w5?.residualRisks?.filter((r) => r.acceptedBy)?.length || 0;

 // Summary text
 const summaryText = `Ce rapport de synthèse présente les résultats complets de l'analyse EBIOS RM "${analysis.name}".
L'analyse a identifié ${riskSourcesCount} source(s) de risque, ${strategicScenariosCount} scénario(s) stratégique(s),
${operationalScenariosCount} scénario(s) opérationnel(s) et a défini un plan de traitement pour ${treatedRisksCount} risque(s).
${acceptedRisksCount} risque(s) résiduel(s) ont été formellement acceptés.
Progression globale: ${completion.overall}%`;

 return PdfService.generateExecutiveReport(
 {
 title: 'Synthèse EBIOS Risk Manager',
 subtitle: analysis.name,
 orientation: 'portrait',
 filename: `synthese - ebios - ${analysis.name.toLowerCase().replace(/\s+/g, '-')} -${format(new Date(), 'yyyy-MM-dd')}.pdf`,
 organizationName: options.organizationName || 'Sentinel GRC',
 author: options.author,
 summary: summaryText,
 includeCover: true,
 includeTableOfContents: true,
 footerText: 'Document Confidentiel - Généré par Sentinel GRC',
 metrics: [
 { label: 'Sources', value: riskSourcesCount, subtext: 'de risque' },
 { label: 'Scénarios', value: operationalScenariosCount, subtext: 'opérationnels' },
 { label: 'Risques traités', value: treatedRisksCount, subtext: 'avec plan' },
 { label: 'Progression', value: `${completion.overall}% `, subtext: 'complétude' },
 ],
 ...options,
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 } as any,
 (doc, startY) => {
 let currentY = startY;
 const pageHeight = doc.internal.pageSize.height;

 // ===== WORKSHOP 1: Cadrage et Socle =====
 if (includeWorkshops.workshop1 && w1) {
 currentY = this.addWorkshop1Section(doc, w1, currentY, pageHeight);
 }

 // ===== WORKSHOP 2: Sources de Risque =====
 if (includeWorkshops.workshop2 && w2) {
 currentY = this.addWorkshop2Section(doc, w2, currentY, pageHeight);
 }

 // ===== WORKSHOP 3: Scénarios Stratégiques =====
 if (includeWorkshops.workshop3 && w3) {
 currentY = this.addWorkshop3Section(doc, w3, currentY, pageHeight);
 }

 // ===== WORKSHOP 4: Scénarios Opérationnels =====
 if (includeWorkshops.workshop4 && w4 && w3) {
 currentY = this.addWorkshop4Section(doc, w4, w3, currentY, pageHeight, options.includeRiskMatrix);
 }

 // ===== WORKSHOP 5: Traitement du Risque =====
 if (includeWorkshops.workshop5 && w5 && w4) {
 currentY = this.addWorkshop5Section(doc, w5, w4, currentY, pageHeight, options.includeControlMappings);
 }

 // ===== CONCLUSION: Risques Résiduels =====
 if (options.includeResidualRiskSummary && w5 && w4) {
 this.addResidualRiskSummary(doc, w5, w4, currentY, pageHeight);
 }
 }
 );
 }

 /**
 * Add Workshop 1 section to the report
 */
 private static addWorkshop1Section(
 doc: jsPDF,
 data: Workshop1Data,
 startY: number,
 pageHeight: number
 ): number {
 let currentY = this.checkPageBreak(doc, startY, 40, pageHeight);
 currentY = this.addSectionTitle(doc, 'Atelier 1 - Cadrage et Socle de Sécurité', currentY);

 // Missions summary
 if (data.scope.missions.length > 0) {
 doc.autoTable({
 startY: currentY,
 head: [['Mission', 'Description', 'Criticité']],
 body: data.scope.missions.slice(0, 5).map((m) => [
 m.name,
 (m.description || '-').substring(0, 50) + (m.description && m.description.length > 50 ? '...' : ''),
 `${m.criticality}/4`,
 ]),
 theme: 'striped',
 styles: { fontSize: 8, cellPadding: 2 },
 headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + 8;
 }

 // Security baseline summary
 currentY = this.checkPageBreak(doc, currentY, 30, pageHeight);
 doc.setFontSize(10);
 doc.setTextColor(this.TEXT_SECONDARY);
 doc.text(
 `Socle de sécurité: ${data.securityBaseline.maturityScore}% de maturité (${data.securityBaseline.implementedMeasures}/${data.securityBaseline.totalMeasures} mesures)`,
 this.MARGIN_LEFT,
 currentY
 );
 currentY += this.SECTION_SPACING;

 return currentY;
 }

 /**
 * Add Workshop 2 section to the report
 */
 private static addWorkshop2Section(
 doc: jsPDF,
 data: Workshop2Data,
 startY: number,
 pageHeight: number
 ): number {
 let currentY = this.checkPageBreak(doc, startY, 60, pageHeight);
 currentY = this.addSectionTitle(doc, 'Atelier 2 - Sources de Risque', currentY);

 const w2Data = data as Workshop2Data & { riskSources?: Array<{ name: string; category: string; relevance: number; targetedObjectiveIds?: string[] }> };
 if (w2Data.riskSources && w2Data.riskSources.length > 0) {
 doc.autoTable({
 startY: currentY,
 head: [['Source', 'Catégorie', 'Pertinence', 'Objectifs visés']],
 body: w2Data.riskSources.slice(0, 8).map((s) => [
 s.name,
 s.category,
 `${s.relevance}/4`,
 String(s.targetedObjectiveIds?.length || 0),
 ]),
 theme: 'striped',
 styles: { fontSize: 8, cellPadding: 2 },
 headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 }

 return currentY;
 }

 /**
 * Add Workshop 3 section to the report
 */
 private static addWorkshop3Section(
 doc: jsPDF,
 data: Workshop3Data,
 startY: number,
 pageHeight: number
 ): number {
 let currentY = this.checkPageBreak(doc, startY, 60, pageHeight);
 currentY = this.addSectionTitle(doc, 'Atelier 3 - Scénarios Stratégiques', currentY);

 if (data.strategicScenarios && data.strategicScenarios.length > 0) {
 doc.autoTable({
 startY: currentY,
 head: [['Scénario', 'Gravité', 'Description']],
 body: data.strategicScenarios.map((s) => [
 s.name,
 `G${s.gravity} - ${this.getGravityLabel(s.gravity)}`,
 (s.description || '-').substring(0, 60) + (s.description && s.description.length > 60 ? '...' : ''),
 ]),
 theme: 'striped',
 styles: { fontSize: 8, cellPadding: 2 },
 headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 }

 return currentY;
 }

 /**
 * Add Workshop 4 section to the report
 */
 private static addWorkshop4Section(
 doc: jsPDF,
 data: Workshop4Data,
 w3Data: Workshop3Data,
 startY: number,
 pageHeight: number,
 includeMatrix?: boolean
 ): number {
 let currentY = this.checkPageBreak(doc, startY, 80, pageHeight);
 currentY = this.addSectionTitle(doc, 'Atelier 4 - Scénarios Opérationnels', currentY);

 if (data.operationalScenarios && data.operationalScenarios.length > 0) {
 doc.autoTable({
 startY: currentY,
 head: [['Scénario', 'Scénario Stratégique', 'Vraisemblance', 'Niveau Risque']],
 body: data.operationalScenarios.map((s) => {
 const strategicScenario = w3Data.strategicScenarios.find(
 (ss) => ss.id === s.strategicScenarioId
 );
 // const gravity = strategicScenario?.gravity || 2; // Unused
 // const riskLevel = RISK_MATRIX_CONFIG.getRiskLevel(strategicScenario?.gravity || 2, s.likelihood); // Unused
 return [
 s.name,
 strategicScenario?.name || '-',
 `V${s.likelihood}`,
 `R${s.riskLevel} - ${this.getRiskLevelLabel(s.riskLevel)}`,
 ];
 }),
 theme: 'striped',
 styles: { fontSize: 8, cellPadding: 2 },
 headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 }

 // Risk distribution summary
 if (includeMatrix && data.operationalScenarios?.length > 0) {
 currentY = this.checkPageBreak(doc, currentY, 30, pageHeight);
 const critical = data.operationalScenarios.filter((s) => s.riskLevel >= RISK_THRESHOLDS.CRITICAL).length;
 const high = data.operationalScenarios.filter((s) => s.riskLevel >= RISK_THRESHOLDS.HIGH && s.riskLevel < RISK_THRESHOLDS.CRITICAL).length;
 const moderate = data.operationalScenarios.filter((s) => s.riskLevel >= RISK_THRESHOLDS.MEDIUM && s.riskLevel < RISK_THRESHOLDS.HIGH).length;
 const low = data.operationalScenarios.filter((s) => s.riskLevel < RISK_THRESHOLDS.MEDIUM).length;

 doc.setFontSize(9);
 doc.setTextColor(this.TEXT_SECONDARY);
 doc.text(
 `Distribution: ${critical} critique(s), ${high} élevé(s), ${moderate} modéré(s), ${low} faible(s)`,
 this.MARGIN_LEFT,
 currentY
 );
 currentY += this.SECTION_SPACING;
 }

 return currentY;
 }

 /**
 * Add Workshop 5 section to the report
 */
 private static addWorkshop5Section(
 doc: jsPDF,
 data: Workshop5Data,
 w4Data: Workshop4Data,
 startY: number,
 pageHeight: number,
 includeControls?: boolean
 ): number {
 let currentY = this.checkPageBreak(doc, startY, 80, pageHeight);
 currentY = this.addSectionTitle(doc, 'Atelier 5 - Traitement du Risque', currentY);

 if (data.treatmentPlan && data.treatmentPlan.length > 0) {
 doc.autoTable({
 startY: currentY,
 head: [['Scénario', 'Stratégie', 'Statut', 'Contrôles']],
 body: data.treatmentPlan.map((tp) => {
 const scenario = w4Data.operationalScenarios.find(
 (s) => s.id === tp.operationalScenarioId
 );
 return [
 scenario?.name || '-',
 this.getTreatmentStrategyLabel(tp.strategy),
 tp.status === 'completed' ? 'Terminé' : tp.status === 'in_progress' ? 'En cours' : 'Planifié',
 String(tp.selectedControlIds?.length || 0),
 ];
 }),
 theme: 'striped',
 styles: { fontSize: 8, cellPadding: 2 },
 headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 }

 // Control mappings
 if (includeControls && data.treatmentPlan?.length > 0) {
 currentY = this.checkPageBreak(doc, currentY, 60, pageHeight);
 doc.setFontSize(11);
 doc.setTextColor(this.BRAND_PRIMARY);
 doc.text('Contrôles ISO 27002 sélectionnés', this.MARGIN_LEFT, currentY);
 currentY += 8;

 const allControls = new Set<string>();
 data.treatmentPlan.forEach((tp) => {
 tp.selectedControlIds?.forEach((c) => allControls.add(c));
 });

 if (allControls.size > 0) {
 const controlsList = Array.from(allControls)
 .sort()
 .slice(0, 15)
 .map((code) => [code, this.getControlName(code)]);

 doc.autoTable({
 startY: currentY,
 head: [['Code', 'Contrôle']],
 body: controlsList,
 theme: 'striped',
 styles: { fontSize: 8, cellPadding: 2 },
 headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 }
 }

 return currentY;
 }

 /**
 * Add residual risk summary section
 */
 private static addResidualRiskSummary(
 doc: jsPDF,
 data: Workshop5Data,
 w4Data: Workshop4Data,
 startY: number,
 pageHeight: number
 ): number {
 let currentY = this.checkPageBreak(doc, startY, 80, pageHeight);
 currentY = this.addSectionTitle(doc, 'Synthèse des Risques Résiduels', currentY);

 if (data.residualRisks && data.residualRisks.length > 0) {
 doc.autoTable({
 startY: currentY,
 head: [['Scénario', 'Risque Initial', 'Efficacité', 'Risque Résiduel', 'Accepté']],
 body: data.residualRisks.map((rr) => {
 const scenario = w4Data.operationalScenarios.find(
 (s) => s.id === rr.operationalScenarioId
 );
 return [
 scenario?.name || '-',
 `R${rr.initialRiskLevel}`,
 `${rr.controlEffectiveness}%`,
 `R${rr.residualRiskLevel}`,
 rr.acceptedBy ? 'Oui' : 'Non',
 ];
 }),
 theme: 'striped',
 styles: { fontSize: 8, cellPadding: 2 },
 headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255] },
 margin: { left: this.MARGIN_LEFT, right: this.MARGIN_RIGHT },
 });
 currentY = doc.lastAutoTable.finalY + this.SECTION_SPACING;
 }

 // Summary stats
 const avgEffectiveness =
 data.residualRisks.length > 0
 ? Math.round(
 data.residualRisks.reduce((sum, r) => sum + r.controlEffectiveness, 0) /
 data.residualRisks.length
 )
 : 0;
 const acceptedCount = data.residualRisks.filter((r) => r.acceptedBy).length;

 currentY = this.checkPageBreak(doc, currentY, 30, pageHeight);
 doc.setFontSize(10);
 doc.setTextColor(this.TEXT_SECONDARY);
 doc.text(
 `Efficacité moyenne des contrôles: ${avgEffectiveness}% | Risques acceptés: ${acceptedCount}/${data.residualRisks.length}`,
 this.MARGIN_LEFT,
 currentY
 );

 return currentY + this.SECTION_SPACING;
 }

 /**
 * Download full EBIOS synthesis report
 */
 static downloadFullEbiosReport(
 analysis: EbiosAnalysis,
 options: FullEbiosReportOptions = {}
 ): void {
 this.generateFullEbiosReport(analysis, {
 ...options,
 save: true,
 autoDownload: true,
 });
 }

 /**
 * Get full EBIOS report as blob
 */
 static getFullEbiosReportBlob(
 analysis: EbiosAnalysis,
 options: FullEbiosReportOptions = {}
 ): Blob {
 const doc = this.generateFullEbiosReport(analysis, {
 ...options,
 save: false,
 autoDownload: false,
 });
 return doc.output('blob');
 }

 // ========================================================================
 // SMSI Program Report Generation (Story 20.5)
 // ========================================================================

 /**
 * Generate SMSI Program Progress Report
 * Story 20.5: Alertes et rapports automatiques
 */
 static generateSMSIProgressReport(
 program: SMSIProgram,
 milestones: Milestone[],
 options: {
 organizationName?: string;
 author?: string;
 includeDetails?: boolean;
 } = {}
 ): jsPDF {
 const doc = new jsPDF('p', 'mm', 'a4');
 const pageWidth = doc.internal.pageSize.getWidth();
 let y = 20;

 // Title
 doc.setFontSize(20);
 doc.setFont('helvetica', 'bold');
 doc.text('Rapport d\'Avancement SMSI', pageWidth / 2, y, { align: 'center' });
 y += 10;

 doc.setFontSize(14);
 doc.setFont('helvetica', 'normal');
 doc.text(program.name, pageWidth / 2, y, { align: 'center' });
 y += 15;

 // Metadata
 doc.setFontSize(10);
 doc.setTextColor(100);
 const now = format(new Date(), 'dd MMMM yyyy HH:mm', { locale: getDateFnsLocale() });
 doc.text(`Généré le ${now}`, 15, y);
 if (options.organizationName) {
 doc.text(`Organisation: ${options.organizationName}`, pageWidth - 15, y, { align: 'right' });
 }
 y += 10;
 doc.setTextColor(0);

 // Program status
 doc.setFontSize(12);
 doc.setFont('helvetica', 'bold');
 doc.text('Statut du Programme', 15, y);
 y += 8;

 doc.setFont('helvetica', 'normal');
 doc.setFontSize(10);

 const statusLabels: Record<string, string> = {
 active: 'Actif',
 paused: 'En pause',
 completed: 'Terminé',
 };

 doc.text(`Statut: ${statusLabels[program.status] || program.status}`, 20, y);
 y += 6;

 if (program.targetCertificationDate) {
 doc.text(
 `Objectif certification: ${format(new Date(program.targetCertificationDate), 'dd MMMM yyyy', { locale: getDateFnsLocale() })}`,
 20,
 y
 );
 y += 6;
 }

 doc.text(`Phase courante: ${this.getPDCALabel(program.currentPhase)}`, 20, y);
 y += 12;

 // Summary stats
 const completedMilestones = milestones.filter(m => m.status === 'completed').length;
 const overdueMilestones = milestones.filter(
 m => m.status !== 'completed' && new Date(m.dueDate) < new Date()
 ).length;
 const inProgressMilestones = milestones.filter(m => m.status === 'in_progress').length;
 const pendingMilestones = milestones.filter(m => m.status === 'pending').length;

 doc.setFont('helvetica', 'bold');
 doc.text('Résumé des Jalons', 15, y);
 y += 8;

 const progress = milestones.length > 0
 ? Math.round((completedMilestones / milestones.length) * 100)
 : 0;

 // Progress bar
 const barWidth = 100;
 const barHeight = 6;
 doc.setFillColor(230, 230, 230);
 doc.rect(20, y, barWidth, barHeight, 'F');
 doc.setFillColor(34, 197, 94); // green
 doc.rect(20, y, (barWidth * progress) / 100, barHeight, 'F');
 doc.setFont('helvetica', 'normal');
 doc.text(`${progress}%`, 125, y + 5);
 y += 12;

 // Stats table
 (doc as jsPDF & { autoTable: (options: Record<string, unknown>) => unknown }).autoTable({
 startY: y,
 head: [['Statut', 'Nombre']],
 body: [
 ['Terminés', completedMilestones.toString()],
 ['En cours', inProgressMilestones.toString()],
 ['En attente', pendingMilestones.toString()],
 ['En retard', overdueMilestones.toString()],
 ['Total', milestones.length.toString()],
 ],
 margin: { left: 20 },
 theme: 'grid',
 headStyles: { fillColor: [59, 130, 246] },
 styles: { fontSize: 9 },
 columnStyles: {
 0: { cellWidth: 60 },
 1: { cellWidth: 30, halign: 'center' },
 },
 });

 y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

 // Milestones by phase
 const phases: PDCAPhase[] = ['plan', 'do', 'check', 'act'];
 for (const phase of phases) {
 const phaseMilestones = milestones.filter(m => m.phase === phase);
 if (phaseMilestones.length === 0) continue;

 // Check if we need a new page
 if (y > 250) {
 doc.addPage();
 y = 20;
 }

 doc.setFont('helvetica', 'bold');
 doc.setFontSize(11);
 doc.text(`Phase ${this.getPDCALabel(phase)}`, 15, y);
 y += 8;

 (doc as jsPDF & { autoTable: (options: Record<string, unknown>) => unknown }).autoTable({
 startY: y,
 head: [['Jalon', 'Échéance', 'Statut', 'Responsable']],
 body: phaseMilestones.map(m => [
 m.name,
 format(new Date(m.dueDate), 'dd/MM/yyyy'),
 this.getMilestoneStatusLabel(m.status),
 m.responsibleId || 'Non assigné',
 ]),
 margin: { left: 15, right: 15 },
 theme: 'striped',
 headStyles: { fillColor: this.getPhaseColor(phase) },
 styles: { fontSize: 8 },
 columnStyles: {
 0: { cellWidth: 60 },
 1: { cellWidth: 25, halign: 'center' },
 2: { cellWidth: 25, halign: 'center' },
 3: { cellWidth: 50 },
 },
 });

 y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
 }

 // Footer
 const pageCount = doc.getNumberOfPages();
 for (let i = 1; i <= pageCount; i++) {
 doc.setPage(i);
 doc.setFontSize(8);
 doc.setTextColor(128);
 doc.text(
 `Page ${i} / ${pageCount}`,
 pageWidth / 2,
 doc.internal.pageSize.getHeight() - 10,
 { align: 'center' }
 );
 doc.text(
 'Rapport SMSI - Sentinel GRC',
 15,
 doc.internal.pageSize.getHeight() - 10
 );
 }

 return doc;
 }

 /**
 * Download SMSI Progress Report
 */
 static downloadSMSIProgressReport(
 program: SMSIProgram,
 milestones: Milestone[],
 options: {
 organizationName?: string;
 author?: string;
 } = {}
 ): void {
 const doc = this.generateSMSIProgressReport(program, milestones, options);
 const filename = `smsi-progress-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
 doc.save(filename);
 }

 /**
 * Get SMSI Progress Report as Blob
 */
 static getSMSIProgressReportBlob(
 program: SMSIProgram,
 milestones: Milestone[]
 ): Blob {
 const doc = this.generateSMSIProgressReport(program, milestones);
 return doc.output('blob');
 }

 // Helper methods for SMSI report
 private static getPDCALabel(phase: PDCAPhase): string {
 const labels: Record<PDCAPhase, string> = {
 plan: 'Plan (Planifier)',
 do: 'Do (Déployer)',
 check: 'Check (Contrôler)',
 act: 'Act (Améliorer)',
 };
 return labels[phase] || phase;
 }

 private static getMilestoneStatusLabel(status: Milestone['status']): string {
 const labels: Record<string, string> = {
 pending: 'En attente',
 in_progress: 'En cours',
 completed: 'Terminé',
 overdue: 'En retard',
 };
 return labels[status] || status;
 }

 private static getPhaseColor(phase: PDCAPhase): [number, number, number] {
 const colors: Record<PDCAPhase, [number, number, number]> = {
 plan: [59, 130, 246], // blue
 do: [34, 197, 94], // green
 check: [168, 85, 247], // purple
 act: [249, 115, 22], // orange
 };
 return colors[phase] || [100, 100, 100];
 }
}
