import { Risk, Control } from '../types';
import { RISK_THRESHOLDS, CONTROL_STATUS, PARTIAL_CONTROL_WEIGHT } from '../constants/complianceConfig';

/**
 * Control status weight map for mitigation calculations
 */
export const CONTROL_STATUS_WEIGHTS: Record<string, number> = {
    [CONTROL_STATUS.IMPLEMENTED]: 1.0,
    'Actif': 1.0,
    [CONTROL_STATUS.PARTIAL]: PARTIAL_CONTROL_WEIGHT,
    [CONTROL_STATUS.IN_PROGRESS]: 0.3,
    'En revue': 0.2,
    [CONTROL_STATUS.PLANNED]: 0.15,
    [CONTROL_STATUS.NOT_STARTED]: 0.1,
    [CONTROL_STATUS.OVERDUE]: 0.1,
    [CONTROL_STATUS.NOT_APPLICABLE]: 0,
    [CONTROL_STATUS.EXCLUDED]: 0,
    'Inactif': 0,
    'Non conforme': 0
};

/**
 * Calculate mitigation percentage based on linked controls
 */
export function calculateMitigationPercentage(linkedControls: Control[]): number {
    if (linkedControls.length === 0) return 0;

    const effectiveScore = linkedControls.reduce((sum, ctrl) => {
        return sum + (CONTROL_STATUS_WEIGHTS[ctrl.status] ?? 0);
    }, 0);

    // Each fully implemented control contributes up to 15% mitigation, capped at 80%
    const maxMitigation = Math.min(linkedControls.length * 15, 80);
    return Math.min(Math.round((effectiveScore / linkedControls.length) * maxMitigation), 80);
}

/**
 * Calculate suggested residual risk values based on linked controls
 *
 * Returns suggested residual probability and impact based on:
 * - Number of linked controls
 * - Implementation status of controls
 * - Original risk score
 */
export function calculateSuggestedResidualRisk(
    probability: number,
    impact: number,
    linkedControls: Control[]
): {
    suggestedProbability: number;
    suggestedImpact: number;
    mitigationPercentage: number;
    explanation: string;
} {
    const mitigationPercentage = calculateMitigationPercentage(linkedControls);

    if (mitigationPercentage === 0) {
        return {
            suggestedProbability: probability,
            suggestedImpact: impact,
            mitigationPercentage: 0,
            explanation: 'Aucun contrôle implémenté - le risque résiduel reste identique au risque brut.'
        };
    }

    // Calculate reduction factor (e.g., 60% mitigation = 0.4 remaining)
    const reductionFactor = 1 - (mitigationPercentage / 100);

    // Primarily reduce probability (controls reduce likelihood of occurrence)
    // Impact reduction is smaller (controls may limit but not eliminate damage)
    const probabilityReduction = reductionFactor;
    const impactReduction = 1 - ((mitigationPercentage / 100) * 0.3); // Max 24% impact reduction

    const suggestedProbability = Math.max(1, Math.round(probability * probabilityReduction));
    const suggestedImpact = Math.max(1, Math.round(impact * impactReduction));

    const implementedCount = linkedControls.filter(c =>
        c.status === CONTROL_STATUS.IMPLEMENTED || c.status === 'Actif'
    ).length;
    const partialCount = linkedControls.filter(c =>
        c.status === CONTROL_STATUS.PARTIAL || c.status === CONTROL_STATUS.IN_PROGRESS
    ).length;

    let explanation = `Basé sur ${linkedControls.length} contrôle(s) lié(s): `;
    if (implementedCount > 0) {
        explanation += `${implementedCount} implémenté(s)`;
    }
    if (partialCount > 0) {
        explanation += `${implementedCount > 0 ? ', ' : ''}${partialCount} partiellement implémenté(s)`;
    }
    explanation += `. Réduction estimée: ${mitigationPercentage}%.`;

    return {
        suggestedProbability,
        suggestedImpact,
        mitigationPercentage,
        explanation
    };
}

// Uses centralized thresholds from complianceConfig.ts
export const getRiskLevel = (score: number) => {
    if (score >= RISK_THRESHOLDS.CRITICAL) return { label: 'Critique', status: 'error' as const };
    if (score >= RISK_THRESHOLDS.HIGH) return { label: 'Élevé', status: 'warning' as const };
    if (score >= RISK_THRESHOLDS.MEDIUM) return { label: 'Moyen', status: 'info' as const };
    return { label: 'Faible', status: 'success' as const };
};

export const getSLAStatus = (risk: Risk) => {
    if (risk.strategy === 'Accepter' || !risk.treatmentDeadline) return null;
    if (risk.status === 'Fermé') return null;

    const deadline = new Date(risk.treatmentDeadline);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'overdue', days: Math.abs(diffDays), label: `Retard ${Math.abs(diffDays)}j`, color: 'text-red-600 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800' };
    if (diffDays <= 7) return { status: 'warning', days: diffDays, label: `J-${diffDays}`, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800' };
    return { status: 'ok', days: diffDays, label: `${diffDays}j`, color: 'text-slate-500 bg-slate-100 border-border/40 dark:text-slate-400 dark:bg-slate-800' };
};
