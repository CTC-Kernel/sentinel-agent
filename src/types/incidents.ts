import { Criticality } from './common';

export interface Incident {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    severity: Criticality;
    status: 'Nouveau' | 'Analyse' | 'Contenu' | 'Résolu' | 'Fermé';
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

export interface SupplierIncident {
    id: string;
    supplierId: string;
    organizationId: string;
    title: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    category: 'Security' | 'Availability' | 'Data' | 'Compliance' | 'Other';
    impact: {
        operational: 'None' | 'Minor' | 'Moderate' | 'Major' | 'Critical';
        financial: number;
        reputational: 'None' | 'Minor' | 'Moderate' | 'Major' | 'Critical';
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
    status: 'Open' | 'Investigating' | 'Contained' | 'Resolved' | 'Closed';
    assignedTo?: string;
    createdAt: string;
    updatedAt: string;
}
