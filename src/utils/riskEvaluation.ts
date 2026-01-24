import { Control } from '../types';
import { RISK_THRESHOLDS } from '../constants/complianceConfig';

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
 * Uses centralized thresholds from complianceConfig.ts
 */
export function getRiskLevelFromScore(score: number): RiskLevel {
    if (score >= RISK_THRESHOLDS.CRITICAL) {
        return {
            label: 'Critique',
            color: 'error',
            bgColor: 'bg-error-text',
            textColor: 'text-error-text dark:text-error-text'
        };
    }
    if (score >= RISK_THRESHOLDS.HIGH) {
        return {
            label: 'Élevé',
            color: 'warning',
            bgColor: 'bg-warning-text',
            textColor: 'text-warning-text dark:text-warning-text'
        };
    }
    if (score >= RISK_THRESHOLDS.MEDIUM) {
        return {
            label: 'Moyen',
            color: 'info',
            bgColor: 'bg-info-text',
            textColor: 'text-info-text dark:text-info-text'
        };
    }
    return {
        label: 'Faible',
        color: 'success',
        bgColor: 'bg-success-text',
        textColor: 'text-success-text dark:text-success-text'
    };
}

/**
 * Calculate risk score from impact and probability
 */
export function calculateRiskScore(impact: number, probability: number): number {
    return impact * probability;
}

/**
 * Status values that should be excluded from mitigation calculation
 * These controls are not meant to contribute to risk mitigation
 */
const EXCLUDED_STATUSES = ['Non applicable', 'Exclu', 'Inactif', 'Non appliqué'];

/**
 * Calculate mitigation coverage percentage based on control implementation status
 * Only counts controls that are meant to be applicable (excludes inactive/non-applicable)
 */
export function calculateMitigationCoverage(linkedControls: Control[]): number {
    // Filter out controls that shouldn't be counted in coverage calculation
    const applicableControls = linkedControls.filter(
        ctrl => !EXCLUDED_STATUSES.includes(ctrl.status)
    );

    if (applicableControls.length === 0) return 0;

    const statusWeightMap: Record<string, number> = {
        'Implémenté': 1.0,
        'Actif': 1.0,
        'Partiel': 0.5,
        'En cours': 0.3,
        'En revue': 0.2,
        'Non commencé': 0.1,
        'Non conforme': 0
    };

    const effectiveScore = applicableControls.reduce((sum, ctrl) => {
        return sum + (statusWeightMap[ctrl.status] ?? 0);
    }, 0);

    return Math.min(Math.round((effectiveScore / applicableControls.length) * 100), 100);
}
