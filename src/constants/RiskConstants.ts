import { RISK_COLORS } from './colors';

export const RISK_ACCEPTANCE_THRESHOLD = 12;

export const RISK_LEVELS = {
    CRITICAL: { label: 'Critique', min: 15, color: RISK_COLORS.critical },
    HIGH: { label: 'Élevé', min: 10, color: RISK_COLORS.high },
    MEDIUM: { label: 'Moyen', min: 5, color: RISK_COLORS.medium },
    LOW: { label: 'Faible', min: 0, color: RISK_COLORS.low }
};
