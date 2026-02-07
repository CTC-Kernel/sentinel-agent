/**
 * DORA Export Service
 * Story 35-3: DORA Register Export
 *
 * Provides export functionality for ICT provider registers
 * in ESA-compliant formats (JSON, Excel, PDF)
 */

import type { Workbook, Worksheet } from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr, enUS, Locale } from 'date-fns/locale';
import {
 ICTProvider,
 DORARegisterExport,
 DORAProviderReport,
 ConcentrationAnalysis,
 ICTCriticality
} from '../types/dora';
import { ICTProviderService } from './ICTProviderService';
import { parseDate, formatDateISO } from '../utils/dateUtils';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, getDoc, limit as firestoreLimit, serverTimestamp } from 'firebase/firestore';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';

/**
 * Export format types
 */
export type ExportFormat = 'json' | 'excel' | 'pdf';

/**
 * Export options for DORA register
 */
export interface DORAExportOptions {
 format: ExportFormat;
 categoryFilter?: ICTCriticality | 'all';
 includeHistorical?: boolean;
 language?: 'fr' | 'en';
}

/**
 * Export history record
 */
export interface DORAExportRecord {
 id?: string;
 organizationId: string;
 format: ExportFormat;
 exportedAt: string;
 exportedBy: string;
 exportedByName?: string;
 providerCount: number;
 parameters: {
 categoryFilter: string;
 includeHistorical: boolean;
 };
 filename: string;
 fileSize?: number;
}

/**
 * DORA Export Service
 */
export class DORAExportService {
 private static readonly EXPORT_VERSION = '1.0';
 // Fix 7 - Extracted risk threshold constants
 private static readonly RISK_THRESHOLD_HIGH = 70;
 private static readonly RISK_THRESHOLD_MEDIUM = 40;
 // Fix 6 - Translations moved to static class property to avoid recreation on every call
 private static readonly TRANSLATIONS = {
 fr: {
  yes: 'Oui',
  no: 'Non',
  sheets: {
  providers: 'Fournisseurs ICT',
  risks: 'Évaluation des Risques',
  compliance: 'Conformité',
  analysis: 'Analyse Concentration'
  },
  columns: {
  name: 'Nom',
  category: 'Catégorie',
  services: 'Services',
  contractEnd: 'Fin Contrat',
  exitStrategy: 'Stratégie Sortie',
  auditRights: 'Droits Audit',
  euLocation: 'Localisation UE',
  certifications: 'Certifications',
  status: 'Statut',
  concentration: 'Concentration',
  substitutability: 'Substituabilité',
  riskLevel: 'Niveau Risque',
  lastAssessment: 'Dern. Évaluation',
  doraCompliant: 'Conforme DORA',
  headquarters: 'Siège Social',
  subcontractors: 'Sous-traitants'
  },
  analysis: {
  title: 'Analyse de Concentration ICT',
  totalProviders: 'Total Fournisseurs',
  criticalProviders: 'Fournisseurs Critiques',
  importantProviders: 'Fournisseurs Importants',
  standardProviders: 'Fournisseurs Standards',
  avgConcentration: 'Concentration Moyenne',
  highRiskCount: 'Fournisseurs Haut Risque',
  nonEuCount: 'Fournisseurs Hors UE',
  expiringContracts: 'Contrats Expirant',
  within30Days: 'Dans 30 jours',
  within90Days: 'Dans 90 jours'
  },
  pdf: {
  subtitle: 'Registre des Fournisseurs ICT - DORA Art. 28',
  executiveSummary: 'Résumé Exécutif',
  totalProviders: 'Total',
  criticalCount: 'Critiques',
  highRiskCount: 'Haut Risque',
  avgConcentration: 'Concentration',
  providerDetails: 'Détail des Fournisseurs',
  generatedAt: 'Généré le'
  }
 },
 en: {
  yes: 'Yes',
  no: 'No',
  sheets: {
  providers: 'ICT Providers',
  risks: 'Risk Assessment',
  compliance: 'Compliance',
  analysis: 'Concentration Analysis'
  },
  columns: {
  name: 'Name',
  category: 'Category',
  services: 'Services',
  contractEnd: 'Contract End',
  exitStrategy: 'Exit Strategy',
  auditRights: 'Audit Rights',
  euLocation: 'EU Location',
  certifications: 'Certifications',
  status: 'Status',
  concentration: 'Concentration',
  substitutability: 'Substitutability',
  riskLevel: 'Risk Level',
  lastAssessment: 'Last Assessment',
  doraCompliant: 'DORA Compliant',
  headquarters: 'Headquarters',
  subcontractors: 'Subcontractors'
  },
  analysis: {
  title: 'ICT Concentration Analysis',
  totalProviders: 'Total Providers',
  criticalProviders: 'Critical Providers',
  importantProviders: 'Important Providers',
  standardProviders: 'Standard Providers',
  avgConcentration: 'Average Concentration',
  highRiskCount: 'High Risk Providers',
  nonEuCount: 'Non-EU Providers',
  expiringContracts: 'Expiring Contracts',
  within30Days: 'Within 30 days',
  within90Days: 'Within 90 days'
  },
  pdf: {
  subtitle: 'ICT Provider Register - DORA Art. 28',
  executiveSummary: 'Executive Summary',
  totalProviders: 'Total',
  criticalCount: 'Critical',
  highRiskCount: 'High Risk',
  avgConcentration: 'Concentration',
  providerDetails: 'Provider Details',
  generatedAt: 'Generated on'
  }
 }
 } as const;


