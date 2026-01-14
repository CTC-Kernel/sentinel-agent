
import { Risk } from '../types';
import { RISK_COLORS, STATUS_COLORS } from '../constants/colors';

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
        if (score >= 15) return 'Critique';
        if (score >= 10) return 'Élevé';
        if (score >= 5) return 'Moyen';
        return 'Faible';
    },

    /**
     * Returns the color associated with the score.
     */
    getScoreColor: (score: number): string => {
        if (score >= 15) return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'; // Critique
        if (score >= 10) return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400'; // Élevé
        if (score >= 5) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'; // Moyen
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'; // Faible
    },

    /**
     * Returns the hex color for charts/matrices
     */
    getScoreHexColor: (score: number): string => {
        if (score >= 15) return RISK_COLORS.critical;
        if (score >= 10) return RISK_COLORS.high;
        if (score >= 5) return STATUS_COLORS.warning;
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
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    parseRiskValues: (data: any) => {
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
