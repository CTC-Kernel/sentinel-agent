import { Framework } from './common';

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
    description?: string;
    type?: 'Préventif' | 'Détectif' | 'Correctif';
    status: 'Non commencé' | 'Implémenté' | 'Partiel' | 'Non applicable' | 'Exclu' | 'En revue' | 'Actif' | 'Inactif' | 'En cours' | 'Non appliqué'; // Merged statuses to be safe
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
