
import { Risk, Asset, Audit } from '../types';

export interface AuditSuggestion {
    name: string;
    type: 'Interne' | 'Certification' | 'Externe' | 'Fournisseur';
    dateScheduled: string;
    reason: string;
    relatedAssetIds: string[];
    relatedRiskIds: string[];
    priority: 'High' | 'Medium' | 'Low';
}

export class AuditPlannerService {

    /**
     * Generates a list of suggested audits based on risk exposure and asset criticality.
     * @param risks List of active risks
     * @param assets List of assets
     * @param existingAudits List of existing audits to prevent duplicates
     * @returns Array of audit suggestions
     */
    static generateAuditSuggestions(risks: Risk[], assets: Asset[], existingAudits: Audit[] = []): AuditSuggestion[] {
        const suggestions: AuditSuggestion[] = [];
        const today = new Date();

        // Helper to check if a risk is already covered
        const isRiskCovered = (riskId: string) => {
            return existingAudits.some(a =>
                (a.status === 'Planifié' || a.status === 'En cours') &&
                a.relatedRiskIds?.includes(riskId)
            );
        };

        // Helper to check if an asset is already covered
        const isAssetCovered = (assetId: string) => {
            return existingAudits.some(a =>
                (a.status === 'Planifié' || a.status === 'En cours') &&
                a.relatedAssetIds?.includes(assetId)
            );
        };

        // 1. High Risk Audits
        // Filter risks with score >= 15 (Critical) or >= 12 (High) that haven't been reviewed recently? 
        // For simplicity, we just target high scores.
        const highRisks = risks.filter(r => r.score >= 12 && r.status !== 'Fermé');

        highRisks.forEach(risk => {
            if (isRiskCovered(risk.id)) return;

            const dueDate = new Date(today);
            dueDate.setMonth(today.getMonth() + 3); // Within 3 months

            suggestions.push({
                name: `Audit Ciblé: ${risk.threat.substring(0, 30)}...`,
                type: 'Interne',
                dateScheduled: dueDate.toISOString().split('T')[0],
                reason: `Risque élevé détecté (Score: ${risk.score}).`,
                relatedAssetIds: [risk.assetId],
                relatedRiskIds: [risk.id],
                priority: risk.score >= 20 ? 'High' : 'Medium'
            });
        });

        // 2. Critical Asset Periodic Review
        const criticalAssets = assets.filter(a =>
            a.confidentiality === 'Critique' || a.integrity === 'Critique' || a.availability === 'Critique'
        );

        criticalAssets.forEach(asset => {
            if (isAssetCovered(asset.id)) return;

            const dueDate = new Date(today);
            dueDate.setMonth(today.getMonth() + 6); // Within 6 months for general review

            // Check if already covered by risk audit? (Simple logic for now: just add it)
            // Deduplicate logic could be added here if needed.

            suggestions.push({
                name: `Revue de Sécurité: ${asset.name}`,
                type: 'Interne',
                dateScheduled: dueDate.toISOString().split('T')[0],
                reason: `Actif critique identifié (${asset.type}).`,
                relatedAssetIds: [asset.id],
                relatedRiskIds: [],
                priority: 'High'
            });
        });

        // 3. Compliance Framework Audits (ISO27001)
        // If we have risks linked to ISO27001, suggest an audit.
        // Check if we already have a certification audit planned
        const hasIsoAudit = existingAudits.some(a =>
            (a.status === 'Planifié' || a.status === 'En cours') &&
            (a.type === 'Certification' || a.name.includes('ISO 27001'))
        );

        if (!hasIsoAudit) {
            const isoRisks = risks.filter(r => r.framework === 'ISO27001');
            if (isoRisks.length > 0) {
                const dueDate = new Date(today);
                dueDate.setMonth(today.getMonth() + 1);

                suggestions.push({
                    name: 'Audit de Pré-Certification ISO 27001',
                    type: 'Certification',
                    dateScheduled: dueDate.toISOString().split('T')[0],
                    reason: 'Présence de risques liés au référentiel ISO 27001.',
                    relatedAssetIds: [],
                    relatedRiskIds: isoRisks.map(r => r.id).slice(0, 10), // Limit to first 10
                    priority: 'High'
                });
            }
        }

        return suggestions;
    }
}
