
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PdfService } from './PdfService';
import { Risk, Control, Document as GRCDocument, Audit, Incident, Asset } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export class CompliancePackService {

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
        }
    ): Promise<void> {
        const zip = new JSZip();
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
    - Registre des risques complet
    - Plan de traitement (RTP)

02. Déclaration d'Applicabilité (SoA - ISO 27001)
    - État des contrôles (Annexe A)
    - Justifications et preuves

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
            // Risk Register
            const riskDoc = PdfService.generateExecutiveReport(
                {
                    title: "Registre des Risques",
                    subtitle: "Cartographie complète et évaluations",
                    filename: "risks.pdf",
                    organizationName: data.organizationName,
                    orientation: 'landscape',
                    save: false
                },
                (doc, y) => {
                    const headers = ['Menace', 'Actif', 'Brut', 'Stratégie', 'Résiduel', 'SLA'];
                    const rows = data.risks.map(r => [
                        r.threat,
                        data.assets.find(a => a.id === r.assetId)?.name || 'N/A',
                        r.score.toString(),
                        r.strategy,
                        (r.residualScore || r.score).toString(),
                        r.treatmentDeadline ? format(new Date(r.treatmentDeadline), 'dd/MM/yyyy') : 'N/A'
                    ]);
                    doc.autoTable({
                        startY: y,
                        head: [headers],
                        body: rows,
                        theme: 'striped',
                        headStyles: { fillColor: '#0F172A' }, // Brand Primary
                        styles: { fontSize: 8 }
                    });
                }
            );
            riskFolder.file("Registre_Risques.pdf", riskDoc.output('blob'));
        }

        // 3. SoA (Statement of Applicability)
        const soaFolder = rootFolder.folder("02_SoA_Conformité");
        if (soaFolder) {
            const soaDoc = PdfService.generateExecutiveReport(
                {
                    title: "Déclaration d'Applicabilité (SoA)",
                    subtitle: "ISO/IEC 27001:2022 Annexe A",
                    filename: "soa.pdf",
                    organizationName: data.organizationName,
                    orientation: 'portrait',
                    save: false
                },
                (doc, y) => {
                    const headers = ['Contrôle', 'Nom', 'Statut', 'Maturité'];
                    const rows = data.controls.map(c => [
                        c.code,
                        c.name,
                        c.status === 'Applicable' ? 'Oui' : 'Non',
                        `${c.maturity}/5`
                    ]);
                    doc.autoTable({
                        startY: y,
                        head: [headers],
                        body: rows,
                        theme: 'grid',
                        headStyles: { fillColor: '#0F172A' },
                        styles: { fontSize: 9 }
                    });
                }
            );
            soaFolder.file("SoA.pdf", soaDoc.output('blob'));
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
                    d.updatedAt ? format(new Date(d.updatedAt), 'dd/MM/yyyy') : 'N/A'
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
                            save: false
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
                data.incidents.map(i => [i.title, i.severity, i.status, format(new Date(i.createdAt), 'dd/MM/yyyy'), i.impact || 'N/A'])
            );
            incidentFolder.file("Registre_Incidents.pdf", incDoc.output('blob'));

            const assetDoc = PdfService.generateTableReport(
                { title: "Inventaire des Actifs", organizationName: data.organizationName, save: false },
                ['Nom', 'Type', 'Criticité', 'Propriétaire'],
                data.assets.map(a => [a.name, a.type, a.criticality, a.owner || 'N/A'])
            );
            incidentFolder.file("Inventaire_Actifs.pdf", assetDoc.output('blob'));
        }

        // 6. Audits
        const auditFolder = rootFolder.folder("05_Audits");
        if (auditFolder) {
            const auditDoc = PdfService.generateTableReport(
                { title: "Programme d'Audit", organizationName: data.organizationName, save: false },
                ['Audit', 'Date', 'Auditeur', 'Statut', 'Conformité'],
                data.audits.map(a => [a.name, format(new Date(a.dateScheduled), 'dd/MM/yyyy'), a.auditor, a.status, `${a.score || 0}%`])
            );
            auditFolder.file("Suivi_Audits.pdf", auditDoc.output('blob'));
        }

        // Generate and Save Final Zip
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Compliance_Pack_${data.organizationName.replace(/\s+/g, '_')}_${dateStr}.zip`);
    }
}
