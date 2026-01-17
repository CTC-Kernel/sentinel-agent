/**
 * EBIOS Report Generation Service
 * Generates PDF reports for EBIOS RM workshops
 *
 * Story 15.6: Génération de la Note de Cadrage
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PdfService, ReportOptions } from './PdfService';
import type {
  EbiosAnalysis,
  Workshop1Data,
} from '../types/ebios';
import { GRAVITY_SCALE } from '../data/ebiosLibrary';

interface Workshop1ReportOptions extends Partial<ReportOptions> {
  organizationName?: string;
  author?: string;
  includeBaselineDetails?: boolean;
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
            ['Date de création', format(new Date(analysis.createdAt), 'dd/MM/yyyy', { locale: fr })],
            ['Date cible de certification', analysis.targetCertificationDate
              ? format(new Date(analysis.targetCertificationDate), 'dd/MM/yyyy', { locale: fr })
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
}