 /**
 * Generate ESA-compliant JSON export
 */
 static async generateJSON(
 providers: ICTProvider[],
 organizationInfo: { name: string; lei?: string; country: string },
 options: DORAExportOptions
 ): Promise<{ data: DORARegisterExport; blob: Blob; filename: string }> {
 try {
 // Fix 12 - Capture new Date() once at method start
 const now = new Date();
 const filteredProviders = this.filterProviders(providers, options);

 const providerReports: DORAProviderReport[] = filteredProviders.map(p => ({
 providerId: p.id,
 providerName: p.name,
 category: p.category,
 services: (p.services || []).map(s => ({
 name: s.name,
 type: s.type,
 criticality: s.criticality
 })),
 contractEndDate: formatDateISO(parseDate(p.contractInfo?.endDate)) || '',
 exitStrategyExists: !!p.contractInfo?.exitStrategy,
 auditRightsGranted: p.contractInfo?.auditRights || false,
 euLocation: p.compliance?.locationEU || false,
 certifications: p.compliance?.certifications || [],
 concentrationRisk: p.riskAssessment?.concentration || 0,
 substitutability: p.riskAssessment?.substitutability || 'medium'
 }));

 const concentrationAnalysis = this.calculateConcentrationAnalysis(filteredProviders);

 const exportData: DORARegisterExport = {
 reportingEntity: organizationInfo,
 reportingDate: now.toISOString().split('T')[0],
 ictProviders: providerReports,
 concentrationAnalysis,
 generatedAt: now.toISOString(),
 version: this.EXPORT_VERSION
 };

 const jsonString = JSON.stringify(exportData, null, 2);
 const blob = new Blob([jsonString], { type: 'application/json' });
 const filename = `dora-register-${format(now, 'yyyy-MM-dd-HHmm')}.json`;

 return { data: exportData, blob, filename };
 } catch (error) {
  ErrorLogger.error(error, 'DORAExportService.generateJSON');
  throw error;
 }
 }

