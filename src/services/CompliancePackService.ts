
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import DOMPurify from 'dompurify';
import { PdfService } from './PdfService';
import { Risk, Control, Document as GRCDocument, Audit, Incident, Asset, Project } from '../types';
import { format } from 'date-fns';
import { ReportEnrichmentService } from './ReportEnrichmentService';
import { ErrorLogger } from './errorLogger';
import { CONTROL_STATUS } from '../constants/complianceConfig';
import { getLocaleConfig, type SupportedLocale } from '../config/localeConfig';
import i18n from '../i18n';

export class CompliancePackService {

 /**
 * Generate a full Compliance Pack (ZIP) containing evidence
 */
 // Helper for safe date formatting
 static safeFormatDate(date: unknown): string {
 if (!date) return 'N/A';
 try {
 // Handle Firestore Timestamp
 const d = date as { toDate?: () => Date; seconds?: number } | number | string | Date;

 if (d && typeof (d as { toDate?: () => Date }).toDate === 'function') {
 return format((d as { toDate: () => Date }).toDate(), 'dd/MM/yyyy');
 }
 // Handle object with seconds (serialized Timestamp)
 if (d && typeof (d as { seconds?: number }).seconds === 'number') {
 return format(new Date((d as { seconds: number }).seconds * 1000), 'dd/MM/yyyy');
 }

 const dateObj = new Date(d as string | number | Date);
 if (isNaN(dateObj.getTime())) return 'Date invalide';
 return format(dateObj, 'dd/MM/yyyy');
 } catch {
 return 'N/A';
 }
 }

