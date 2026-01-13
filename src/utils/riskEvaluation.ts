import { Control } from '../types';

/**
 * Risk level classification based on score
 */
export interface RiskLevel {
    label: string;
    color: string;
    bgColor: string;
    textColor: string;
}

/**
 * Get risk level based on score (impact × probability)
 */
export function getRiskLevelFromScore(score: number): RiskLevel {
    if (score >= 15) {
        return {
            label: 'Critique',
            color: 'rose',
            bgColor: 'bg-rose-500',
            textColor: 'text-rose-600 dark:text-rose-400'
        };
    }
    if (score >= 10) {
        return {
            label: 'Élevé',
            color: 'orange',
            bgColor: 'bg-orange-500',
            textColor: 'text-orange-600 dark:text-orange-400'
        };
    }
    if (score >= 5) {
        return {
            label: 'Moyen',
            color: 'amber',
            bgColor: 'bg-amber-400',
            textColor: 'text-amber-600 dark:text-amber-400'
        };
    }
    return {
        label: 'Faible',
        color: 'emerald',
        bgColor: 'bg-emerald-500',
        textColor: 'text-emerald-600 dark:text-emerald-400'
    };
}

/**
 * Calculate risk score from impact and probability
 */
export function calculateRiskScore(impact: number, probability: number): number {
    return impact * probability;
}

/**
 * Calculate mitigation coverage percentage based on control implementation status
 */
export function calculateMitigationCoverage(linkedControls: Control[]): number {
    if (linkedControls.length === 0) return 0;

    const statusWeightMap: Record<string, number> = {
        'Implémenté': 1.0,
        'Actif': 1.0,
        'Partiel': 0.5,
        'En cours': 0.3,
        'En revue': 0.2,
        'Non commencé': 0.1,
        'Non applicable': 0,
        'Exclu': 0,
        'Inactif': 0,
        'Non appliqué': 0
    };

    const effectiveScore = linkedControls.reduce((sum, ctrl) => {
        return sum + (statusWeightMap[ctrl.status] ?? 0);
    }, 0);

    return Math.min(Math.round((effectiveScore / linkedControls.length) * 100), 100);
}
