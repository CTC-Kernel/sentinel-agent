import { Framework } from './common';

/**
 * Unified control status enumeration
 * Used consistently across types and schemas
 */
export const CONTROL_STATUSES = [
    'Non commencé',
    'En cours',
    'Implémenté',
    'Partiel',
    'Non applicable',
    'Exclu',
    'En revue',
    'Actif',
    'Inactif',
    'Non conforme'
] as const;

export type ControlStatus = typeof CONTROL_STATUSES[number];

export interface AutomatedEvidence {
    id: string;
    providerId: string;
    resourceType: string;
    resourceId: string;
    status: 'pass' | 'fail' | 'error';
    lastSync: string;
    details?: string;
}

export interface Control {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    framework?: Framework;
    mappedFrameworks?: Framework[]; // Additional frameworks this control satisfies (cross-framework mapping)
    description?: string;
    type?: 'Préventif' | 'Détectif' | 'Correctif';
    status: ControlStatus;
    applicability?: 'Applicable' | 'Non applicable';
    justification?: string;
    evidenceIds?: string[];
    automatedEvidence?: AutomatedEvidence[];
    evidenceStrength?: 'Faible' | 'Forte';
    lastUpdated?: string;
    owner?: string; // Added owner for compatibility
    assigneeId?: string;
    relatedAssetIds?: string[];
    relatedRiskIds?: string[]; // Added missing field
    relatedSupplierIds?: string[];
    relatedProjectIds?: string[];
    maturity?: number; // Added for SoA reporting
}

// SoA Version for tracking Statement of Applicability history
export interface SoAControlSnapshot {
    code: string;
    name: string;
    applicability: string;
    justification: string;
    status: string;
    risksCount: number;
    evidenceCount: number;
}

export interface SoAVersion {
    id: string;
    organizationId: string;
    framework: Framework;
    version: number;
    generatedAt: string;
    generatedBy: string;
    generatedByName: string;
    notes?: string;
    controlsSnapshot: SoAControlSnapshot[];
    stats: {
        totalControls: number;
        applicableControls: number;
        implementedControls: number;
        partialControls: number;
    };
}