 /**
 * Generate a full Compliance Pack (ZIP) containing evidence
 */
 static async generatePack(
 data: {
 organizationName: string;
 risks: Risk[];
 controls: Control[];
 documents: GRCDocument[];
 audits: Audit[];
 incidents: Incident[];
 assets: Asset[];
 projects?: Project[]; // Optional for now
 }
 ): Promise<void> {
 const zip = new JSZip();
 // Use safe replacement for filenames
 const safeOrgName = (data.organizationName || 'Organization').replace(/[^a-z0-9]/gi, '_');
 const dateStr = format(new Date(), 'yyyy-MM-dd');
 const rootFolder = zip.folder(`Conformité_${dateStr}`);

 if (!rootFolder) {
 throw new Error('Failed to create root folder in ZIP');
 }

 // 1. Executive Summary & ReadMe
 try {
 const readmeContent = `
PACK DE CONFORMITÉ - SENTINEL GRC
=================================
Généré le: ${new Date().toLocaleString(getLocaleConfig(i18n.language as SupportedLocale).intlLocale)}
Organisation: ${data.organizationName}

CONTENU DU PACK:
----------------
01. Gestion des Risques (ISO 27005)
 - Registre des risques complet (Enrichi IA)
 - Plan de traitement (RTP)

02. Déclaration d'Applicabilité (SoA - ISO 27001)
 - État des contrôles (Annexe A)
 - Justifications et preuves
 - Tableaux de bord de conformité

03. Politiques & Procédures
 - Documents publiés
 - Versionning et approbations

04. Incidents & Opérations
 - Registre des incidents
 - Inventaire des actifs

05. Audit
 - Programme d'audit
 - Rapports d'audit

CERTIFICATION:
Ce pack contient des preuves extraites du système Sentinel GRC.
L'intégrité de ces données est garantie par le système.
 `;
 rootFolder.file("00_LISEZ_MOI.txt", readmeContent.trim());
 } catch (error) {
 ErrorLogger.error('Pack Generation: README failed', 'CompliancePackService.generatePack', { metadata: { error } });
 }

 // 2. Risk Management
 try {
 const riskFolder = rootFolder.folder("01_Gestion_des_Risques");
 if (riskFolder) {
 // Risk Register with AI & Graphics
 const riskMetrics = ReportEnrichmentService.calculateMetrics(data.risks);
 const riskSummary = ReportEnrichmentService.generateExecutiveSummary(riskMetrics);
 const riskAnalysis = ReportEnrichmentService.analyzeRiskPortfolio(data.risks);

 const riskDoc = PdfService.generateExecutiveReport(
  {
  title: "Registre des Risques",
  subtitle: "Cartographie complète et évaluations (ISO 27005)",
  filename: "risks.pdf",
  organizationName: data.organizationName,
  orientation: 'landscape',
  save: false,
  summary: riskSummary, // AI Summary
  metrics: [
  { label: 'Score Global', value: `${riskMetrics.risk_score}/100`, subtext: 'Exposition au risque' },
  { label: 'Risques Critiques', value: riskMetrics.critical_risks, subtext: 'Priorité immédiate' },
  { label: 'Taux de Traitement', value: `${riskMetrics.treated_percentage}%`, subtext: 'Plans actifs' }
  ],
  stats: [
  { label: 'Critique', value: riskMetrics.critical_risks, color: '#EF4444' },
  { label: 'Élevé', value: riskMetrics.high_risks, color: '#F97316' },
  { label: 'Moyen', value: riskMetrics.medium_risks, color: '#EAB308' },
  { label: 'Faible', value: riskMetrics.low_risks, color: '#10B981' }
  ]
  },
  (doc, y) => {
  let currentY = y;

  // Add Risk Matrix
  doc.setFontSize(14);
  doc.setTextColor('#334155');
  doc.setFont('helvetica', 'bold');
  doc.text("Matrice de Chaleur (Heatmap)", 14, currentY);
  currentY += 10;

  PdfService.drawRiskMatrix(
  doc,
  14,
  currentY,
  100, // width
  80, // height
  data.risks.map(r => ({ probability: Number(r.probability) || 1, impact: Number(r.impact) || 1 }))
  );

  // Add Recommendations next to matrix
  doc.setFontSize(12);
  doc.text("Recommandations IA", 130, currentY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#475569');

  let recY = currentY + 10;
  riskAnalysis.recommendations.forEach(rec => {
  const splitRec = doc.splitTextToSize(`• ${rec}`, 150);
  doc.text(splitRec, 130, recY);
  recY += (splitRec.length * 5) + 2;
  });

  currentY += 90; // Move past matrix

  // Risk Table
  doc.setFontSize(14);
  doc.setTextColor('#334155');
  doc.setFont('helvetica', 'bold');
  doc.text("Détail du Registre", 14, currentY);
  currentY += 10;

  const headers = ['Menace', 'Actif', 'Brut', 'Stratégie', 'Résiduel', 'SLA'];
  const rows = data.risks.map(r => [
  r.threat || 'N/A',
  data.assets.find(a => a.id === r.assetId)?.name || 'N/A',
  (r.score || 0).toString(),
  r.strategy || 'N/A',
  (r.residualScore || r.score || 0).toString(),
  this.safeFormatDate(r.treatmentDeadline)
  ]);

  doc.autoTable({
  startY: currentY,
  head: [headers],
  body: rows,
  theme: 'striped',
  headStyles: { fillColor: '#0F172A' },
  styles: { fontSize: 8 },
  margin: { bottom: 20 }
  });
  }
 );
 const buffer = riskDoc.output('arraybuffer');
 if (buffer && buffer.byteLength > 0) {
  riskFolder.file("Registre_Risques_Enrichi.pdf", new Uint8Array(buffer));
 } else {
  ErrorLogger.error('Pack Generation: Risk PDF is empty', 'CompliancePackService.generatePack');
 }
 }
 } catch (error) {
 ErrorLogger.error('Pack Generation: Risk section failed', 'CompliancePackService.generatePack', { metadata: { error } });
 }

 // 3. SoA (Statement of Applicability)
 try {
 const soaFolder = rootFolder.folder("02_SoA_Conformité");
 if (soaFolder) {
 const soaMetrics = ReportEnrichmentService.calculateComplianceMetrics(data.controls);
 const soaSummary = ReportEnrichmentService.generateComplianceExecutiveSummary(soaMetrics);

 const soaDoc = PdfService.generateExecutiveReport(
  {
  title: "Déclaration d'Applicabilité (SoA)",
  subtitle: "ISO/IEC 27001:2022 Annexe A - Analyse de Conformité",
  filename: "soa.pdf",
  organizationName: data.organizationName,
  orientation: 'portrait',
  save: false,
  summary: soaSummary,
  metrics: [
  { label: 'Couverture', value: `${soaMetrics.compliance_coverage}%`, subtext: 'Contrôles implémentés' },
  { label: 'Maturité Audit', value: `${soaMetrics.audit_readiness}%`, subtext: 'Prêt pour certificat' },
  { label: 'À Traiter', value: soaMetrics.not_started, subtext: 'Contrôles non commencés' }
  ]
  },
  (doc, y) => {
  let currentY = y;

  // Graphics Section
  doc.setFontSize(14);
  doc.setTextColor('#334155');
  doc.setFont('helvetica', 'bold');
  doc.text("Distribution des Contrôles", 14, currentY);
  currentY += 10;

  // Draw Donut Chart
  const pageWidth = doc.internal.pageSize.width;

  PdfService.drawDonutChart(
  doc,
  pageWidth / 2 - 40, // Center roughly
  currentY,
  30, // Radius
  [
  { label: CONTROL_STATUS.IMPLEMENTED, value: soaMetrics.implemented_controls, color: '#10B981' },
  { label: CONTROL_STATUS.IN_PROGRESS, value: soaMetrics.planned_controls, color: '#F59E0B' },
  { label: CONTROL_STATUS.NOT_STARTED, value: soaMetrics.not_started, color: '#EF4444' },
  { label: CONTROL_STATUS.NOT_APPLICABLE, value: soaMetrics.not_applicable, color: '#CBD5E1' }
  ],
  `${soaMetrics.compliance_coverage}%`
  );

  currentY += 80; // Move past chart

  const headers = ['Contrôle', 'Nom', 'Statut', 'Maturité'];
  const rows = data.controls.map(c => [
  c.code || '',
  c.name || '',
  c.applicability === 'Applicable' ? 'Oui' : 'Non',
  `${c.maturity || 0}/5`
  ]);

  doc.autoTable({
  startY: currentY,
  head: [headers],
  body: rows,
  theme: 'grid',
  headStyles: { fillColor: '#0F172A' },
  styles: { fontSize: 9 }
  });
  }
 );
 const buffer = soaDoc.output('arraybuffer');
 if (buffer && buffer.byteLength > 0) {
  soaFolder.file("SoA_Enrichi.pdf", new Uint8Array(buffer));
 } else {
  ErrorLogger.error('Pack Generation: SoA PDF is empty', 'CompliancePackService.generatePack');
 }
 }
 } catch (error) {
 ErrorLogger.error('Pack Generation: SoA section failed', 'CompliancePackService.generatePack', { metadata: { error } });
 }

 // 4. Policies (Generated from content)
 try {
 const docFolder = rootFolder.folder("03_Politiques_Procedures");
 if (docFolder) {
 // Index of documents
 const indexDoc = PdfService.generateTableReport(
  {
  title: "Index Documentaire",
  organizationName: data.organizationName,
  save: false
  },
  ['Titre', 'Type', 'Version', 'Statut', 'Dernière Revue'],
  data.documents.map(d => [
  d.title || 'Sans titre',
  d.type || 'N/A',
  d.version || '1.0',
  d.status || 'Brouillon',
  this.safeFormatDate(d.updatedAt)
  ])
 );
 const buffer = indexDoc.output('arraybuffer');
 if (buffer && buffer.byteLength > 0) {
  docFolder.file("00_Index_Documentaire.pdf", new Uint8Array(buffer));
 }

 // Generate individual PDFs for text-based policies
 data.documents.forEach(docItem => {
  if (docItem.content && docItem.status === 'Publié') {
  try {
  // Strip HTML for PDF text safety - sanitize first to prevent XSS
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = DOMPurify.sanitize(docItem.content, { ALLOWED_TAGS: [] });
  const plainText = tempDiv.textContent || '';

  const policyPdf = PdfService.generateExecutiveReport(
  {
   title: docItem.title || 'Document',
   subtitle: `${docItem.type} | v${docItem.version}`,
   organizationName: data.organizationName,
   save: false,
   includeCover: false
  },
  (doc, y) => {
   doc.setFontSize(10);
   PdfService.addSafeText(
   doc,
   plainText,
   14,
   y,
   doc.internal.pageSize.width - 28,
   6,
   doc.internal.pageSize.height
   );
  }
  );
  // Sanitize filename
  const safeName = (docItem.title || 'Doc').replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const buffer = policyPdf.output('arraybuffer');
  if (buffer && buffer.byteLength > 0) {
  docFolder.file(`${safeName}_v${docItem.version}.pdf`, new Uint8Array(buffer));
  }
  } catch (error) {
  ErrorLogger.error('Pack Generation: Individual Policy PDF failed', 'CompliancePackService.generatePack', { metadata: { error, title: docItem.title } });
  }
  }
 });
 }
 } catch {
 // README creation failed, but continue with other files
 }

 // 5. Incidents
 try {
 const incidentFolder = rootFolder.folder("04_Incidents_Operations");
 if (incidentFolder) {
 const incDoc = PdfService.generateTableReport(
  { title: "Registre des Incidents", organizationName: data.organizationName, save: false, orientation: 'landscape' },
  ['Titre', 'Sévérité', 'Statut', 'Date', 'Impact'],
  data.incidents.map(i => [i.title || '', i.severity || 'Medium', i.status || 'Open', this.safeFormatDate(i.dateReported), i.impact || 'N/A'])
 );
 const incBuffer = incDoc.output('arraybuffer');
 if (incBuffer && incBuffer.byteLength > 0) {
  incidentFolder.file("Registre_Incidents.pdf", new Uint8Array(incBuffer));
 }

 const assetDoc = PdfService.generateTableReport(
  { title: "Inventaire des Actifs", organizationName: data.organizationName, save: false },
  ['Nom', 'Type', 'Criticité', 'Propriétaire'],
  data.assets.map(a => [a.name || '', a.type || 'N/A', a.confidentiality || 'Low', a.owner || 'N/A'])
 );
 const assetBuffer = assetDoc.output('arraybuffer');
 if (assetBuffer && assetBuffer.byteLength > 0) {
  incidentFolder.file("Inventaire_Actifs.pdf", new Uint8Array(assetBuffer));
 }
 }
 } catch (error) {
 ErrorLogger.error('Pack Generation: Incidents/Assets section failed', 'CompliancePackService.generatePack', { metadata: { error } });
 }

 // 6. Audits
 try {
 const auditFolder = rootFolder.folder("05_Audits");
 if (auditFolder) {
 const auditDoc = PdfService.generateTableReport(
  { title: "Programme d'Audit", organizationName: data.organizationName, save: false },
  ['Audit', 'Date', 'Auditeur', 'Statut', 'Conformité'],
  data.audits.map(a => [a.name || '', this.safeFormatDate(a.dateScheduled), a.auditor || 'N/A', a.status || 'Planned', `${a.score || 0}%`])
 );
 const auditBuffer = auditDoc.output('arraybuffer');
 if (auditBuffer && auditBuffer.byteLength > 0) {
  auditFolder.file("Suivi_Audits.pdf", new Uint8Array(auditBuffer));
 }
 }
 } catch (error) {
 ErrorLogger.error('Pack Generation: Audits section failed', 'CompliancePackService.generatePack', { metadata: { error } });
 }

 // Generate and Save Final Zip
 try {
 const content = await zip.generateAsync({ type: "blob" });
 saveAs(content, `Compliance_Pack_${safeOrgName}_${dateStr}.zip`);
 } catch (_e) {
 throw new Error('Failed to create ZIP file: ' + _e);
 }
 }
}
