import { Criticality } from './common';

export interface Supplier {
    id: string;
    organizationId: string;
    name: string;
    category: 'SaaS' | 'Hébergement' | 'Matériel' | 'Consulting' | 'Autre';
    criticality: Criticality;
    contactName?: string;
    contactEmail?: string;
    status: 'Actif' | 'En cours' | 'Terminé';
    owner?: string;
    ownerId?: string;
    description?: string;
    supportedProcessIds?: string[];
    contractDocumentId?: string;
    contractEnd?: string;
    securityScore?: number;
    assessment?: {
        hasIso27001?: boolean;
        hasGdprPolicy?: boolean;
        hasEncryption?: boolean;
        hasBcp?: boolean;
        hasIncidentProcess?: boolean;
        lastAssessmentDate?: string;
    };
    // DORA Specific Fields
    isICTProvider?: boolean;
    supportsCriticalFunction?: boolean;
    doraCriticality?: 'Critical' | 'Important' | 'None';
    serviceType?: 'SaaS' | 'Cloud' | 'Software' | 'Hardware' | 'Consulting' | 'Network' | 'Security';
    relatedAssetIds?: string[];
    relatedRiskIds?: string[];
    relatedProjectIds?: string[];

    riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
    riskAssessment: {
        overallScore: number;
    };
    contract: {
        endDate?: string;
    };
    createdAt: string;
    updatedAt: string;
    reviewDates: {
        contractReview: string;
        securityReview: string;
        complianceReview: string;
        contractEnd?: string;
    };
    serviceCatalog?: string[];
    sla?: string;
}

export interface SupplierAssessment {
    id: string;
    supplierId: string;
    organizationId: string;
    assessmentDate: string;
    assessorId: string;
    assessorName: string;
    categories: {
        security: {
            score: 1 | 2 | 3 | 4 | 5;
            findings: string[];
            evidence: string[];
        };
        compliance: {
            score: 1 | 2 | 3 | 4 | 5;
            findings: string[];
            evidence: string[];
        };
        operational: {
            score: 1 | 2 | 3 | 4 | 5;
            findings: string[];
            evidence: string[];
        };
        financial: {
            score: 1 | 2 | 3 | 4 | 5;
            findings: string[];
            evidence: string[];
        };
    };
    overallScore: number;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    recommendations: string[];
    requiredActions: string[];
    followUpDate: string;
    status: 'Draft' | 'In Review' | 'Approved' | 'Rejected';
    approvedBy?: string;
    approvedDate?: string;
}

export interface ProcessingActivity {
    id: string;
    organizationId: string;
    name: string;
    purpose: string;
    manager: string;
    managerId?: string;
    legalBasis: 'Consentement' | 'Contrat' | 'Obligation Légale' | 'Intérêt Légitime' | 'Sauvegarde Intérêts' | 'Mission Publique';
    dataCategories: string[];
    dataSubjects: string[];
    retentionPeriod: string;
    hasDPIA: boolean;
    status: 'Actif' | 'En projet' | 'Archivé';
    createdAt?: string;
    updatedAt?: string;
    relatedAssetIds?: string[]; // Linked Assets (Storage, Processing, etc.)
    relatedRiskIds?: string[]; // Linked Risks (DPIA)
}

export interface BusinessProcess {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    owner: string;
    rto: string;
    rpo: string;
    priority: 'Critique' | 'Élevée' | 'Moyenne' | 'Faible';
    supportingAssetIds: string[];
    drpDocumentId?: string;
    lastTestDate?: string;
    relatedRiskIds?: string[]; // Scenarios
    supplierIds?: string[]; // Outsourcing
    createdAt?: string;
    updatedAt?: string;
    recoveryTasks?: {
        id: string;
        title: string;
        description?: string;
        owner: string;
        duration: string; // e.g. "30m", "2h"
        order: number;
    }[];
}

export interface BcpDrill {
    id: string;
    organizationId: string;
    processId: string;
    date: string;
    type: 'Tabletop' | 'Simulation' | 'Bascule réelle' | 'Full Scale' | 'Call Tree';
    result: 'Succès' | 'Succès partiel' | 'Échec';
    notes?: string;
    createdAt: string;
}

export interface TrustRelationship {
    id: string;
    sourceOrgId: string;
    targetOrgId: string;
    targetOrgName: string;
    status: 'trusted' | 'blocked' | 'pending';
    createdAt: string;
}

export interface SharingPreferences {
    organizationId: string;
    defaultScope: 'public' | 'community' | 'trusted_only' | 'private';
    anonymizeIdentity: boolean;
    autoShareHighSeverity: boolean;
}

export interface ContinuitySuggestion {
    rto: string;
    rpo: string;
    priority: 'Critique' | 'Élevée' | 'Moyenne' | 'Faible';
    recoveryTasks: Array<{
        title: string;
        owner: string;
        duration: string;
        description?: string;
    }>;
    reasoning: string;
}

// Vendor Risk Management (VRM) Types

export type SupplierQuestionType = 'yes_no' | 'multiple_choice' | 'text' | 'rating';

export interface SupplierQuestionnaireQuestion {
    id: string;
    text: string;
    type: SupplierQuestionType;
    weight: number; // 1-10
    options?: string[]; // For multiple choice
    required: boolean;
    helperText?: string;
}

export interface QuestionnaireSection {
    id: string;
    title: string;
    description?: string;
    questions: SupplierQuestionnaireQuestion[];
    weight: number; // Weight of this section in overall score (0-100%)
}

export interface QuestionnaireTemplate {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    sections: QuestionnaireSection[];
    isDefault?: boolean;
    isSystem?: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

export interface SupplierQuestionnaireResponse {
    id: string;
    organizationId: string;
    templateId: string;
    supplierId: string;
    supplierName: string;
    status: 'Draft' | 'Sent' | 'In Progress' | 'Submitted' | 'Reviewed' | 'Archived';
    answers: Record<string, {
        value: string | number | boolean | string[];
        comment?: string;
        evidenceUrl?: string;
    }>;
    sectionScores?: Record<string, number>; // Score per section (0-100)
    overallScore: number; // 0-100
    riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
    remediationPlan?: string;
    respondentEmail?: string;
    sentDate: string;
    submittedDate?: string;
    reviewedDate?: string;
    reviewedBy?: string;
    dueDate?: string;
    updatedAt?: string;
}
