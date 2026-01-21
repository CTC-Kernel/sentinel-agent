import { Criticality } from './common';

export interface Supplier {
    id: string;
    organizationId: string;
    name: string;
    category: 'SaaS' | 'Hébergement' | 'Matériel' | 'Consulting' | 'Autre';
    criticality: Criticality;
    contactName?: string;
    contactEmail?: string;
    status: 'Actif' | 'En cours' | 'Terminé' | 'Suspendu';
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
    doraContractClauses?: {
        auditRights?: boolean;
        slaDefined?: boolean;
        dataLocation?: boolean;
        subcontractingConditions?: boolean;
        incidentNotification?: boolean;
        exitStrategy?: boolean;
    };
    isICTProvider?: boolean;
    supportsCriticalFunction?: boolean;
    doraCriticality?: 'Critique' | 'Important' | 'Aucun';
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

// ProcessingActivity moved to privacy.ts

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

export interface Strategy {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    type: 'Active-Active' | 'Active-Passive' | 'Cold Standby' | 'Cloud DR';
    rto: string;
    rpo: string;
    linkedAssets: string[];
    createdAt?: string;
    updatedAt?: string;
}

export interface WarRoomSession {
    id: string;
    organizationId: string;
    scenario: string;
    isActive: boolean;
    startedAt: string;
    endedAt?: string;
    messages?: Array<{
        id: string;
        sender: string;
        role: string;
        content: string;
        timestamp: string;
        isSystem?: boolean;
    }>;
}

export interface RecoveryPlanStep {
    id: string;
    title: string;
    description: string;
    assignedRole: string; // e.g., "SysAdmin", "DevOps"
    estimatedDuration: number; // in minutes
    isCritical: boolean;
}

export interface RecoveryPlan {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    type: 'IT System' | 'Business Process' | 'Facility' | 'Crisis Comm';
    strategyId?: string; // Link to high-level strategy
    rto: string;
    rpo: string;
    linkedAssetIds: string[];
    triggers: string[];
    steps: RecoveryPlanStep[];
    status: 'Draft' | 'Active' | 'Archived' | 'Testing';
    ownerId: string;
    lastTestedAt?: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Continuity Workshop Phase Status
 */
export type ContinuityWorkshopPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

/**
 * Continuity Workshop Phase
 */
export interface ContinuityWorkshopPhase {
    id: string;
    name: string;
    description: string;
    status: ContinuityWorkshopPhaseStatus;
    order: number;
    tasks: ContinuityWorkshopTask[];
    dueDate?: string;
    completedAt?: string;
    responsible?: string;
    deliverables?: string[];
}

/**
 * Continuity Workshop Task
 */
export interface ContinuityWorkshopTask {
    id: string;
    title: string;
    description: string;
    isCompleted: boolean;
    isRequired: boolean;
    helpText?: string;
    linkedDocumentIds?: string[];
    linkedAssetIds?: string[];
}

/**
 * Continuity Method Template
 */
export interface ContinuityMethodTemplate {
    id: string;
    name: string;
    module: 'bia' | 'strategies' | 'pra' | 'drills' | 'tlpt' | 'crisis';
    framework?: string; // ISO 22301, DORA, etc.
    description: string;
    phases: Omit<ContinuityWorkshopPhase, 'status' | 'completedAt'>[];
    estimatedDuration: string;
    bestPractices: string[];
    deliverables: string[];
    isDefault?: boolean;
}

/**
 * Continuity Workshop (instance of a method template)
 */
export interface ContinuityWorkshop {
    id: string;
    organizationId: string;
    templateId: string;
    name: string;
    module: 'bia' | 'strategies' | 'pra' | 'drills' | 'tlpt' | 'crisis';
    status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
    phases: ContinuityWorkshopPhase[];
    progress: number;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
    notes?: string;
}
