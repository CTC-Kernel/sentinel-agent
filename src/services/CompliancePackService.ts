
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PdfService } from './PdfService';
import { Risk, Control, Document as GRCDocument, Audit, Incident, Asset, Project } from '../types';
import { format } from 'date-fns';
import { ReportEnrichmentService } from './ReportEnrichmentService';


export class CompliancePackService {

    /**
     * Generate a full Compliance Pack (ZIP) containing evidence
     */
    // Helper for safe date formatting
    static safeFormatDate(date: string | number | Date | undefined | null): string {
        if (!date) return 'N/A';
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return 'Date invalide';
            return format(d, 'dd/MM/yyyy');
        } catch (e) {
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

        if (!rootFolder) return;

        // 1. Executive Summary & ReadMe
        const readmeContent = `
PACK DE CONFORMITÉ - SENTINEL GRC
=================================
Généré le: ${new Date().toLocaleString('fr-FR')}
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

        // 2. Risk Management
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
                        80,  // height
                        data.risks.map(r => ({ probability: r.probability || 1, impact: r.impact || 1 }))
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
                        r.threat,
                        data.assets.find(a => a.id === r.assetId)?.name || 'N/A',
                        r.score.toString(),
                        r.strategy,
                        (r.residualScore || r.score).toString(),
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
            riskFolder.file("Registre_Risques_Enrichi.pdf", riskDoc.output('blob'));
        }

        // 3. SoA (Statement of Applicability)
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
                    // Need to calculate center X to look good
                    const pageWidth = doc.internal.pageSize.width;

                    PdfService.drawDonutChart(
                        doc,
                        pageWidth / 2 - 40, // Center roughly
                        currentY,
                        30, // Radius
                        [
                            { label: 'Implémenté', value: soaMetrics.implemented_controls, color: '#10B981' },
                            { label: 'En cours', value: soaMetrics.planned_controls, color: '#F59E0B' },
                            { label: 'Non commencé', value: soaMetrics.not_started, color: '#EF4444' },
                            { label: 'Non applicable', value: soaMetrics.not_applicable, color: '#CBD5E1' }
                        ],
                        `${soaMetrics.compliance_coverage}%`
                    );

                    currentY += 80; // Move past chart

                    const headers = ['Contrôle', 'Nom', 'Statut', 'Maturité'];
                    const rows = data.controls.map(c => [
                        c.code,
                        c.name,
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
            soaFolder.file("SoA_Enrichi.pdf", soaDoc.output('blob'));
        }

        // 4. Policies (Generated from content)
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
                    d.title,
                    d.type,
                    d.version,
                    d.status,
                    this.safeFormatDate(d.updatedAt)
                ])
            );
            docFolder.file("00_Index_Documentaire.pdf", indexDoc.output('blob'));

            // Generate individual PDFs for text-based policies
            data.documents.forEach(docItem => {
                if (docItem.content && docItem.status === 'Publié') {
                    // Strip HTML for PDF text safety (basic implementation)
                    const tempDiv = document.createElement("div");
                    tempDiv.innerHTML = docItem.content;
                    const plainText = tempDiv.textContent || docItem.content;

                    const policyPdf = PdfService.generateExecutiveReport(
                        {
                            title: docItem.title,
                            subtitle: `${docItem.type} | v${docItem.version}`,
                            organizationName: data.organizationName,
                            save: false,
                            includeCover: false // Simple policy docs usually don't need full cover, or maybe they do? Let's keep it simple to save size.
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
                    const safeName = docItem.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
                    docFolder.file(`${safeName}_v${docItem.version}.pdf`, policyPdf.output('blob'));
                }
            });
        }

        // 5. Incidents
        const incidentFolder = rootFolder.folder("04_Incidents_Operations");
        if (incidentFolder) {
            const incDoc = PdfService.generateTableReport(
                { title: "Registre des Incidents", organizationName: data.organizationName, save: false, orientation: 'landscape' },
                ['Titre', 'Sévérité', 'Statut', 'Date', 'Impact'],
                data.incidents.map(i => [i.title, i.severity, i.status, this.safeFormatDate(i.dateReported), i.impact || 'N/A'])
            );
            incidentFolder.file("Registre_Incidents.pdf", incDoc.output('blob'));

            const assetDoc = PdfService.generateTableReport(
                { title: "Inventaire des Actifs", organizationName: data.organizationName, save: false },
                ['Nom', 'Type', 'Criticité', 'Propriétaire'],
                data.assets.map(a => [a.name, a.type, a.confidentiality, a.owner || 'N/A'])
            );
            incidentFolder.file("Inventaire_Actifs.pdf", assetDoc.output('blob'));
        }

        // 6. Audits
        const auditFolder = rootFolder.folder("05_Audits");
        if (auditFolder) {
            const auditDoc = PdfService.generateTableReport(
                { title: "Programme d'Audit", organizationName: data.organizationName, save: false },
                ['Audit', 'Date', 'Auditeur', 'Statut', 'Conformité'],
                data.audits.map(a => [a.name, this.safeFormatDate(a.dateScheduled), a.auditor, a.status, `${a.score || 0}%`])
            );
            auditFolder.file("Suivi_Audits.pdf", auditDoc.output('blob'));
        }

        // Generate and Save Final Zip
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Compliance_Pack_${safeOrgName}_${dateStr}.zip`);
    }
}
