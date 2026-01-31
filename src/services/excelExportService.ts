import { Risk, Asset, Control, Audit, Incident, Project } from '../types';
import { RISK_THRESHOLDS } from '../constants/complianceConfig';

interface ExportOptions {
    filename: string;
    sheets: {
        name: string;
        data: Record<string, unknown>[];
        columns: { header: string; key: string; width?: number }[];
    }[];
    includeCharts?: boolean;
    logo?: string;
}

/**
 * Service d'export Excel enrichi avec formatage professionnel
 */
export class ExcelExportService {
    /**
     * Exporte des données vers un fichier Excel multi-feuilles
     */
    static async exportToExcel(options: ExportOptions): Promise<void> {
        const { default: ExcelJS } = await import('exceljs');
        const workbook = new ExcelJS.Workbook();

        // Métadonnées
        workbook.creator = 'Sentinel GRC';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Créer chaque feuille
        for (const sheet of options.sheets) {
            const worksheet = workbook.addWorksheet(sheet.name);

            // Définir les colonnes
            worksheet.columns = sheet.columns;

            // Style de l'en-tête
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF3B82F6' }
            };
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
            worksheet.getRow(1).height = 25;

            // Ajouter les données
            worksheet.addRows(sheet.data);

            // Formatage conditionnel pour les scores de risque
            if (sheet.name === 'Risques' && sheet.data.length > 0) {
                const scoreColumn = sheet.columns.findIndex(col => col.key === 'score') + 1;
                if (scoreColumn > 0) {
                    for (let i = 2; i <= sheet.data.length + 1; i++) {
                        const cell = worksheet.getCell(i, scoreColumn);
                        const value = cell.value as number;

                        if (value >= RISK_THRESHOLDS.CRITICAL) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFEF4444' }
                            };
                            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                        } else if (value >= RISK_THRESHOLDS.HIGH) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFF59E0B' }
                            };
                        } else if (value >= RISK_THRESHOLDS.MEDIUM) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFBBF24' }
                            };
                        } else {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FF10B981' }
                            };
                            cell.font = { color: { argb: 'FFFFFFFF' } };
                        }
                    }
                }
            }

            // Auto-ajuster les largeurs de colonnes
            worksheet.columns.forEach(column => {
                if (!column.width) {
                    let maxLength = 0;
                    column.eachCell?.({ includeEmpty: true }, (cell) => {
                        const cellLength = cell.value ? cell.value.toString().length : 10;
                        if (cellLength > maxLength) {
                            maxLength = cellLength;
                        }
                    });
                    column.width = Math.min(maxLength + 2, 50);
                }
            });

            // Ajouter des bordures
            worksheet.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };
                });
            });
        }

        // Générer et télécharger le fichier
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${options.filename}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Export complet GRC (tous les modules)
     */
    static async exportCompleteGRC(data: {
        risks: Risk[];
        assets: Asset[];
        controls: Control[];
        audits: Audit[];
        incidents: Incident[];
        projects: Project[];
    }): Promise<void> {
        await this.exportToExcel({
            filename: `Sentinel_GRC_Export_${new Date().toISOString().split('T')[0]}`,
            sheets: [
                {
                    name: 'Risques',
                    columns: [
                        { header: 'Menace', key: 'threat', width: 30 },
                        { header: 'Vulnérabilité', key: 'vulnerability', width: 30 },
                        { header: 'Probabilité', key: 'probability', width: 12 },
                        { header: 'Impact', key: 'impact', width: 12 },
                        { header: 'Score', key: 'score', width: 10 },
                        { header: 'Stratégie', key: 'strategy', width: 15 },
                        { header: 'Statut', key: 'status', width: 12 },
                        { header: 'Responsable', key: 'owner', width: 20 }
                    ],
                    data: data.risks.map(r => ({
                        threat: r.threat,
                        vulnerability: r.vulnerability,
                        probability: r.probability,
                        impact: r.impact,
                        score: r.score,
                        strategy: r.strategy,
                        status: r.status,
                        owner: r.owner
                    }))
                },
                {
                    name: 'Actifs',
                    columns: [
                        { header: 'Nom', key: 'name', width: 25 },
                        { header: 'Type', key: 'type', width: 15 },
                        { header: 'Propriétaire', key: 'owner', width: 20 },
                        { header: 'Confidentialité', key: 'confidentiality', width: 15 },
                        { header: 'Intégrité', key: 'integrity', width: 15 },
                        { header: 'Disponibilité', key: 'availability', width: 15 },
                        { header: 'Statut', key: 'status', width: 12 }
                    ],
                    data: data.assets.map(a => ({
                        name: a.name,
                        type: a.type,
                        owner: a.owner,
                        confidentiality: a.confidentiality,
                        integrity: a.integrity,
                        availability: a.availability,
                        status: (a as unknown as { status?: string }).status || 'Actif'
                    }))
                },
                {
                    name: 'Conformité',
                    columns: [
                        { header: 'Code', key: 'code', width: 12 },
                        { header: 'Nom', key: 'name', width: 40 },
                        { header: 'Statut', key: 'status', width: 15 },
                        { header: 'Justification', key: 'justification', width: 40 }
                    ],
                    data: data.controls.map(c => ({
                        code: c.code,
                        name: c.name,
                        status: c.status,
                        justification: c.justification || '-'
                    }))
                },
                {
                    name: 'Audits',
                    columns: [
                        { header: 'Nom', key: 'name', width: 30 },
                        { header: 'Type', key: 'type', width: 15 },
                        { header: 'Statut', key: 'status', width: 12 },
                        { header: 'Auditeur', key: 'auditor', width: 20 },
                        { header: 'Date', key: 'dateScheduled', width: 15 }
                    ],
                    data: data.audits.map(a => ({
                        name: a.name,
                        type: a.type,
                        status: a.status,
                        auditor: a.auditor,
                        dateScheduled: a.dateScheduled
                    }))
                },
                {
                    name: 'Incidents',
                    columns: [
                        { header: 'Titre', key: 'title', width: 30 },
                        { header: 'Sévérité', key: 'severity', width: 12 },
                        { header: 'Statut', key: 'status', width: 12 },
                        { header: 'Date', key: 'dateReported', width: 15 },
                        { header: 'Responsable', key: 'responseOwner', width: 20 }
                    ],
                    data: data.incidents.map(i => ({
                        title: i.title,
                        severity: i.severity,
                        status: i.status,
                        dateReported: i.dateReported,
                        responseOwner: (i as unknown as { responseOwner?: string }).responseOwner || '-'
                    }))
                },
                {
                    name: 'Projets',
                    columns: [
                        { header: 'Nom', key: 'name', width: 30 },
                        { header: 'Statut', key: 'status', width: 12 },
                        { header: 'Manager', key: 'manager', width: 20 },
                        { header: 'Début', key: 'startDate', width: 15 },
                        { header: 'Fin', key: 'endDate', width: 15 }
                    ],
                    data: data.projects.map(p => ({
                        name: p.name,
                        status: p.status,
                        manager: p.manager,
                        startDate: (p as unknown as { startDate?: string }).startDate || '-',
                        endDate: (p as unknown as { endDate?: string }).endDate || '-'
                    }))
                }
            ]
        });
    }
}
