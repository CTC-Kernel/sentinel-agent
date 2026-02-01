/**
 * Risk Register Export Utilities
 * Story 3.5: Risk Register View - Export functionality
 */

import { Risk, Asset, UserProfile } from '../types';
import { ExcelExportService } from '../services/excelExportService';
import { PdfService } from '../services/PdfService';
import { getRiskLevel } from './riskUtils';
import { RISK_THRESHOLDS } from '../constants/complianceConfig';
import { format } from 'date-fns';
import { getDateFnsLocale } from '../config/localeConfig';
import { RISK_COLORS, STATUS_COLORS } from '../constants/colors';

interface RiskExportContext {
    risks: Risk[];
    assets: Asset[];
    users: UserProfile[];
    organizationName?: string;
}

/**
 * Get owner display name from user ID
 */
function getOwnerName(ownerId: string | undefined, users: UserProfile[]): string {
    if (!ownerId) return 'Non assigné';
    const user = users.find(u => u.uid === ownerId);
    return user ? (user.displayName || user.email || ownerId) : ownerId;
}

/**
 * Get asset name from asset ID
 */
function getAssetName(assetId: string | undefined, assets: Asset[]): string {
    if (!assetId) return 'Non défini';
    const asset = assets.find(a => a.id === assetId);
    return asset?.name || 'Actif inconnu';
}

/**
 * Export risk register to Excel format
 */
export async function exportRisksToExcel(context: RiskExportContext): Promise<void> {
    const { risks, assets, users, organizationName } = context;

    const exportData = risks.map(risk => ({
        threat: risk.threat,
        vulnerability: risk.vulnerability,
        asset: getAssetName(risk.assetId, assets),
        category: risk.category || '-',
        probability: risk.probability,
        impact: risk.impact,
        score: risk.score,
        criticality: getRiskLevel(risk.score).label,
        strategy: risk.strategy,
        status: risk.status,
        owner: getOwnerName(risk.owner, users),
        framework: risk.framework || '-',
        residualScore: risk.residualScore || '-',
        treatmentDeadline: risk.treatmentDeadline || '-',
        createdAt: risk.createdAt ? format(new Date(risk.createdAt), 'dd/MM/yyyy', { locale: getDateFnsLocale() }) : '-'
    }));

    await ExcelExportService.exportToExcel({
        filename: `Registre_Risques_${organizationName || 'Export'}_${format(new Date(), 'yyyy-MM-dd')}`,
        sheets: [
            {
                name: 'Registre des Risques',
                columns: [
                    { header: 'Menace', key: 'threat', width: 30 },
                    { header: 'Vulnérabilité', key: 'vulnerability', width: 30 },
                    { header: 'Actif', key: 'asset', width: 20 },
                    { header: 'Catégorie', key: 'category', width: 15 },
                    { header: 'Probabilité', key: 'probability', width: 12 },
                    { header: 'Impact', key: 'impact', width: 12 },
                    { header: 'Score', key: 'score', width: 10 },
                    { header: 'Criticité', key: 'criticality', width: 12 },
                    { header: 'Stratégie', key: 'strategy', width: 15 },
                    { header: 'Statut', key: 'status', width: 15 },
                    { header: 'Responsable', key: 'owner', width: 20 },
                    { header: 'Référentiel', key: 'framework', width: 15 },
                    { header: 'Score Résiduel', key: 'residualScore', width: 12 },
                    { header: 'Échéance', key: 'treatmentDeadline', width: 12 },
                    { header: 'Créé le', key: 'createdAt', width: 12 }
                ],
                data: exportData
            }
        ]
    });
}

/**
 * Export risk register to PDF format
 */
export function exportRisksToPdf(context: RiskExportContext): void {
    const { risks, organizationName } = context;

    const doc = PdfService.generateRiskExecutiveReport(
        risks,
        {
            title: 'Registre des Risques',
            subtitle: organizationName || 'Rapport Complet',
            orientation: 'landscape',
            filename: `Registre_Risques_${format(new Date(), 'yyyy-MM-dd')}`,
            organizationName,
            autoDownload: true
        }
    );

    // Save the PDF
    doc.save(`Registre_Risques_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

/**
 * Export risk summary statistics
 */
export function getRiskSummaryStats(risks: Risk[]): {
    total: number;
    byCriticality: { label: string; count: number; color: string }[];
    byStatus: { label: string; count: number }[];
} {
    const total = risks.length;

    const byCriticality = [
        { label: 'Critique', count: risks.filter(r => r.score >= RISK_THRESHOLDS.CRITICAL).length, color: RISK_COLORS.critical },
        { label: 'Élevé', count: risks.filter(r => r.score >= RISK_THRESHOLDS.HIGH && r.score < RISK_THRESHOLDS.CRITICAL).length, color: RISK_COLORS.high },
        { label: 'Moyen', count: risks.filter(r => r.score >= RISK_THRESHOLDS.MEDIUM && r.score < RISK_THRESHOLDS.HIGH).length, color: RISK_COLORS.medium },
        { label: 'Faible', count: risks.filter(r => r.score < RISK_THRESHOLDS.MEDIUM).length, color: STATUS_COLORS.success }
    ];

    const byStatus = [
        { label: 'Ouvert', count: risks.filter(r => r.status === 'Ouvert').length },
        { label: 'En cours', count: risks.filter(r => r.status === 'En cours').length },
        { label: 'En attente', count: risks.filter(r => r.status === 'En attente de validation').length },
        { label: 'Fermé', count: risks.filter(r => r.status === 'Fermé').length }
    ];

    return { total, byCriticality, byStatus };
}
