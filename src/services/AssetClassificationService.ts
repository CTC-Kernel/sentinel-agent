
import { Asset, Criticality, Risk } from '../types';

export class AssetClassificationService {

    /**
     * Analyzes an asset and suggests CIA ratings based on its properties.
     * @param asset Partial asset data from form or object
     * @returns Suggested ratings and a reasoning string
     */
    static suggestClassification(asset: Partial<Asset>): { confidentiality: Criticality; integrity: Criticality; availability: Criticality; reason: string } {
        let c = Criticality.LOW;
        let i = Criticality.LOW;
        let a = Criticality.LOW;
        const reasons: string[] = [];

        const getScore = (c: Criticality): number => {
            switch (c) {
                case Criticality.CRITICAL: return 5;
                case Criticality.HIGH: return 4;
                case Criticality.MEDIUM: return 3;
                default: return 1;
            }
        };

        // 1. Analysis based on Asset Type
        if (asset.type === 'Données') {
            const cat = asset.dataDetails?.dataCategory;
            if (cat === 'Financier' || cat === 'Propriété Intellectuelle') {
                c = Criticality.CRITICAL;
                i = Criticality.HIGH;
                reasons.push(`Type Données sensibles (${cat}) détecté.`);
            } else if (cat === 'Client' || cat === 'Employé') {
                c = Criticality.HIGH;
                reasons.push('Données personnelles détectées (GDPR).');
            } else {
                c = Criticality.MEDIUM;
                reasons.push('Actif de type Données.');
            }
        }
        else if (asset.type === 'Service') {
            a = Criticality.HIGH;
            reasons.push('Service infrastructurel: disponibilité prioritaire.');
            if (asset.serviceDetails?.sla && asset.serviceDetails.sla.includes('99.9')) {
                a = Criticality.CRITICAL;
                reasons.push('SLA élevé détecté (>99.9%).');
            }
        }
        else if (asset.type === 'Matériel') {
            a = Criticality.MEDIUM;
            i = Criticality.MEDIUM;

            // Name detection
            if (asset.name?.toLowerCase().includes('server') || asset.name?.toLowerCase().includes('serveur')) {
                a = Criticality.HIGH;
                i = Criticality.HIGH;
                reasons.push('Serveur détecté.');
            } else if (asset.name?.toLowerCase().includes('firewall') || asset.name?.toLowerCase().includes('router')) {
                a = Criticality.CRITICAL; // Network gear is critical
                reasons.push('Équipement réseau critique.');
            }

            // Location detection
            if (asset.location && (asset.location.toLowerCase().includes('datacenter') || asset.location.toLowerCase().includes('salle server'))) {
                if (getScore(a) < 3) a = Criticality.HIGH;
                reasons.push('Localisation critique (Datacenter).');
            }

            // Value detection
            if (asset.purchasePrice && Number(asset.purchasePrice) > 5000) {
                if (getScore(a) < 3) a = Criticality.HIGH;
                reasons.push('Valeur matérielle élevée.');
            }
        }
        else if (asset.type === 'Humain') {
            a = Criticality.HIGH; // Key peson risk
            i = Criticality.HIGH; // Competence/Integrity
            reasons.push('Actif Humain: Disponibilité et Compétence critiques.');
        }

        // 2. Keyword Analysis (Scope)
        if (asset.scope) {
            if (asset.scope.includes('HDS')) {
                c = Criticality.CRITICAL;
                i = Criticality.CRITICAL;
                a = Criticality.CRITICAL;
                reasons.push('Périmètre HDS (Données de Santé) impose une classification maximale par défaut.');
            } else if (asset.scope.includes('PCI_DSS')) {
                c = Criticality.CRITICAL;
                i = Criticality.HIGH;
                reasons.push('Périmètre PCI-DSS détecté.');
            }
        }

        // 3. Fallback / Adjustment
        // Ensure strictly increasing if CRITICAL detected anywhere
        if (c === Criticality.CRITICAL || i === Criticality.CRITICAL || a === Criticality.CRITICAL) {
            reasons.push('Note: Une dimension critique a été identifiée.');
        }

        return {
            confidentiality: c,
            integrity: i,
            availability: a,
            reason: reasons.length > 0 ? reasons.join(' ') : 'Classification par défaut.'
        };
    }

    /**
     * Determines if risks associated with this asset should have their impact score updated.
     * @param asset The updated asset
     * @param risks List of risks linked to this asset
     * @returns Array of risks that need updating
     */
    static checkRiskImpactConsistency(asset: Asset, risks: Risk[]): Risk[] {
        const suggestedRisks: Risk[] = [];

        // Map Criticality enum to numeric value 1-4 (roughly) to compare with Risk Impact (1-5)
        const getScore = (c: Criticality): number => {
            switch (c) {
                case Criticality.CRITICAL: return 5;
                case Criticality.HIGH: return 4;
                case Criticality.MEDIUM: return 3;
                default: return 1;
            }
        };

        const maxAssetImpact = Math.max(
            getScore(asset.confidentiality),
            getScore(asset.integrity),
            getScore(asset.availability)
        );

        for (const risk of risks) {
            // Logic: Risk impact shouldn't be significantly lower than Asset's criticality
            // If asset is Critical (5) and Risk Impact is Low (1 or 2), suggest increase.
            if (risk.impact < maxAssetImpact - 1) {
                // Suggest upgrading risk impact
                suggestedRisks.push({
                    ...risk,
                    impact: Math.max(risk.impact, maxAssetImpact - 1) as 1 | 2 | 3 | 4 | 5,
                    justification: `Impact ajusté suite à la reclassification de l'actif ${asset.name} (${asset.confidentiality}/${asset.integrity}/${asset.availability}).`
                });
            }
        }

        return suggestedRisks;
    }
}
