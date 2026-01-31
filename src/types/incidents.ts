import { Criticality } from './common';

/**
 * Unified incident status enumeration (French)
 */
export const INCIDENT_STATUSES = [
    'Nouveau',
    'Analyse',
    'Contenu',
    'Résolu',
    'Fermé'
] as const;

export type IncidentStatus = typeof INCIDENT_STATUSES[number];

/**
 * DORA Incident Reporting Timelines (Article 19)
 */
export const DORA_REPORTING_TIMELINES = {
    INITIAL_NOTIFICATION: 4 * 60 * 60 * 1000,   // 4 hours (Major ICT incidents)
    INTERMEDIATE_REPORT: 72 * 60 * 60 * 1000,   // 72 hours
    FINAL_REPORT: 30 * 24 * 60 * 60 * 1000      // 1 month
} as const;

/**
 * Supplier incident status (French)
 */
export const SUPPLIER_INCIDENT_STATUSES = [
    'Ouvert',
    'En investigation',
    'Contenu',
    'Résolu',
    'Fermé'
] as const;

export type SupplierIncidentStatus = typeof SUPPLIER_INCIDENT_STATUSES[number];

/**
 * Valid incident status transitions
 */
export const VALID_INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
    'Nouveau': ['Analyse'],
    'Analyse': ['Contenu', 'Résolu'],
    'Contenu': ['Résolu'],
    'Résolu': ['Fermé'],
    'Fermé': []
};

/**
 * Check if an incident status transition is valid
 */
export function isValidIncidentTransition(from: IncidentStatus, to: IncidentStatus): boolean {
    return VALID_INCIDENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Impact levels (French) for supplier incidents
 */
export const IMPACT_LEVELS = [
    'Aucun',
    'Mineur',
    'Modéré',
    'Majeur',
    'Critique'
] as const;

export type ImpactLevel = typeof IMPACT_LEVELS[number];

export interface Incident {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    severity: Criticality;
    status: IncidentStatus;
    category?: 'Ransomware' | 'Phishing' | 'Vol Matériel' | 'Indisponibilité' | 'Fuite de Données' | 'Autre';
    playbookStepsCompleted?: string[];
    affectedAssetId?: string;
    affectedProcessId?: string;
    relatedRiskId?: string;
    financialImpact?: number; // Coût estimé de l'incident
    reporter: string;
    dateReported: string;
    dateAnalysis?: string;
    dateContained?: string;
    dateResolved?: string;
    lessonsLearned?: string;
    // NIS 2 Specific Fields
    isSignificant?: boolean;
    notificationStatus?: 'Not Required' | 'Pending' | 'Reported';
    relevantAuthorities?: string[];
    responseOwner?: string;
    detectedAt?: string;
    impact?: string;
    updatedAt?: string;
    // Masterpiece enhancements
    history?: { date: string; user: string; action: string; details: string }[];
    tags?: string[];
    playbookId?: string;
}

/**
 * Supplier incident categories (French)
 */
export const SUPPLIER_INCIDENT_CATEGORIES = [
    'Sécurité',
    'Disponibilité',
    'Données',
    'Conformité',
    'Autre'
] as const;

export type SupplierIncidentCategory = typeof SUPPLIER_INCIDENT_CATEGORIES[number];

export interface SupplierIncident {
    id: string;
    supplierId: string;
    organizationId: string;
    title: string;
    description: string;
    severity: Criticality;
    category: SupplierIncidentCategory;
    impact: {
        operational: ImpactLevel;
        financial: number;
        reputational: ImpactLevel;
    };
    timeline: {
        detected: string;
        reported: string;
        contained?: string;
        resolved?: string;
        rootCauseIdentified?: string;
    };
    rootCause: string;
    lessonsLearned: string[];
    preventiveActions: string[];
    status: SupplierIncidentStatus;
    assignedTo?: string;
    createdAt: string;
    updatedAt: string;
}
