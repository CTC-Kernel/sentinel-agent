/**
 * RiskConstants - Centralized constants and enums for the Risk module
 */

export const STANDARD_THREATS = [
    "Panne matérielle serveur",
    "Incendie",
    "Inondation",
    "Vol d'équipement",
    "Attaque par Ransomware",
    "Phishing / Ingénierie Sociale",
    "Erreur humaine / Configuration",
    "Divulgation non autorisée",
    "Interruption de service FAI",
    "Sabotage interne",
    "Obsolescence technologique",
    "Perte de personnel clé"
];

export const RISK_STATUSES = ['Brouillon', 'Ouvert', 'En cours', 'Fermé', 'En attente de validation'] as const;

export enum RiskStrategy {
    MITIGATE = 'Atténuer',
    TRANSFER = 'Transférer',
    AVOID = 'Éviter',
    ACCEPT = 'Accepter'
}

export const RISK_STRATEGY_LABELS = {
    [RiskStrategy.MITIGATE]: 'risks.strategies.mitigate',
    [RiskStrategy.TRANSFER]: 'risks.strategies.transfer',
    [RiskStrategy.AVOID]: 'risks.strategies.avoid',
    [RiskStrategy.ACCEPT]: 'risks.strategies.accept'
};

export enum SlaStatus {
    ON_TRACK = 'On Track',
    AT_RISK = 'At Risk',
    BREACHED = 'Breached'
}

export const SLA_STATUS_LABELS = {
    [SlaStatus.ON_TRACK]: 'risks.sla.onTrack',
    [SlaStatus.AT_RISK]: 'risks.sla.atRisk',
    [SlaStatus.BREACHED]: 'risks.sla.breached'
};

export const RISK_ACCEPTANCE_THRESHOLD = 12;

export const RISK_LEVELS = {
    LOW: { min: 1, max: 4, label: 'risks.matrix.legend.low', color: 'bg-green-500' },
    MEDIUM: { min: 5, max: 9, label: 'risks.matrix.legend.medium', color: 'bg-yellow-500' },
    HIGH: { min: 10, max: 15, label: 'risks.matrix.legend.high', color: 'bg-orange-500' },
    CRITICAL: { min: 16, max: 25, label: 'risks.matrix.legend.critical', color: 'bg-red-500' }
};