 /**
 * Generate Excel workbook export
 */
 static async generateExcel(
 providers: ICTProvider[],
 // Parameter kept for API consistency with generateJSON and generatePDF signatures
 _organizationInfo: { name: string; lei?: string; country: string },
 options: DORAExportOptions
 ): Promise<{ workbook: Workbook; blob: Blob; filename: string }> {
 const filteredProviders = this.filterProviders(providers, options);
 const locale = options.language === 'en' ? enUS : fr;
 const t = this.getTranslations(options.language || 'fr');

 const { default: ExcelJS } = await import('exceljs');
 const workbook = new ExcelJS.Workbook();
 workbook.creator = 'Sentinel GRC - DORA Export';
 workbook.created = new Date();

 // Sheet 1: Provider List
 const providerSheet = workbook.addWorksheet(t.sheets.providers);
 providerSheet.columns = [
 { header: t.columns.name, key: 'name', width: 30 },
 { header: t.columns.category, key: 'category', width: 15 },
 { header: t.columns.services, key: 'services', width: 40 },
 { header: t.columns.contractEnd, key: 'contractEndDate', width: 15 },
 { header: t.columns.exitStrategy, key: 'exitStrategy', width: 15 },
 { header: t.columns.auditRights, key: 'auditRights', width: 12 },
 { header: t.columns.euLocation, key: 'euLocation', width: 12 },
 { header: t.columns.certifications, key: 'certifications', width: 35 },
 { header: t.columns.status, key: 'status', width: 12 }
 ];

 this.styleHeaderRow(providerSheet);

 filteredProviders.forEach(p => {
 providerSheet.addRow({
 name: p.name,
 category: this.translateCategory(p.category, options.language || 'fr'),
 services: (p.services || []).map(s => s.name).join(', '),
 contractEndDate: this.formatExportDate(p.contractInfo?.endDate, locale),
 exitStrategy: p.contractInfo?.exitStrategy ? t.yes : t.no,
 auditRights: p.contractInfo?.auditRights ? t.yes : t.no,
 euLocation: p.compliance?.locationEU ? t.yes : t.no,
 certifications: (p.compliance?.certifications || []).join(', '),
 status: this.translateStatus(p.status, options.language || 'fr')
 });
 });

 // Sheet 2: Risk Summary
 const riskSheet = workbook.addWorksheet(t.sheets.risks);
 riskSheet.columns = [
 { header: t.columns.name, key: 'name', width: 30 },
 { header: t.columns.category, key: 'category', width: 15 },
 { header: t.columns.concentration, key: 'concentration', width: 18 },
 { header: t.columns.substitutability, key: 'substitutability', width: 18 },
 { header: t.columns.riskLevel, key: 'riskLevel', width: 15 },
 { header: t.columns.lastAssessment, key: 'lastAssessment', width: 15 }
 ];

 this.styleHeaderRow(riskSheet);

 filteredProviders.forEach(p => {
 const overallRisk = ICTProviderService.calculateOverallRisk(p);
 const row = riskSheet.addRow({
 name: p.name,
 category: this.translateCategory(p.category, options.language || 'fr'),
 concentration: `${p.riskAssessment?.concentration || 0}%`,
 substitutability: this.translateSubstitutability(p.riskAssessment?.substitutability || 'medium', options.language || 'fr'),
 riskLevel: this.getRiskLevelLabel(overallRisk, options.language || 'fr'),
 lastAssessment: this.formatExportDate(p.riskAssessment?.lastAssessment, locale)
 });

 // Color code risk level
 const riskCell = row.getCell(5);
 if (overallRisk > DORAExportService.RISK_THRESHOLD_HIGH) {
 riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
 riskCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
 } else if (overallRisk > DORAExportService.RISK_THRESHOLD_MEDIUM) {
 riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
 } else {
 riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
 riskCell.font = { color: { argb: 'FFFFFFFF' } };
 }
 });

 // Sheet 3: Compliance Status
 const complianceSheet = workbook.addWorksheet(t.sheets.compliance);
 complianceSheet.columns = [
 { header: t.columns.name, key: 'name', width: 30 },
 { header: t.columns.doraCompliant, key: 'doraCompliant', width: 18 },
 { header: t.columns.euLocation, key: 'euLocation', width: 15 },
 { header: t.columns.headquarters, key: 'headquarters', width: 20 },
 { header: t.columns.certifications, key: 'certifications', width: 40 },
 { header: t.columns.subcontractors, key: 'subcontractors', width: 15 }
 ];

 this.styleHeaderRow(complianceSheet);

 filteredProviders.forEach(p => {
 complianceSheet.addRow({
 name: p.name,
 doraCompliant: p.compliance?.doraCompliant ? t.yes : t.no,
 euLocation: p.compliance?.locationEU ? t.yes : t.no,
 headquarters: p.compliance?.headquartersCountry || '-',
 certifications: (p.compliance?.certifications || []).join(', ') || '-',
 subcontractors: (p.compliance?.subcontractors || []).length.toString()
 });
 });

 // Sheet 4: Concentration Analysis
 const analysisSheet = workbook.addWorksheet(t.sheets.analysis);
 const analysis = this.calculateConcentrationAnalysis(filteredProviders);

 analysisSheet.addRow([t.analysis.title]);
 analysisSheet.getRow(1).font = { bold: true, size: 14 };
 analysisSheet.addRow([]);

 const analysisData = [
 [t.analysis.totalProviders, analysis.totalProviders],
 [t.analysis.criticalProviders, analysis.criticalProviders],
 [t.analysis.importantProviders, analysis.importantProviders],
 [t.analysis.standardProviders, analysis.standardProviders],
 ['', ''],
 [t.analysis.avgConcentration, `${analysis.averageConcentrationRisk.toFixed(1)}%`],
 [t.analysis.highRiskCount, analysis.highConcentrationProviders.length],
 [t.analysis.nonEuCount, analysis.nonEuProviders.length],
 ['', ''],
 [t.analysis.expiringContracts, ''],
 [t.analysis.within30Days, analysis.expiringContracts.within30Days],
 [t.analysis.within90Days, analysis.expiringContracts.within90Days]
 ];

 analysisData.forEach(row => {
 const addedRow = analysisSheet.addRow(row);
 if (row[0] && !row[1]) {
 addedRow.font = { bold: true };
 }
 });

 analysisSheet.getColumn(1).width = 35;
 analysisSheet.getColumn(2).width = 20;

 // Generate blob
 const buffer = await workbook.xlsx.writeBuffer();
 const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 const filename = `dora-register-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;

 return { workbook, blob, filename };
 }

 /**
 * Generate PDF report
 */
 static async generatePDF(
 providers: ICTProvider[],
 organizationInfo: { name: string; lei?: string; country: string },
 options: DORAExportOptions
 ): Promise<{ doc: jsPDF; blob: Blob; filename: string }> {
 try {
 // Fix 12 - Capture new Date() once at method start
 const now = new Date();
 const filteredProviders = this.filterProviders(providers, options);
 const t = this.getTranslations(options.language || 'fr');
 const locale = options.language === 'en' ? enUS : fr;

 const doc = new jsPDF({
 orientation: 'portrait',
 unit: 'mm',
 format: 'a4'
 });

 // Fix 13 - Add PDF document metadata
 doc.setProperties({
  title: `DORA Register - ${organizationInfo.name}`,
  author: organizationInfo.name,
  subject: 'DORA ICT Third-Party Risk Register',
  creator: 'Sentinel GRC v2',
 });

 const pageWidth = doc.internal.pageSize.width;
 const marginLeft = 14;
 const marginRight = 14;
 let yPos = 20;

 // Cover page
 doc.setFillColor(15, 23, 42); // Slate 900
 doc.rect(0, 0, pageWidth, 80, 'F');

 doc.setTextColor(255, 255, 255);
 doc.setFontSize(24);
 doc.setFont('helvetica', 'bold');
 doc.text('DORA ICT Register', marginLeft, 35);

 doc.setFontSize(14);
 doc.setFont('helvetica', 'normal');
 doc.text(t.pdf.subtitle, marginLeft, 48);

 doc.setFontSize(11);
 doc.text(organizationInfo.name, marginLeft, 62);
 if (organizationInfo.lei) {
 doc.text(`LEI: ${organizationInfo.lei}`, marginLeft, 70);
 }

 // Reset text color
 doc.setTextColor(0, 0, 0);
 yPos = 95;

 // Executive Summary
 doc.setFontSize(16);
 doc.setFont('helvetica', 'bold');
 doc.text(t.pdf.executiveSummary, marginLeft, yPos);
 yPos += 10;

 const analysis = this.calculateConcentrationAnalysis(filteredProviders);
 const highRiskCount = filteredProviders.filter(p =>
 ICTProviderService.calculateOverallRisk(p) > this.RISK_THRESHOLD_HIGH
 ).length;

 doc.setFontSize(11);
 doc.setFont('helvetica', 'normal');

 // Summary cards
 const cardWidth = (pageWidth - marginLeft - marginRight - 15) / 4;
 const cards = [
 { label: t.pdf.totalProviders, value: filteredProviders.length.toString() },
 { label: t.pdf.criticalCount, value: analysis.criticalProviders.toString() },
 { label: t.pdf.highRiskCount, value: highRiskCount.toString() },
 { label: t.pdf.avgConcentration, value: `${analysis.averageConcentrationRisk.toFixed(0)}%` }
 ];

 cards.forEach((card, i) => {
 const x = marginLeft + (i * (cardWidth + 5));
 doc.setFillColor(248, 250, 252); // Slate 50
 doc.roundedRect(x, yPos, cardWidth, 25, 2, 2, 'F');

 doc.setFontSize(18);
 doc.setFont('helvetica', 'bold');
 doc.setTextColor(15, 23, 42);
 doc.text(card.value, x + cardWidth / 2, yPos + 12, { align: 'center' });

 doc.setFontSize(8);
 doc.setFont('helvetica', 'normal');
 doc.setTextColor(100, 116, 139);
 doc.text(card.label, x + cardWidth / 2, yPos + 20, { align: 'center' });
 });

 yPos += 35;
 doc.setTextColor(0, 0, 0);

 // Provider Table
 doc.setFontSize(14);
 doc.setFont('helvetica', 'bold');
 doc.text(t.pdf.providerDetails, marginLeft, yPos);
 yPos += 8;

 const tableData = filteredProviders.map(p => [
 p.name,
 this.translateCategory(p.category, options.language || 'fr'),
 `${p.riskAssessment?.concentration || 0}%`,
 this.formatExportDate(p.contractInfo?.endDate, locale),
 p.compliance?.doraCompliant ? t.yes : t.no
 ]);

 autoTable(doc, {
 startY: yPos,
 head: [[t.columns.name, t.columns.category, t.columns.concentration, t.columns.contractEnd, t.columns.doraCompliant]],
 body: tableData,
 styles: {
 fontSize: 9,
 cellPadding: 3
 },
 headStyles: {
 fillColor: [15, 23, 42],
 textColor: [255, 255, 255],
 fontStyle: 'bold'
 },
 alternateRowStyles: {
 fillColor: [248, 250, 252]
 },
 margin: { left: marginLeft, right: marginRight }
 });

 // Footer on each page
 const pageCount = doc.getNumberOfPages();
 for (let i = 1; i <= pageCount; i++) {
 doc.setPage(i);
 doc.setFontSize(8);
 doc.setTextColor(100, 116, 139);
 doc.text(
 `${t.pdf.generatedAt} ${format(now, 'dd/MM/yyyy HH:mm')} - Sentinel GRC`,
 marginLeft,
 doc.internal.pageSize.height - 10
 );
 doc.text(
 `Page ${i}/${pageCount}`,
 pageWidth - marginRight,
 doc.internal.pageSize.height - 10,
 { align: 'right' }
 );
 }

 const blob = doc.output('blob');
 const filename = `dora-register-${format(now, 'yyyy-MM-dd-HHmm')}.pdf`;

 return { doc, blob, filename };
 } catch (error) {
  ErrorLogger.error(error, 'DORAExportService.generatePDF');
  throw error;
 }
 }

 /**
 * Save export record to Firestore
 */
 static async saveExportRecord(
 organizationId: string,
 record: Omit<DORAExportRecord, 'id' | 'organizationId'>
 ): Promise<string> {
 try {
 const docRef = await addDoc(collection(db, 'dora_exports'), sanitizeData({
 ...record,
 organizationId,
 createdAt: serverTimestamp()
 }));
 return docRef.id;
 } catch (error: unknown) {
 ErrorLogger.error(error, 'DORAExportService.saveExportRecord');
 throw error;
 }
 }

 /**
 * Get export history for an organization
 */
 static async getExportHistory(organizationId: string, limitParam = 50): Promise<DORAExportRecord[]> {
 try {
 const q = query(
 collection(db, 'dora_exports'),
 where('organizationId', '==', organizationId),
 orderBy('exportedAt', 'desc'),
 firestoreLimit(limitParam)
 );

 const snapshot = await getDocs(q);
 return snapshot.docs.map(doc => ({
 id: doc.id,
 ...doc.data()
 } as DORAExportRecord));
 } catch (error: unknown) {
 ErrorLogger.error(error, 'DORAExportService.getExportHistory');
 return [];
 }
 }

 /**
 * Delete export record (admin only)
 */
 // TODO: Role check (admin-only) should be enforced at the caller level (UI/component)
 static async deleteExportRecord(exportId: string, organizationId: string): Promise<void> {
 try {
 const docSnap = await getDoc(doc(db, 'dora_exports', exportId));
 if (!docSnap.exists() || docSnap.data()?.organizationId !== organizationId) {
 throw new Error('Not authorized');
 }
 await deleteDoc(doc(db, 'dora_exports', exportId));
 } catch (error: unknown) {
 ErrorLogger.error(error, 'DORAExportService.deleteExportRecord');
 throw error;
 }
 }

 /**
 * Download blob as file
 */
 static downloadBlob(blob: Blob, filename: string): void {
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = filename;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
 }

 // === Private Helper Methods ===

 private static filterProviders(providers: ICTProvider[], options: DORAExportOptions): ICTProvider[] {
 // Fix 14 - If includeHistorical is true, don't filter by active status
 let filtered = options.includeHistorical ? [...providers] : providers.filter(p => p.status === 'active');

 if (options.categoryFilter && options.categoryFilter !== 'all') {
 filtered = filtered.filter(p => p.category === options.categoryFilter);
 }

 return filtered;
 }

 private static calculateConcentrationAnalysis(providers: ICTProvider[]): ConcentrationAnalysis {
 const now = new Date();
 const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
 const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

 const concentrations = providers.map(p => p.riskAssessment?.concentration || 0);
 const avgConcentration = concentrations.length > 0
 ? concentrations.reduce((a, b) => a + b, 0) / concentrations.length
 : 0;

 return {
 totalProviders: providers.length,
 criticalProviders: providers.filter(p => p.category === 'critical').length,
 importantProviders: providers.filter(p => p.category === 'important').length,
 standardProviders: providers.filter(p => p.category === 'standard').length,
 averageConcentrationRisk: avgConcentration,
 highConcentrationProviders: providers
 .filter(p => (p.riskAssessment?.concentration || 0) > this.RISK_THRESHOLD_HIGH)
 .map(p => p.id),
 nonEuProviders: providers
 .filter(p => !p.compliance?.locationEU)
 .map(p => p.id),
 expiringContracts: {
 within30Days: providers.filter(p => {
  const end = parseDate(p.contractInfo?.endDate);
  return end && end <= in30Days && end > now;
 }).length,
 within90Days: providers.filter(p => {
  const end = parseDate(p.contractInfo?.endDate);
  return end && end <= in90Days && end > now;
 }).length
 }
 };
 }

 private static styleHeaderRow(sheet: Worksheet): void {
 sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
 sheet.getRow(1).fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FF0F172A' }
 };
 sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
 sheet.getRow(1).height = 25;
 }

 private static formatExportDate(dateValue: unknown, locale: Locale): string {
 const date = parseDate(dateValue);
 if (!date) return '-';
 return format(date, 'dd/MM/yyyy', { locale });
 }

 private static translateCategory(category: ICTCriticality, lang: string): string {
 const translations: Record<string, Record<ICTCriticality, string>> = {
 fr: { critical: 'Critique', important: 'Important', standard: 'Standard' },
 en: { critical: 'Critical', important: 'Important', standard: 'Standard' }
 };
 return translations[lang]?.[category] || category;
 }

 private static translateStatus(status: string, lang: string): string {
 const translations: Record<string, Record<string, string>> = {
 fr: { active: 'Actif', inactive: 'Inactif', pending: 'En attente', terminated: 'Terminé' },
 en: { active: 'Active', inactive: 'Inactive', pending: 'Pending', terminated: 'Terminated' }
 };
 return translations[lang]?.[status] || status;
 }

 private static translateSubstitutability(level: string, lang: string): string {
 const translations: Record<string, Record<string, string>> = {
 fr: { low: 'Faible', medium: 'Moyenne', high: 'Élevée' },
 en: { low: 'Low', medium: 'Medium', high: 'High' }
 };
 return translations[lang]?.[level] || level;
 }

 private static getRiskLevelLabel(riskScore: number, lang: string): string {
 if (riskScore > this.RISK_THRESHOLD_HIGH) return lang === 'fr' ? 'Élevé' : 'High';
 if (riskScore > this.RISK_THRESHOLD_MEDIUM) return lang === 'fr' ? 'Moyen' : 'Medium';
 return lang === 'fr' ? 'Faible' : 'Low';
 }

 private static getTranslations(lang: 'fr' | 'en') {
 return this.TRANSLATIONS[lang] ?? this.TRANSLATIONS.fr;
 }
}
