
import { Risk } from '../types';
import { RISK_COLORS, STATUS_COLORS } from '../constants/colors';
import { RISK_THRESHOLDS } from '../constants/complianceConfig';

export const RiskCalculator = {
    /**
     * Calculates the inherent risk score.
     */
    calculateScore: (_detectability: number | undefined, probability: number, impact: number): number => {
        // Simple multiplication for now, readily extensible for more complex formulas (e.g. ISO 27005)
        // If detectability is used in the future, it can be added here.
        return probability * impact;
    },

    /**
     * Calculates the residual risk score.
     */
    calculateResidualScore: (residualProbability: number, residualImpact: number): number => {
        return residualProbability * residualImpact;
    },

    /**
     * Determines the criticality level based on the score.
     * Scale: 1-25
     */
    getCriticalityLabel: (score: number): 'Faible' | 'Moyen' | 'Élevé' | 'Critique' => {
        if (score >= RISK_THRESHOLDS.CRITICAL) return 'Critique';
        if (score >= RISK_THRESHOLDS.HIGH) return 'Élevé';
        if (score >= RISK_THRESHOLDS.MEDIUM) return 'Moyen';
        return 'Faible';
    },

    /**
     * Returns the color associated with the score.
     */
    getScoreColor: (score: number): string => {
        if (score >= RISK_THRESHOLDS.CRITICAL) return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
        if (score >= RISK_THRESHOLDS.HIGH) return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
        if (score >= RISK_THRESHOLDS.MEDIUM) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400';
    },

    /**
     * Returns the badge status for UI components
     */
    getBadgeStatus: (score: number): 'error' | 'warning' | 'info' | 'success' => {
        if (score >= RISK_THRESHOLDS.CRITICAL) return 'error';
        if (score >= RISK_THRESHOLDS.HIGH) return 'warning';
        if (score >= RISK_THRESHOLDS.MEDIUM) return 'info';
        return 'success';
    },

    /**
     * Returns the hex color for charts/matrices
     */
    getScoreHexColor: (score: number): string => {
        if (score >= RISK_THRESHOLDS.CRITICAL) return RISK_COLORS.critical;
        if (score >= RISK_THRESHOLDS.HIGH) return RISK_COLORS.high;
        if (score >= RISK_THRESHOLDS.MEDIUM) return STATUS_COLORS.warning;
        return STATUS_COLORS.success;
    },

    /**
     * Sanitizes a risk object to ensure numeric values are valid numbers.
     */
    sanitizeRisk: (risk: Risk): Risk => {
        const prob = Number(risk.probability) || 1;
        const imp = Number(risk.impact) || 1;
        const resProb = Number(risk.residualProbability) || prob;
        const resImp = Number(risk.residualImpact) || imp;

        const score = RiskCalculator.calculateScore(undefined, prob, imp);
        const residualScore = RiskCalculator.calculateResidualScore(resProb, resImp);

        return {
            ...risk,
            probability: prob as Risk['probability'],
            impact: imp as Risk['impact'],
            residualProbability: resProb as Risk['probability'],
            residualImpact: resImp as Risk['impact'],
            score: Number(risk.score) || score,
            residualScore: Number(risk.residualScore) || residualScore // Prioritize stored residual score if exists, else compute
        };
    },

    /**
     * Parses partial risk values from forms or templates, ensuring defaults.
     */
    parseRiskValues: (data: Partial<{ probability: number; impact: number; residualProbability: number; residualImpact: number }> | null | undefined) => {
        const prob = Number(data?.probability) || 1;
        const imp = Number(data?.impact) || 1;
        const resProb = Number(data?.residualProbability) || prob;
        const resImp = Number(data?.residualImpact) || imp;

        const score = RiskCalculator.calculateScore(undefined, prob, imp);
        const residualScore = RiskCalculator.calculateResidualScore(resProb, resImp);

        return {
            probability: prob as Risk['probability'],
            impact: imp as Risk['impact'],
            residualProbability: resProb as Risk['probability'],
            residualImpact: resImp as Risk['impact'],
            score,
            residualScore
        };
    }
};
